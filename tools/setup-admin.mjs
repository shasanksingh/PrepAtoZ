import readline from 'node:readline';
import { Writable } from 'node:stream';
import { readFile, writeFile } from 'node:fs/promises';
import { hashSecret } from '../server/crypto.mjs';
import { database } from '../server/db.mjs';

let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const input = readline.createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
const ask = prompt => new Promise(resolve => { process.stdout.write(prompt); input.question('', resolve); });
async function secret(prompt) { muted = true; const value = await ask(prompt); muted = false; process.stdout.write('\n'); return value; }
try {
  console.log('PrepAtoZ administrator setup. Password input is hidden.');
  const address = (await ask('Admin email [singhshasank50@gmail.com]: ')).trim().toLowerCase() || 'singhshasank50@gmail.com';
  const password = await secret('Choose an admin password (at least 12 characters): ');
  const confirmation = await secret('Confirm password: ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || password.length < 12 || password.length > 256 || password !== confirmation) throw Error('Invalid email, short password or confirmation mismatch. Nothing was changed.');
  const hash = await hashSecret(password);
  let env = ''; try { env = await readFile('.env', 'utf8'); } catch {}
  for (const [key, value] of Object.entries({ PREPATOZ_ADMIN_EMAIL: address, PREPATOZ_ADMIN_PASSWORD_HASH: hash })) {
    const line = key + '=' + value;
    env = new RegExp('^' + key + '=.*$', 'm').test(env) ? env.replace(new RegExp('^' + key + '=.*$', 'm'), line) : env.trimEnd() + '\n' + line + '\n';
    process.env[key] = value;
  }
  await writeFile('.env', env.trimStart(), { mode: 0o600 });
  console.log('Saved the administrator email and password hash in the ignored .env file.');
  if (!process.env.NETLIFY) { try { process.loadEnvFile('.env'); } catch {} const db = await database(); await db.batch([{ sql: 'UPDATE users SET password_hash=?,role=? WHERE email=?', args: [hash, 'admin', address] }, { sql: 'DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)', args: [address] }]); }
  console.log('For Netlify, add the two PREPATOZ_ADMIN_* values from .env to Functions environment variables, plus TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Keep these values private. Then redeploy.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { input.close(); }
