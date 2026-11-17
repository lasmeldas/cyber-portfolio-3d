/** Base64 and Base64URL encoding that is safe for any Unicode text. */

const STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Encodes bytes. `urlSafe` uses - and _ instead of + and /; `pad` adds trailing "=". */
export function bytesToBase64(bytes, { urlSafe = false, pad = true } = {}) {
  const alphabet = urlSafe ? URL_SAFE : STANDARD;
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += alphabet[n >> 18] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + alphabet[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += alphabet[n >> 18] + alphabet[(n >> 12) & 63] + (pad ? '==' : '');
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += alphabet[n >> 18] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + (pad ? '=' : '');
  }
  return out;
}

/**
 * Decodes Base64 or Base64URL (detected automatically). Whitespace is ignored
 * and missing padding is accepted. Returns { ok, bytes } or { ok: false, error }.
 */
export function base64ToBytes(input) {
  const cleaned = String(input).replace(/\s+/g, '');
  const body = cleaned.replace(/={1,2}$/, '');
  const padding = cleaned.length - body.length;

  const hasStandard = /[+/]/.test(body);
  const hasUrl = /[-_]/.test(body);
  if (hasStandard && hasUrl) {
    return { ok: false, error: 'Mixes standard (+ /) and URL-safe (- _) characters' };
  }
  const alphabet = hasUrl ? URL_SAFE : STANDARD;

  const lookup = new Map();
  for (let k = 0; k < alphabet.length; k++) lookup.set(alphabet[k], k);

  for (let k = 0; k < body.length; k++) {
    if (!lookup.has(body[k])) {
      const shown = body[k] === '=' ? 'an "=" in the middle' : `the character "${body[k]}"`;
      return { ok: false, error: `Invalid Base64: found ${shown} at position ${k + 1}` };
    }
  }
  if (body.length % 4 === 1) {
    return { ok: false, error: 'Invalid Base64 length: a single leftover character cannot be decoded' };
  }
  if (padding > 0 && cleaned.length % 4 !== 0) {
    return { ok: false, error: 'Incorrect padding: the length with "=" must be a multiple of 4' };
  }

  const bytes = new Uint8Array(Math.floor((body.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let k = 0; k < body.length; k++) {
    acc = (acc << 6) | lookup.get(body[k]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[o++] = (acc >> bits) & 0xff;
      acc &= (1 << bits) - 1;
    }
  }
  return { ok: true, bytes };
}

/** Encodes text as UTF-8 and then Base64. */
export function encodeText(text, options) {
  return bytesToBase64(new TextEncoder().encode(text), options);
}

/** Decodes Base64 and reads the bytes as UTF-8 text. */
export function decodeToText(input) {
  const result = base64ToBytes(input);
  if (!result.ok) return result;
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(result.bytes) };
  } catch {
    return { ok: false, error: 'The decoded bytes are not valid UTF-8 text (they may be binary data)' };
  }
}
