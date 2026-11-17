/** Regular expression tester logic (runs on the JavaScript RegExp engine). */

const VALID_FLAGS = 'dgimsuvy';

export function validateFlags(flags) {
  const seen = new Set();
  for (const flag of flags) {
    if (!VALID_FLAGS.includes(flag)) {
      return { ok: false, error: `Unknown flag "${flag}". Valid flags are ${VALID_FLAGS.split('').join(' ')}` };
    }
    if (seen.has(flag)) return { ok: false, error: `The flag "${flag}" is repeated` };
    seen.add(flag);
  }
  if (seen.has('u') && seen.has('v')) return { ok: false, error: 'The flags u and v cannot be used together' };
  return { ok: true };
}

/**
 * Lists every match of `pattern` in `text`.
 * Matches are always collected globally. At most `maxMatches` are returned and
 * `truncated` says whether there were more. Empty matches advance by one code
 * point (or one code unit without the u/v flag), so the loop always ends.
 */
export function findMatches(pattern, flags, text, { maxMatches = 1000 } = {}) {
  const checked = validateFlags(flags);
  if (!checked.ok) return checked;

  let re;
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const unicode = flags.includes('u') || flags.includes('v');
  const matches = [];
  let truncated = false;
  for (;;) {
    const m = re.exec(text);
    if (m === null) break;
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: m.slice(1).map((g) => (g === undefined ? null : g)),
      named: m.groups ? { ...m.groups } : {},
    });
    if (m[0] === '') {
      const cp = text.codePointAt(re.lastIndex);
      re.lastIndex += unicode && cp !== undefined && cp > 0xffff ? 2 : 1;
    }
  }
  return { ok: true, matches, truncated };
}

/**
 * Splits `text` into alternating plain and matched pieces, for highlighting.
 * Empty matches have nothing to highlight and are skipped.
 */
export function highlightSegments(text, matches) {
  const segments = [];
  let cursor = 0;
  matches.forEach((m, number) => {
    if (m.end === m.index) return;
    if (m.index > cursor) segments.push({ text: text.slice(cursor, m.index), matched: false });
    segments.push({ text: text.slice(m.index, m.end), matched: true, number: number + 1 });
    cursor = m.end;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false });
  return segments;
}
