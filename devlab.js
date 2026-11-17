// Dev lab: runs three devtoolbox modules directly on the portfolio page.
import { formatJson } from './devtoolbox/src/lib/json.js';
import { decodeJwt, describeClaims } from './devtoolbox/src/lib/jwt.js';
import { hashAll } from './devtoolbox/src/lib/hash.js';

const input = document.getElementById('dev-in');
const out = document.getElementById('dev-out');
const label = document.getElementById('dev-label');
const tabs = document.querySelectorAll('.tab');
let current = 'json';

const EXAMPLES = {
  json: '{"name":"Beamlak","areas":["dev","ml","security"],"open_source":true}',
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  hash: 'abc',
};
const LABELS = { json: 'Paste JSON', jwt: 'Paste a JWT (decoding only, the signature is not checked here)', hash: 'Text to hash' };

function errorText(e) {
  return typeof e === 'string' ? e : e && e.line ? `${e.message} (line ${e.line}, column ${e.column})` : (e && e.message) || String(e);
}

async function run() {
  const text = input.value;
  out.classList.remove('bad');
  if (!text.trim()) { out.textContent = ''; return; }
  const mode = current;
  let result;
  if (mode === 'json') {
    const r = formatJson(text, { indent: 2 });
    result = r.ok ? r.output : 'Error: ' + errorText(r.error);
  } else if (mode === 'jwt') {
    const d = decodeJwt(text);
    if (!d.ok) result = 'Error: ' + d.error;
    else {
      const claims = describeClaims(d.payload).map((c) => `${c.name}: ${c.error || c.iso + ' (' + c.status + ')'}`);
      result = 'Header\n' + JSON.stringify(d.header, null, 2) + '\n\nPayload\n' + JSON.stringify(d.payload, null, 2) + (claims.length ? '\n\n' + claims.join('\n') : '');
    }
  } else {
    result = Object.entries(await hashAll(text)).map(([k, v]) => `${k.padEnd(8)}${v}`).join('\n');
  }
  if (mode !== current || input.value !== text) return; // a newer change is already being handled
  out.classList.toggle('bad', result.startsWith('Error:'));
  out.textContent = result;
}

function select(name) {
  current = name;
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  label.textContent = LABELS[name];
  input.value = '';
  out.textContent = '';
}

tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.tab)));
document.getElementById('dev-example').addEventListener('click', () => { input.value = EXAMPLES[current]; run(); });
input.addEventListener('input', run);
select('json');
