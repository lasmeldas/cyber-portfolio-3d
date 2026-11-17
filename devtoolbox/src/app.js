import { formatJson, minifyJson } from './lib/json.js';
import { encodeText, decodeToText, base64ToBytes, bytesToBase64 } from './lib/base64.js';
import { decodeJwt, describeClaims, verifyHs256 } from './lib/jwt.js';
import { hashAll } from './lib/hash.js';
import { findMatches, highlightSegments } from './lib/regex.js';
import { parseTimestampInput, describeTimestamp } from './lib/time.js';
import { diffLines } from './lib/diff.js';
import { uuidv4, uuidv7, parseUuid } from './lib/uuid.js';

const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) n.append(c instanceof Node ? c : document.createTextNode(c ?? ''));
  return n;
}
const area = (id, ph = '', rows) => { const t = el('textarea', { id, placeholder: ph, spellcheck: 'false' }); if (rows) t.rows = rows; return t; };
const btn = (label, fn, pri) => el('button', { class: 'btn' + (pri ? ' pri' : ''), type: 'button', onclick: fn }, label);
const errText = (e) => typeof e === 'string' ? e : e?.line ? `${e.message} (line ${e.line}, column ${e.column})` : e?.message ?? String(e);
function table(rows) {
  return el('table', {}, rows.map(([k, v]) => el('tr', {}, el('th', {}, k), el('td', {}, v))));
}
function copyBtn(getText) {
  return btn('Copy', async (e) => {
    try { await navigator.clipboard.writeText(getText()); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select and copy'; }
    setTimeout(() => (e.target.textContent = 'Copy'), 1200);
  });
}
function live(inputs, fn) { for (const i of inputs) i.addEventListener('input', fn); fn(); }

const tools = {
  JSON() {
    const inp = area('json-in', '{"paste":"JSON here"}'); const out = el('div', { class: 'out', id: 'json-out' });
    const indent = el('select', {}, el('option', { value: '2' }, '2 spaces'), el('option', { value: '4' }, '4 spaces'), el('option', { value: 'tab' }, 'Tabs'));
    const sort = el('input', { type: 'checkbox', id: 'json-sort' });
    const run = (min) => {
      const r = min ? minifyJson(inp.value, { sortKeys: sort.checked }) : formatJson(inp.value, { indent: indent.value === 'tab' ? 'tab' : +indent.value, sortKeys: sort.checked });
      out.className = 'out ' + (r.ok ? '' : 'err'); out.textContent = r.ok ? r.output : errText(r.error);
    };
    inp.addEventListener('input', () => { if (inp.value.trim()) run(false); else out.textContent = ''; });
    return [inp, el('div', { class: 'row' }, btn('Format', () => run(false), true), btn('Minify', () => run(true)), indent, sort, el('label', { for: 'json-sort' }, 'Sort keys'), copyBtn(() => out.textContent)), out];
  },
  Base64() {
    const inp = area('b64-in', 'Text or Base64'); const out = el('div', { class: 'out', id: 'b64-out' });
    const url = el('input', { type: 'checkbox', id: 'b64-url' });
    const show = (r, text) => { out.className = 'out ' + (r.ok ? '' : 'err'); out.textContent = r.ok ? text : r.error; };
    return [inp, el('div', { class: 'row' },
      btn('Encode', () => { const b = new TextEncoder().encode(inp.value); out.className = 'out'; out.textContent = bytesToBase64(b, { urlSafe: url.checked, pad: !url.checked }); }, true),
      btn('Decode', () => { const r = decodeToText(inp.value); show(r, r.text); }),
      url, el('label', { for: 'b64-url' }, 'URL-safe, no padding'), copyBtn(() => out.textContent)), out];
  },
  JWT() {
    const inp = area('jwt-in', 'Paste a JWT (Bearer prefix is fine)'); const secret = el('input', { type: 'text', id: 'jwt-secret', placeholder: 'HS256 secret (optional)' });
    const out = el('div', { id: 'jwt-out' });
    const run = async () => {
      out.replaceChildren();
      if (!inp.value.trim()) return;
      const d = decodeJwt(inp.value);
      if (!d.ok) { out.append(el('div', { class: 'out err' }, d.error)); return; }
      out.append(el('h3', {}, 'Header'), el('div', { class: 'out' }, JSON.stringify(d.header, null, 2)), el('h3', {}, 'Payload'), el('div', { class: 'out' }, JSON.stringify(d.payload, null, 2)));
      const rows = describeClaims(d.payload);
      if (rows.length) out.append(el('h3', {}, 'Dates'), table(rows.map((r) => [r.name, r.error ? el('span', { class: 'err' }, r.error) : el('span', { class: r.expired ? 'err' : 'ok' }, `${r.iso}: ${r.status}`)])));
      if (secret.value) {
        const v = await verifyHs256(inp.value, secret.value);
        out.append(el('h3', {}, 'Signature'), el('div', { class: 'out ' + (v.ok && v.valid ? 'ok' : 'err') }, !v.ok ? v.error : v.valid ? 'Signature is valid.' : 'Signature does NOT match this secret.'));
      }
    };
    live([inp, secret], run);
    return [inp, el('div', { class: 'row' }, secret), el('p', { class: 'sub' }, 'Decoding is not verification. Only HS256 can be checked here, and the secret never leaves this page.'), out];
  },
  Hash() {
    const inp = area('hash-in', 'Text to hash (UTF-8)'); const out = el('div', { id: 'hash-out' });
    const run = async () => { const h = await hashAll(inp.value); out.replaceChildren(table(Object.entries(h))); };
    live([inp], run);
    return [inp, el('p', { class: 'sub' }, 'MD5 and SHA-1 are broken for security use; they are here for checksums and compatibility.'), out];
  },
  Regex() {
    const pat = el('input', { type: 'text', id: 're-pat', placeholder: 'pattern, e.g. (?<year>\\d{4})' }); const fl = el('input', { type: 'text', id: 're-flags', value: 'g', 'aria-label': 'flags' });
    const txt = area('re-text', 'Text to search'); const out = el('div', { id: 're-out' });
    const run = () => {
      out.replaceChildren();
      if (!pat.value) return;
      const r = findMatches(pat.value, fl.value, txt.value);
      if (!r.ok) { out.append(el('div', { class: 'out err' }, r.error)); return; }
      const hl = el('div', { class: 'out' }, highlightSegments(txt.value, r.matches).map((s) => s.matched ? el('mark', {}, s.text) : s.text));
      out.append(el('p', { class: 'sub' }, `${r.matches.length} match${r.matches.length === 1 ? '' : 'es'}${r.truncated ? ' (stopped early)' : ''}`), hl);
      if (r.matches.length) out.append(table(r.matches.slice(0, 50).map((m, i) => [`#${i + 1} at ${m.index}`, [m.text, ...m.groups.map((g, j) => `  $${j + 1}=${g}`), ...Object.entries(m.named || {}).map(([k, v]) => `  ${k}=${v}`)].join('')])));
    };
    live([pat, fl, txt], run);
    return [el('div', { class: 'grid' }, pat, fl), txt, out];
  },
  Time() {
    const inp = el('input', { type: 'text', id: 'ts-in', placeholder: '1700000000 or 2024-02-29T10:30:00Z' }); const out = el('div', { id: 'ts-out' });
    const run = () => {
      out.replaceChildren();
      if (!inp.value.trim()) return;
      const p = parseTimestampInput(inp.value);
      if (!p.ok) { out.append(el('div', { class: 'out err' }, p.error)); return; }
      const d = describeTimestamp(p.ms);
      out.append(table([['Read as', p.unit], ['ISO 8601 (UTC)', d.iso], ['UTC', d.utc], [`Local (${d.timeZone})`, d.local], ['Epoch seconds', String(d.seconds)], ['Epoch milliseconds', String(d.milliseconds)], ['Relative', d.relative]]));
    };
    live([inp], run);
    return [inp, el('div', { class: 'row' }, btn('Now', () => { inp.value = String(Date.now()); run(); }, true)), out];
  },
  Diff() {
    const a = area('diff-a', 'Original'); const b = area('diff-b', 'Changed'); const out = el('div', { id: 'diff-out' });
    const run = () => {
      out.replaceChildren();
      if (!a.value && !b.value) return;
      const r = diffLines(a.value, b.value);
      if (!r.ok) { out.append(el('div', { class: 'out err' }, r.error)); return; }
      out.append(el('p', { class: 'sub' }, `+${r.stats.added} added, -${r.stats.removed} removed, ${r.stats.unchanged} unchanged`),
        el('div', { class: 'out diff' }, r.ops.map((o) => el('div', { class: o.type === 'add' ? 'add' : o.type === 'remove' ? 'rem' : '' }, (o.type === 'add' ? '+ ' : o.type === 'remove' ? '- ' : '  ') + o.line))));
    };
    live([a, b], run);
    return [el('div', { class: 'grid' }, a, b), out];
  },
  UUID() {
    const out = el('div', { class: 'out', id: 'uuid-out' }); const inp = el('input', { type: 'text', id: 'uuid-in', placeholder: 'Paste a UUID to inspect it' }); const info = el('div', { id: 'uuid-info' });
    const gen = (f) => () => { out.textContent = Array.from({ length: 5 }, f).join('\n'); };
    const run = () => {
      info.replaceChildren();
      if (!inp.value.trim()) return;
      const p = parseUuid(inp.value);
      if (!p.ok) { info.append(el('div', { class: 'out err' }, p.error)); return; }
      info.append(table([['Normalized', p.normalized], ['Version', String(p.version)], ['Variant', p.variant], ['Special', p.special ?? 'no'], ['Timestamp', p.timestampMs == null ? 'none' : new Date(p.timestampMs).toISOString()]]));
    };
    live([inp], run);
    return [el('div', { class: 'row' }, btn('New v4 (random)', gen(uuidv4), true), btn('New v7 (time-ordered)', gen(uuidv7)), copyBtn(() => out.textContent)), out, el('h3', {}, 'Inspect'), inp, info];
  },
};

const tabs = $('#tabs'); const main = $('#main');
const blurbs = { JSON: 'Format, minify and find the exact line and column of a syntax error.', Base64: 'Encode and decode text, including Unicode and the URL-safe alphabet.', JWT: 'Decode a token, read its expiry and optionally check an HS256 signature.', Hash: 'MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of any text.', Regex: 'Live matches with groups and highlighting, using the JavaScript engine.', Time: 'Epoch seconds, milliseconds or an ISO date, shown several ways.', Diff: 'Line-by-line comparison of two texts.', UUID: 'Generate v4 and v7 UUIDs, or inspect one.' };
function show(name) {
  for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tool === name));
  main.replaceChildren(el('h2', {}, name), el('p', { class: 'sub' }, blurbs[name]), ...tools[name]());
  try { history.replaceState(null, '', '#' + name.toLowerCase()); } catch {}
}
for (const name of Object.keys(tools)) {
  const b = el('button', { type: 'button', role: 'tab', 'data-tool': name, onclick: () => show(name) }, name);
  tabs.append(b);
}
const start = Object.keys(tools).find((n) => '#' + n.toLowerCase() === location.hash) ?? 'JSON';
show(start);
