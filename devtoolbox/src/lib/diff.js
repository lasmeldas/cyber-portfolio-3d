/** Line-based text diff using the longest common subsequence. */

const MAX_CELLS = 4_000_000;

/** Splits text into lines. A final line break does not create an extra empty line. */
export function splitLines(text) {
  if (text === '') return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Compares two texts line by line.
 * Returns { ok, ops, stats } where each op is { type: 'equal' | 'add' | 'remove', line }.
 * When both sides have the same total of changes it lists removals before additions.
 */
export function diffLines(oldText, newText) {
  const a = splitLines(oldText);
  const b = splitLines(newText);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const n = endA - start;
  const m = endB - start;
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    return { ok: false, error: 'These texts differ in too many lines to compare in the browser. Try smaller pieces.' };
  }

  // table[i][j] = length of the longest common subsequence of a[start+i..] and b[start+j..]
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[start + i] === b[start + j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const ops = [];
  for (let k = 0; k < start; k++) ops.push({ type: 'equal', line: a[k] });
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      ops.push({ type: 'equal', line: a[start + i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: 'remove', line: a[start + i] });
      i++;
    } else {
      ops.push({ type: 'add', line: b[start + j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'remove', line: a[start + i++] });
  while (j < m) ops.push({ type: 'add', line: b[start + j++] });
  for (let k = endA; k < a.length; k++) ops.push({ type: 'equal', line: a[k] });

  const stats = { added: 0, removed: 0, unchanged: 0 };
  for (const op of ops) {
    if (op.type === 'add') stats.added++;
    else if (op.type === 'remove') stats.removed++;
    else stats.unchanged++;
  }
  return { ok: true, ops, stats };
}

/** Renders ops as text with "+ ", "- " and "  " prefixes. */
export function opsToText(ops) {
  const marker = { add: '+ ', remove: '- ', equal: '  ' };
  return ops.map((op) => marker[op.type] + op.line).join('\n');
}
