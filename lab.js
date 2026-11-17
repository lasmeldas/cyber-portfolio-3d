// Security lab: hashes a password in the browser to show what passguard's breach check would (and would not) send.
const input = document.getElementById('lab-pw');
const out = { hash: 'lab-hash', prefix: 'lab-prefix', suffix: 'lab-suffix', entropy: 'lab-entropy' };
const $ = (k) => document.getElementById(out[k]);

function pool(pw) {
  let n = 0;
  if (/[a-z]/.test(pw)) n += 26;
  if (/[A-Z]/.test(pw)) n += 26;
  if (/[0-9]/.test(pw)) n += 10;
  if (/[^A-Za-z0-9]/.test(pw)) n += 33;
  return n;
}

async function update() {
  const pw = input.value;
  if (!pw) { for (const k in out) $(k).textContent = '-'; return; }
  const bits = pw.length * Math.log2(pool(pw));
  $('entropy').textContent = `${bits.toFixed(0)} bits`;
  if (!(window.crypto && crypto.subtle)) { $('hash').textContent = 'Needs a secure (https) page'; return; }
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw));
  if (input.value !== pw) return; // a newer keystroke is already being handled
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  $('hash').textContent = hex;
  $('prefix').textContent = hex.slice(0, 5);
  $('suffix').textContent = hex.slice(5);
}
if (input) input.addEventListener('input', update);
