/**
 * JSON helpers: format, minify, and precise error locations.
 *
 * JSON.parse error messages differ between browsers and rarely say where the
 * problem is, so when parsing fails we re-scan the text with a small strict
 * validator that reports a message plus a line and column.
 */

class JsonSyntaxError extends Error {
  constructor(message, position) {
    super(message);
    this.position = position;
  }
}

const MAX_DEPTH = 512;

function show(ch) {
  if (ch === undefined) return 'end of input';
  if (ch === '\n') return 'a line break';
  if (ch === '\t') return 'a tab';
  return `"${ch}"`;
}

/** Walks the text once and throws a JsonSyntaxError at the first problem. */
function validate(text) {
  const n = text.length;
  let i = 0;

  const skipWs = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };

  const fail = (message, position = i) => {
    throw new JsonSyntaxError(message, position);
  };

  const unexpected = () => {
    if (i >= n) fail('Unexpected end of input');
    if (text[i] === '/') fail('Comments are not allowed in JSON');
    if (text[i] === "'") fail('Strings must use double quotes, not single quotes');
    fail(`Unexpected character ${show(text[i])}`);
  };

  const isDigit = (ch) => ch >= '0' && ch <= '9';

  function parseString() {
    const start = i;
    i++; // opening quote
    while (i < n) {
      const ch = text[i];
      if (ch === '"') {
        i++;
        return;
      }
      if (ch < ' ') fail('Control characters must be escaped inside strings (for example \\n)');
      if (ch === '\\') {
        const next = text[i + 1];
        if (next === 'u') {
          for (let k = 2; k <= 5; k++) {
            if (!/[0-9a-fA-F]/.test(text[i + k] ?? '')) fail('Invalid \\u escape: expected 4 hex digits', i + k < n ? i + k : n);
          }
          i += 6;
        } else if (next !== undefined && '"\\/bfnrt'.includes(next)) {
          i += 2;
        } else {
          fail(`Invalid escape sequence \\${next ?? ''}`.trim(), i);
        }
      } else {
        i++;
      }
    }
    fail('Unterminated string', start);
  }

  function parseNumber() {
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') {
      i++;
      if (isDigit(text[i] ?? '')) fail('Leading zeros are not allowed in numbers', start);
    } else if (isDigit(text[i] ?? '')) {
      while (isDigit(text[i] ?? '')) i++;
    } else {
      fail('Invalid number: expected a digit', i);
    }
    if (text[i] === '.') {
      i++;
      if (!isDigit(text[i] ?? '')) fail('Invalid number: expected a digit after the decimal point', i);
      while (isDigit(text[i] ?? '')) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!isDigit(text[i] ?? '')) fail('Invalid number: expected a digit in the exponent', i);
      while (isDigit(text[i] ?? '')) i++;
    }
  }

  function parseValue(depth) {
    if (depth > MAX_DEPTH) fail('Nesting is too deep');
    skipWs();
    const ch = text[i];
    if (ch === '{') return parseObject(depth);
    if (ch === '[') return parseArray(depth);
    if (ch === '"') return parseString();
    if (ch === '-' || isDigit(ch ?? '')) return parseNumber();
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return;
      }
    }
    unexpected();
  }

  function parseObject(depth) {
    i++; // {
    skipWs();
    if (text[i] === '}') {
      i++;
      return;
    }
    for (;;) {
      skipWs();
      if (text[i] !== '"') {
        if (text[i] === '}') fail('Trailing comma is not allowed in JSON');
        if (text[i] === "'") fail('Property names must use double quotes, not single quotes');
        if (i >= n) fail('Unexpected end of input');
        fail('Expected a double-quoted property name');
      }
      parseString();
      skipWs();
      if (text[i] !== ':') {
        if (i >= n) fail('Unexpected end of input');
        fail('Expected ":" after the property name');
      }
      i++;
      parseValue(depth + 1);
      skipWs();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === '}') {
        i++;
        return;
      }
      if (i >= n) fail('Unexpected end of input: the object is not closed');
      fail('Expected "," or "}" after the property value');
    }
  }

  function parseArray(depth) {
    i++; // [
    skipWs();
    if (text[i] === ']') {
      i++;
      return;
    }
    for (;;) {
      skipWs();
      if (text[i] === ']') fail('Trailing comma is not allowed in JSON');
      parseValue(depth + 1);
      skipWs();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ']') {
        i++;
        return;
      }
      if (i >= n) fail('Unexpected end of input: the array is not closed');
      fail('Expected "," or "]" after the array item');
    }
  }

  skipWs();
  if (i >= n) fail('The input is empty', 0);
  parseValue(0);
  skipWs();
  if (i < n) fail(`Unexpected data after the end of the JSON value (found ${show(text[i])})`);
}

/** Converts a 0-based string offset to a 1-based line and column. */
export function positionToLineColumn(text, position) {
  let line = 1;
  let lastBreak = -1;
  for (let k = 0; k < position && k < text.length; k++) {
    if (text[k] === '\n') {
      line++;
      lastBreak = k;
    }
  }
  return { line, column: position - lastBreak };
}

/**
 * Finds the first syntax error in `text`.
 * Returns null when the text is valid JSON.
 */
export function findJsonError(text) {
  try {
    validate(text);
    return null;
  } catch (err) {
    if (!(err instanceof JsonSyntaxError)) {
      return { message: 'Nesting is too deep or the input is too large to check', position: 0, line: 1, column: 1 };
    }
    return { message: err.message, position: err.position, ...positionToLineColumn(text, err.position) };
  }
}

/** Parses JSON. On failure the error carries a message, line and column. */
export function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (nativeError) {
    const located = findJsonError(text);
    if (located) return { ok: false, error: located };
    // The strict scan accepted it but JSON.parse did not: fall back to the engine's message.
    return { ok: false, error: { message: String(nativeError.message), position: 0, line: null, column: null } };
  }
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    // fromEntries defines own properties, so a key named "__proto__" stays a normal key.
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeysDeep(value[key])]));
  }
  return value;
}

/** Pretty-prints JSON. `indent` is 2, 4 or "tab". */
export function formatJson(text, { indent = 2, sortKeys = false } = {}) {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const space = indent === 'tab' ? '\t' : Number(indent) || 2;
  const value = sortKeys ? sortKeysDeep(parsed.value) : parsed.value;
  return { ok: true, output: JSON.stringify(value, null, space) };
}

/** Removes all insignificant whitespace. */
export function minifyJson(text, { sortKeys = false } = {}) {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const value = sortKeys ? sortKeysDeep(parsed.value) : parsed.value;
  return { ok: true, output: JSON.stringify(value) };
}
