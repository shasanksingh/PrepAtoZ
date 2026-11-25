import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
let ready;

export const configured = () => Boolean(process.env.TURSO_DATABASE_URL) || !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME;
export function database() {
  if (!ready) ready = open().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function open() {
  if (!configured()) throw Object.assign(new Error('Account storage has not been connected yet.'), { status: 503 });
  let db;
  if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = await import('@libsql/client/web');
    const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    db = {
      async query(sql, args = []) { return (await client.execute({ sql, args })).rows; },
      async batch(statements) { return client.batch(statements, 'write'); }
    };
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const filename = resolve(process.env.PREPATOZ_DB_FILE || '.local/prepatoz.sqlite');
    mkdirSync(dirname(filename), { recursive: true });
    const local = new DatabaseSync(filename);
    local.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    db = {
      async query(sql, args = []) {
        const statement = local.prepare(sql);
        return statement.columns().length ? statement.all(...args) : (statement.run(...args), []);
      },
      async batch(statements) {
        local.exec('BEGIN IMMEDIATE');
        try { for (const { sql, args = [] } of statements) await db.query(sql, args); local.exec('COMMIT'); }
        catch (error) { local.exec('ROLLBACK'); throw error; }
      }
    };
  }
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')), recovery_question TEXT, recovery_hash TEXT, created_ms INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_ms INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_ms)`,
    `CREATE TABLE IF NOT EXISTS progress (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_ms INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_ms INTEGER NOT NULL)`
  ]) await db.query(sql);
  await db.query('DELETE FROM sessions WHERE expires_ms < ?', [Date.now()]);
  await db.query('DELETE FROM rate_limits WHERE reset_ms < ?', [Date.now()]);
  const email = (process.env.PREPATOZ_ADMIN_EMAIL || 'singhshasank50@gmail.com').trim().toLowerCase();
  const hash = process.env.PREPATOZ_ADMIN_PASSWORD_HASH;
  if (hash && /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash)) {
    await db.query(`INSERT INTO users (id,email,name,password_hash,role,created_ms) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING`, ['owner-admin', email, 'Shashank', hash, 'admin', Date.now()]);
    const [owner] = await db.query('SELECT id,password_hash,role FROM users WHERE email=?', [email]);
    if (owner && (owner.password_hash !== hash || owner.role !== 'admin')) {
      await db.batch([{ sql: 'UPDATE users SET password_hash=?,role=? WHERE id=?', args: [hash, 'admin', owner.id] }, { sql: 'DELETE FROM sessions WHERE user_id=?', args: [owner.id] }]);
    }
  }
  return db;
}
