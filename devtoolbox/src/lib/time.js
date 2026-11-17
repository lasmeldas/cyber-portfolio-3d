/** Timestamp conversion: epoch numbers and ISO 8601 dates, both ways. */

const MAX_MS = 8.64e15; // the range of a JavaScript Date

/**
 * Reads an epoch number. The unit is guessed from the size:
 * under 1e11 = seconds, under 1e14 = milliseconds, under 1e17 = microseconds,
 * otherwise nanoseconds. Decimals are allowed (1700000000.5).
 */
export function parseEpoch(input) {
  const text = String(input).trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return { ok: false, error: 'Not a number' };
  const value = Number(text);
  const abs = Math.abs(value);
  let unit;
  let ms;
  if (abs < 1e11) {
    unit = 'seconds';
    ms = value * 1000;
  } else if (abs < 1e14) {
    unit = 'milliseconds';
    ms = value;
  } else if (abs < 1e17) {
    unit = 'microseconds';
    ms = value / 1000;
  } else {
    unit = 'nanoseconds';
    ms = value / 1e6;
  }
  ms = Math.round(ms);
  if (Math.abs(ms) > MAX_MS) return { ok: false, error: 'That is outside the range of dates JavaScript can represent' };
  return { ok: true, ms, unit };
}

function daysInMonth(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Reads an ISO 8601 date or date-time such as 2024-02-29, 2024-02-29T10:30:00Z
 * or 2024-02-29 10:30:00+03:00. Without an offset the time is taken as UTC.
 */
export function parseIsoDate(input) {
  const m = ISO.exec(String(input).trim());
  if (!m) return { ok: false, error: 'Not a recognised date. Use a format like 2024-02-29T10:30:00Z' };
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const hour = m[4] === undefined ? 0 : Number(m[4]);
  const minute = m[5] === undefined ? 0 : Number(m[5]);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const millis = m[7] === undefined ? 0 : Number(m[7].padEnd(3, '0').slice(0, 3));

  if (month < 1 || month > 12) return { ok: false, error: `Month ${month} does not exist` };
  if (day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, error: `Day ${day} does not exist in ${String(year).padStart(4, '0')}-${m[2]}` };
  }
  if (hour > 23 || minute > 59 || second > 59) return { ok: false, error: 'The time of day is out of range' };

  let offsetMinutes = 0;
  if (m[8] && m[8].toUpperCase() !== 'Z') {
    const digits = m[8].slice(1).replace(':', '');
    const oh = Number(digits.slice(0, 2));
    const om = digits.length > 2 ? Number(digits.slice(2)) : 0;
    if (oh > 23 || om > 59) return { ok: false, error: 'The UTC offset is out of range' };
    offsetMinutes = (m[8][0] === '-' ? -1 : 1) * (oh * 60 + om);
  }

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);
  const ms = date.getTime() - offsetMinutes * 60000;
  if (Number.isNaN(ms) || Math.abs(ms) > MAX_MS) return { ok: false, error: 'That date is out of range' };
  return { ok: true, ms };
}

/** Accepts either an epoch number or an ISO date. */
export function parseTimestampInput(input) {
  const text = String(input).trim();
  if (!text) return { ok: false, error: 'Enter an epoch time or an ISO date' };
  if (/^[+-]?\d+(\.\d+)?$/.test(text)) {
    const epoch = parseEpoch(text);
    return epoch.ok ? { ...epoch, kind: 'epoch' } : epoch;
  }
  const date = parseIsoDate(text);
  return date.ok ? { ...date, kind: 'date', unit: 'ISO date' } : date;
}

/** "2 hours ago", "in 3 days", "now". */
export function relativeTime(ms, nowMs = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  const units = [
    ['year', 365 * 86400000],
    ['month', 30 * 86400000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.trunc(diff / size), unit);
  }
  return rtf.format(0, 'second');
}

/** All the ways to show one instant. `timeZone` defaults to the viewer's own. */
export function describeTimestamp(ms, { nowMs = Date.now(), timeZone } = {}) {
  const date = new Date(ms);
  const format = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
    timeZone,
  });
  return {
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: format.format(date),
    timeZone: format.resolvedOptions().timeZone,
    relative: relativeTime(ms, nowMs),
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
  };
}
