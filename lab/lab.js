// Lab: tab controller plus the passguard, authwatch and ML panes. All client-side.
import { analyze, sha1Parts } from './passguard.js';
import { parseLines, detect, excludeIps } from './authwatch.js';
import { knnPredict, kmeans } from './ml.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

/* ---------- tabs ---------- */
const tabs = [...document.querySelectorAll('#lab .tab')];
const panes = [...document.querySelectorAll('#lab .pane')];
function show(name) {
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  panes.forEach((p) => { p.hidden = p.dataset.pane !== name; });
  if (name === 'dev') { const f = $('dev-frame'); if (!f.src) f.src = f.dataset.src; }
  if (name === 'ml') drawMl();
}
tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
$('dev-frame').src = $('dev-frame').dataset.src;

/* ---------- passguard ---------- */
const pwOut = $('pw-out');
let pwTicket = 0;
async function runPassword() {
  const pw = $('pw-in').value;
  const ticket = ++pwTicket;
  pwOut.replaceChildren();
  if (!pw) { $('pw-hash').textContent = '-'; $('pw-prefix').textContent = '-'; return; }
  const r = analyze(pw);
  const head = el('div');
  head.append(el('strong', 'r', `${r.rating}`), ` · score ${r.score}/100 · ${r.entropy_bits} bits · guessed in ${r.crack_time}`);
  const meter = el('div', 'meter'); const bar = el('span'); bar.style.width = r.score + '%'; meter.append(bar);
  pwOut.append(head, meter);
  if (r.issues.length) { const ul = el('ul'); r.issues.forEach((i) => ul.append(el('li', '', i))); pwOut.append(ul); }
  if (r.suggestions.length) { const ul = el('ul'); r.suggestions.forEach((i) => ul.append(el('li', '', 'Tip: ' + i))); pwOut.append(ul); }
  if (window.crypto && crypto.subtle) {
    const parts = await sha1Parts(pw);
    if (ticket !== pwTicket) return;
    $('pw-hash').textContent = parts.hex;
    $('pw-prefix').textContent = parts.prefix;
  } else $('pw-hash').textContent = 'Needs a secure (https) page';
}
$('pw-in').addEventListener('input', runPassword);

/* ---------- authwatch ---------- */
const sshOut = $('ssh-out');
function runSsh() {
  sshOut.replaceChildren();
  const text = $('ssh-in').value;
  if (!text.trim()) return;
  const year = new Date().getFullYear();
  let events = parseLines(text, year);
  if (!events.length) { sshOut.append(el('p', 'pane-note', 'No SSH login lines found. Expected lines like: Nov  8 03:12:01 web01 sshd[3101]: Failed password for root from 203.0.113.45 port 51234 ssh2')); return; }
  const trusted = $('ssh-ignore').value.split(',').map((s) => s.trim()).filter(Boolean);
  if (trusted.length) {
    const ex = excludeIps(events, trusted);
    if (!ex.ok) { sshOut.append(el('p', 'pane-note', ex.error)); return; }
    events = ex.events;
  }
  const threshold = Math.max(1, parseInt($('ssh-threshold').value, 10) || 5);
  const window_ = Math.max(1, parseInt($('ssh-window').value, 10) || 300);
  const alerts = detect(events, { threshold, window: window_ });
  const failed = events.filter((e) => e.kind === 'failed').length;
  sshOut.append(el('p', 'pane-note', `${events.length} login events (${failed} failed, ${events.length - failed} accepted) from ${new Set(events.map((e) => e.ip)).size} addresses. ${alerts.length ? alerts.length + ' flagged:' : 'Nothing flagged.'}`));
  for (const a of alerts) {
    const box = el('div', 'alert ' + a.severity);
    const title = el('div'); title.append(el('b', '', `${a.severity} · ${a.kind.replace(/_/g, ' ')}`), ` · ${a.ip}`);
    box.append(title, el('div', '', a.detail), el('small', '', `users: ${a.users.join(', ')} · ${a.first_seen.replace('T', ' ')} to ${a.last_seen.replace('T', ' ')}`));
    sshOut.append(box);
  }
}
['ssh-in', 'ssh-threshold', 'ssh-window', 'ssh-ignore'].forEach((id) => $(id).addEventListener('input', runSsh));
$('ssh-sample').addEventListener('click', async () => {
  try { $('ssh-in').value = await (await fetch('lab/sample-auth.log')).text(); } catch { $('ssh-in').value = ''; }
  runSsh();
});

