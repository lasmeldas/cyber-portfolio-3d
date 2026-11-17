// JavaScript port of authwatch's parser and detector (authwatch/parser.py, detector.py).
// Parity with the Python version is checked by tests/lab.test.mjs.

const LINE = /^(?<ts>[A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s+(?<host>\S+)\s+sshd(?:\[\d+\])?:\s+(?<msg>.*)$/;
const FAILED = /^Failed (?<method>\S+) for (?<invalid>invalid user )?(?<user>\S+) from (?<ip>[0-9A-Fa-f.:]+) port \d+/;
const ACCEPTED = /^Accepted (?<method>\S+) for (?<user>\S+) from (?<ip>[0-9A-Fa-f.:]+) port \d+/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };

/** Seconds since the epoch for a syslog timestamp, or null when the date does not exist. */
function parseTime(ts, year) {
  const [mon, day, clock] = ts.trim().split(/\s+/);
  const month = MONTHS.indexOf(mon);
  const [h, m, s] = clock.split(':').map(Number);
  if (month < 0) return null;
  const d = new Date(Date.UTC(year, month, +day, h, m, s));
  if (d.getUTCMonth() !== month || d.getUTCDate() !== +day || h > 23 || m > 59 || s > 59) return null;
  return d.getTime() / 1000;
}

export function parseLine(line, year) {
  const match = LINE.exec(line.replace(/\n$/, ''));
  if (!match) return null;
  const time = parseTime(match.groups.ts, year);
  if (time === null) return null;
  const msg = match.groups.msg;
  let f = FAILED.exec(msg);
  if (f) return { time, kind: 'failed', user: f.groups.user, ip: f.groups.ip, method: f.groups.method, invalid: !!f.groups.invalid };
  f = ACCEPTED.exec(msg);
  if (f) return { time, kind: 'accepted', user: f.groups.user, ip: f.groups.ip, method: f.groups.method, invalid: false };
  return null;
}

export function parseLines(text, year) {
  return text.split('\n').map((l) => parseLine(l, year)).filter(Boolean);
}

export function isoTime(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 19);
}

function densestWindow(times, window) {
  let best = [0, 0, 0];
  let start = 0;
  for (let end = 0; end < times.length; end++) {
    while (times[end] - times[start] > window) start++;
    const count = end - start + 1;
    if (count > best[0]) best = [count, start, end];
  }
  return best;
}

const sortedUnique = (xs) => [...new Set(xs)].sort();

export function detect(events, { threshold = 5, window = 300, sprayUsers = 5 } = {}) {
  if (threshold < 1 || window < 1 || sprayUsers < 1) throw new Error('threshold, window and spray_users must be positive');
  const byIp = new Map();
  for (const e of events) { if (!byIp.has(e.ip)) byIp.set(e.ip, []); byIp.get(e.ip).push(e); }
  const alerts = [];
  for (const [ip, ipEvents] of byIp) {
    ipEvents.sort((a, b) => a.time - b.time); // stable, like Python's sort
    const failed = ipEvents.filter((e) => e.kind === 'failed');
    if (!failed.length) continue;
    const [count, start, end] = densestWindow(failed.map((e) => e.time), window);
    const burst = failed.slice(start, end + 1);
    let critical = null;
    for (const success of ipEvents.filter((e) => e.kind === 'accepted')) {
      const before = failed.filter((f) => success.time - f.time >= 0 && success.time - f.time <= window);
      if (before.length >= threshold) { critical = [success, before]; break; }
    }
    if (critical) {
      const [success, before] = critical;
      alerts.push({ severity: 'critical', kind: 'success_after_failures', ip, failures: before.length, users: sortedUnique(before.map((f) => f.user)),
        first_seen: isoTime(before[0].time), last_seen: isoTime(success.time),
        detail: `Login as '${success.user}' succeeded after ${before.length} failures within ${window}s. Treat the account as possibly compromised.` });
    } else if (count >= threshold) {
      const users = sortedUnique(burst.map((f) => f.user));
      const extra = users.length >= sprayUsers ? `, targeting ${users.length} different usernames` : '';
      alerts.push({ severity: 'high', kind: 'brute_force', ip, failures: count, users,
        first_seen: isoTime(burst[0].time), last_seen: isoTime(burst[burst.length - 1].time),
        detail: `${count} failed logins within ${window}s${extra}.` });
    } else {
      const users = sortedUnique(failed.map((f) => f.user));
      if (users.length >= sprayUsers) {
        alerts.push({ severity: 'medium', kind: 'username_spray', ip, failures: failed.length, users,
          first_seen: isoTime(failed[0].time), last_seen: isoTime(failed[failed.length - 1].time),
          detail: `${failed.length} failed logins spread over ${users.length} different usernames (slow spray, stays under the burst threshold).` });
      }
    }
  }
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.failures - a.failures || (a.ip < b.ip ? -1 : a.ip > b.ip ? 1 : 0));
  return alerts;
}

/** Drops events from trusted IPv4 addresses or CIDR ranges, such as "10.0.0.0/8" or "203.0.113.7". */
export function excludeIps(events, trusted) {
  const nets = trusted.map((t) => {
    const [addr, bits = '32'] = t.trim().split('/');
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => !(p >= 0 && p <= 255)) || !(+bits >= 0 && +bits <= 32)) return { error: t };
    const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    const mask = +bits === 0 ? 0 : (~0 << (32 - +bits)) >>> 0;
    return { n: (n & mask) >>> 0, mask };
  });
  const bad = nets.find((n) => n.error);
  if (bad) return { ok: false, error: `Not an IPv4 address or range: ${bad.error}` };
  const toInt = (ip) => {
    const p = ip.split('.').map(Number);
    return p.length === 4 && p.every((x) => x >= 0 && x <= 255) ? ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0 : null;
  };
  const kept = events.filter((e) => {
    const v = toInt(e.ip);
    return v === null || !nets.some((net) => ((v & net.mask) >>> 0) === net.n);
  });
  return { ok: true, events: kept };
}
