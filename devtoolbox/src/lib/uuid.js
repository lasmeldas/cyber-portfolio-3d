/** UUID generation (v4 and v7) and parsing. */

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function defaultRandom(length) {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function format(bytes) {
  const h = Array.from(bytes, (b) => HEX[b]);
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

/** A random (version 4) UUID. `random(n)` must return n random bytes. */
export function uuidv4(random = defaultRandom) {
  const bytes = Uint8Array.from(random(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return format(bytes);
}

/**
 * Creates a version 7 generator (RFC 9562): a 48-bit Unix millisecond
 * timestamp followed by random bits. A 12-bit counter keeps UUIDs made in the
 * same millisecond in increasing order; if it overflows, the timestamp moves
 * forward by one millisecond.
 */
export function createUuidv7Generator({ now = () => Date.now(), random = defaultRandom } = {}) {
  let lastMs = -1;
  let counter = 0;
  return function next() {
    const current = now();
    if (current > lastMs) {
      lastMs = current;
      const seed = random(2);
      counter = ((seed[0] << 8) | seed[1]) & 0x7ff; // start low to leave room to count up
    } else {
      counter++;
      if (counter > 0xfff) {
        lastMs++;
        counter = 0;
      }
    }
    const bytes = Uint8Array.from(random(16));
    let rest = lastMs;
    for (let i = 5; i >= 0; i--) {
      bytes[i] = rest % 256;
      rest = Math.floor(rest / 256);
    }
    bytes[6] = 0x70 | (counter >> 8);
    bytes[7] = counter & 0xff;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return format(bytes);
  };
}

const defaultV7 = createUuidv7Generator();

/** A time-ordered (version 7) UUID. */
export function uuidv7() {
  return defaultV7();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Reads a UUID (plain, in braces, or as a urn:uuid:) and explains its version and variant. */
export function parseUuid(input) {
  const cleaned = String(input)
    .trim()
    .replace(/^urn:uuid:/i, '')
    .replace(/^\{(.*)\}$/, '$1')
    .toLowerCase();
  if (!UUID_PATTERN.test(cleaned)) {
    return { ok: false, error: 'Not a UUID. Expected 8-4-4-4-12 hexadecimal digits' };
  }
  const hex = cleaned.replace(/-/g, '');
  const version = parseInt(hex[12], 16);
  const variantNibble = parseInt(hex[16], 16);
  let variant;
  if (variantNibble < 8) variant = 'NCS (reserved)';
  else if (variantNibble < 12) variant = 'RFC 4122 / RFC 9562';
  else if (variantNibble < 14) variant = 'Microsoft (reserved)';
  else variant = 'Reserved for the future';

  const result = { ok: true, normalized: cleaned, version, variant, special: null, timestampMs: null };
  if (cleaned === '00000000-0000-0000-0000-000000000000') result.special = 'nil UUID';
  if (cleaned === 'ffffffff-ffff-ffff-ffff-ffffffffffff') result.special = 'max UUID';
  if (version === 7 && variantNibble >= 8 && variantNibble < 12) {
    result.timestampMs = parseInt(hex.slice(0, 12), 16);
  }
  return result;
}
