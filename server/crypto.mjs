import { scrypt as derive, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const digest = text => createHash('sha256').update(text).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const normalizeAnswer = text => String(text || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
export async function hashSecret(value) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(value, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt}$${hash.toString('hex')}`;
}
export async function checkSecret(value, encoded) {
  const parts = (encoded || '').split('$');
  const valid = parts.length === 6 && parts[0] === 'scrypt' && parts[1] === '16384' && parts[2] === '8' && parts[3] === '1' && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{64}$/.test(parts[5]);
  const salt = valid ? parts[4] : '00000000000000000000000000000000';
  const calculated = await scrypt(String(value), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return valid && timingSafeEqual(calculated, Buffer.from(parts[5], 'hex'));
}
