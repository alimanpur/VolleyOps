import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';

/**
 * Access-code helpers. Codes are shown to a human once and never stored in
 * plaintext — we keep only a SHA-256 hash. Comparison is constant-time.
 *
 * Format: XXXX-XXXX using an unambiguous alphabet (no 0/O/1/I) so codes are
 * easy to read off a screen and type on a phone.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const nano = customAlphabet(ALPHABET, 8);

export function generateAccessCode() {
  const raw = nano();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function verifyCode(code, hash) {
  if (!code || !hash) return false;
  const candidate = Buffer.from(hashCode(code));
  const expected = Buffer.from(hash);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}
