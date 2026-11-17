/**
 * Hashing helpers. SHA-1/256/384/512 use the browser's Web Crypto API.
 * MD5 is not offered by Web Crypto, so it is implemented here (RFC 1321).
 * MD5 and SHA-1 are broken for security purposes; they are included for
 * checksums and compatibility only.
 */

export const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

export function utf8(text) {
  return new TextEncoder().encode(text);
}

export function toHex(bytes) {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const CONSTANTS = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

const rotl = (x, s) => ((x << s) | (x >>> (32 - s))) >>> 0;

/** MD5 of a string (UTF-8) or Uint8Array, as a lowercase hex string. */
export function md5(input) {
  const data = typeof input === 'string' ? utf8(input) : input;
  const length = data.length;
  const total = (((length + 8) >>> 6) + 1) << 6;
  const padded = new Uint8Array(total);
  padded.set(data);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(total - 8, (length << 3) >>> 0, true);
  view.setUint32(total - 4, Math.floor(length / 0x20000000) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < total; offset += 64) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + CONSTANTS[i] + view.getUint32(offset + g * 4, true)) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(f, SHIFTS[i])) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((word, k) => outView.setUint32(k * 4, word, true));
  return toHex(out);
}

/** Hash text (UTF-8) with one of ALGORITHMS and return lowercase hex. */
export async function hashText(algorithm, text) {
  if (algorithm === 'MD5') return md5(text);
  if (!ALGORITHMS.includes(algorithm)) throw new Error(`Unsupported algorithm: ${algorithm}`);
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) {
    throw new Error('Web Crypto is not available here. Open the page over https:// or from localhost.');
  }
  return toHex(new Uint8Array(await subtle.digest(algorithm, utf8(text))));
}

/** Hash text with every algorithm. Algorithms that fail map to an Error. */
export async function hashAll(text) {
  const result = {};
  for (const algorithm of ALGORITHMS) {
    try {
      result[algorithm] = await hashText(algorithm, text);
    } catch (err) {
      result[algorithm] = err;
    }
  }
  return result;
}