/* ---------- ML playground ---------- */
const canvas = $('ml-canvas');
const ctx = canvas.getContext('2d');
const COLORS = ['#38bdf8', '#00ffa3', '#ffb86b'];
const W = canvas.width, H = canvas.height, CELL = 10;
let points = []; // {x, y, c} in 0..1
let cls = 0;

function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function exampleData() {
  const r = seeded(11); const out = [];
  [[0.25, 0.3], [0.75, 0.35], [0.5, 0.78]].forEach(([cx, cy], c) => {
    for (let i = 0; i < 16; i++) out.push({ x: Math.min(1, Math.max(0, cx + (r() + r() + r() - 1.5) * 0.18)), y: Math.min(1, Math.max(0, cy + (r() + r() + r() - 1.5) * 0.18)), c });
  });
  return out;
}

function drawMl() {
  const mode = $('ml-mode').value;
  const k = +$('ml-k').value;
  $('ml-k-out').textContent = k;
  $('ml-k-label').textContent = mode === 'knn' ? 'k (neighbours)' : 'k (clusters)';
  $('ml-classes').hidden = mode === 'kmeans';
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#070b14'; ctx.fillRect(0, 0, W, H);
  const X = points.map((p) => [p.x, p.y]);
  let status = '';
  if (mode === 'knn') {
    const y = points.map((p) => p.c);
    if (new Set(y).size >= 2) {
      const cells = [], qs = [];
      for (let gy = 0; gy < H / CELL; gy++) for (let gx = 0; gx < W / CELL; gx++) { qs.push([(gx + 0.5) * CELL / W, (gy + 0.5) * CELL / H]); cells.push([gx, gy]); }
      const pred = knnPredict(X, y, k, qs);
      ctx.globalAlpha = 0.18;
      pred.forEach((c, i) => { ctx.fillStyle = COLORS[c]; ctx.fillRect(cells[i][0] * CELL, cells[i][1] * CELL, CELL, CELL); });
      ctx.globalAlpha = 1;
      status = `k-NN with k=${Math.min(k, points.length)}: each region shows the class a new point there would get.`;
    } else status = 'Click to add points of at least two different classes (A, B, C), or press "Example data".';
    points.forEach((p) => dot(p.x, p.y, COLORS[p.c]));
  } else {
    const res = points.length >= k ? kmeans(X, k, { seed: 3 }) : null;
    if (res) {
      res.labels.forEach((l, i) => dot(points[i].x, points[i].y, COLORS[l % 3] || '#e2e8f0'));
      res.centers.forEach((c) => { ctx.strokeStyle = '#ff6b81'; ctx.lineWidth = 3; const x = c[0] * W, y = c[1] * H; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y + 8); ctx.moveTo(x + 8, y - 8); ctx.lineTo(x - 8, y + 8); ctx.stroke(); });
      status = `k-means with k=${k}: crosses are the cluster centres, inertia ${res.inertia.toFixed(3)}. The colours are found without using the A/B/C labels.`;
    } else { points.forEach((p) => dot(p.x, p.y, '#94a3b8')); status = `Click to add at least ${k} points, or press "Example data".`; }
  }
  $('ml-status').textContent = status;
}
function dot(x, y, color) { ctx.beginPath(); ctx.arc(x * W, y * H, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#05070d'; ctx.lineWidth = 1.5; ctx.stroke(); }
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  points.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, c: cls });
  drawMl();
});
document.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
  cls = +b.dataset.cls;
  document.querySelectorAll('.swatch').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
}));
$('ml-example').addEventListener('click', () => { points = exampleData(); drawMl(); });
$('ml-clear').addEventListener('click', () => { points = []; drawMl(); });
$('ml-mode').addEventListener('change', () => { $('ml-k').max = $('ml-mode').value === 'knn' ? 9 : 5; if ($('ml-mode').value === 'kmeans') $('ml-k').value = 3; drawMl(); });
$('ml-k').addEventListener('input', drawMl);
points = exampleData();
