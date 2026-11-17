/**
 * JSON Web Token helpers.
 *
 * IMPORTANT: decoding a token only reads it. It does NOT prove the token is
 * genuine. Only a signature check with the right key does that, and this
 * module can only check HS256 (HMAC-SHA-256) signatures.
 */

import { base64ToBytes, bytesToBase64 } from './base64.js';

const encoder = new TextEncoder();

function decodeJsonPart(part, label) {
  const bytes = base64ToBytes(part);
  if (!bytes.ok) return { ok: false, error: `The ${label} is not valid Base64URL: ${bytes.error}` };
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.bytes);
  } catch {
    return { ok: false, error: `The ${label} is not valid UTF-8 text` };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: `The ${label} is not valid JSON` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: `The ${label} must be a JSON object` };
  }
  return { ok: true, value };
}

/** Splits and decodes a token. A leading "Bearer " is ignored. */
export function decodeJwt(token) {
  const trimmed = String(token).trim().replace(/^bearer\s+/i, '');
  if (!trimmed) return { ok: false, error: 'Paste a token to decode it' };
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: `A JWT has 3 dot-separated parts, but this has ${parts.length}` };
  }
  const header = decodeJsonPart(parts[0], 'header');
  if (!header.ok) return header;
  const payload = decodeJsonPart(parts[1], 'payload');
  if (!payload.ok) return payload;
  return {
    ok: true,
    header: header.value,
    payload: payload.value,
    signature: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
    algorithm: typeof header.value.alg === 'string' ? header.value.alg : undefined,
  };
}

function relative(deltaSeconds) {
  const abs = Math.abs(deltaSeconds);
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [name, size] of units) {
    if (abs >= size || name === 'second') {
      const n = Math.floor(abs / size);
      return `${n} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return '0 seconds';
}

/** Explains the registered time claims (exp, nbf, iat) in human terms. */
export function describeClaims(payload, nowMs = Date.now()) {
  const nowSeconds = nowMs / 1000;
  const rows = [];
  for (const name of ['exp', 'nbf', 'iat']) {
    if (!(name in payload)) continue;
    const value = payload[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      rows.push({ name, value, error: 'must be a number of seconds since 1970' });
      continue;
    }
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) {
      rows.push({ name, value, error: 'is outside the range of valid dates' });
      continue;
    }
    const delta = value - nowSeconds;
    let status;
    if (name === 'exp') {
      status = delta <= 0 ? `expired ${relative(delta)} ago` : `valid for another ${relative(delta)}`;
    } else if (name === 'nbf') {
      status = delta > 0 ? `not valid yet (starts in ${relative(delta)})` : 'already active';
    } else {
      status = delta > 0 ? `issued in the future (${relative(delta)} from now)` : `issued ${relative(delta)} ago`;
    }
    rows.push({
      name,
      value,
      iso: date.toISOString(),
      status,
      expired: name === 'exp' ? delta <= 0 : undefined,
    });
  }
  return rows;
}

async function hmacSha256(secret, message) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('Web Crypto is not available here. Open the page over https:// or from localhost.');
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(message)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks an HS256 signature. Returns { ok: true, valid } or { ok: false, error }. */
export async function verifyHs256(token, secret) {
  const decoded = decodeJwt(token);
  if (!decoded.ok) return decoded;
  if (decoded.algorithm !== 'HS256') {
    return {
      ok: false,
      error: `The header says alg is ${JSON.stringify(decoded.algorithm ?? null)}; only HS256 can be checked here`,
    };
  }
  try {
    const expected = bytesToBase64(await hmacSha256(secret, decoded.signingInput), { urlSafe: true, pad: false });
    return { ok: true, valid: safeEqual(expected, decoded.signature) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Builds a signed HS256 token (used for tests and examples). */
export async function signHs256(header, payload, secret) {
  const encode = (obj) => bytesToBase64(encoder.encode(JSON.stringify(obj)), { urlSafe: true, pad: false });
  const signingInput = `${encode({ alg: 'HS256', typ: 'JWT', ...header })}.${encode(payload)}`;
  const signature = bytesToBase64(await hmacSha256(secret, signingInput), { urlSafe: true, pad: false });
  return `${signingInput}.${signature}`;
}
