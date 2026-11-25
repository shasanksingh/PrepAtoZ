import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { database, configured } from './db.mjs';
import { digest, token, hashSecret, checkSecret, normalizeAnswer } from './crypto.mjs';
import privateData from './private-data.json' with { type: 'json' };
import study from '../dist/study-tools.js';

const COOKIE = 'prepatoz_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const QUESTIONS = new Set(['memory', 'place', 'phrase']);
const ownerEmail = () => (process.env.PREPATOZ_ADMIN_EMAIL || 'singhshasank50@gmail.com').trim().toLowerCase();
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role });
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
function cookie(value, request, maxAge = SESSION_MS / 1000) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function sessionToken(request) {
  const value = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return value && /^[\w-]{43}$/.test(value) ? value : null;
}
async function currentUser(request, db) {
  const value = sessionToken(request); if (!value) return null;
  const [user] = await db.query('SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_ms>?', [digest(value), Date.now()]);
  return user || null;
}
async function throttle(db, key, limit, windowMs) {
  const now = Date.now();
  const [row] = await db.query(`INSERT INTO rate_limits(key,hits,reset_ms) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN reset_ms<=? THEN 1 ELSE hits+1 END,reset_ms=CASE WHEN reset_ms<=? THEN ? ELSE reset_ms END RETURNING hits`, [digest(key), now + windowMs, now, now, now + windowMs]);
  if (Number(row.hits) > limit) fail(429, 'Too many attempts. Please try again later.');
}
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Send JSON data.');
  if (Number(request.headers.get('content-length') || 0) > 300000) fail(413, 'This request is too large.');
  const raw = await request.text(); if (Buffer.byteLength(raw) > 300000) fail(413, 'This request is too large.');
  try { const value = JSON.parse(raw); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value; }
  catch { fail(400, 'Invalid request data.'); }
}
function email(value) {
  const result = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (result.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'Enter a valid email address.');
  return result;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 256) fail(400, 'Use a password between 12 and 256 characters.');
  return value;
}
async function startSession(db, user, request) {
  const value = token();
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_ms) VALUES (?,?,?)', [digest(value), user.id, Date.now() + SESSION_MS]);
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': cookie(value, request) });
}
function cleanProgress(value, admin) {
  if (!value || value.version !== 2 || !value.questions || Array.isArray(value.questions) || typeof value.questions !== 'object') fail(400, 'Invalid progress backup.');
  const blocked = new Set(privateData.protectedIds);
  const questions = {};
  for (const [id, entry] of Object.entries(value.questions).slice(0, 1000)) {
    if (!/^[a-z][\w-]{1,80}$/.test(id) || !entry || typeof entry !== 'object' || !admin && blocked.has(id)) continue;
    questions[id] = { learned: entry.learned === true, bookmarked: entry.bookmarked === true, rating: ['ready', 'review'].includes(entry.rating) ? entry.rating : null, note: typeof entry.note === 'string' ? entry.note.slice(0, 20000) : '' };
  }
  const last = typeof value.last === 'string' && !(!admin && blocked.has(value.last)) ? value.last.slice(0, 100) : null;
  const quizzes = {};
  if(value.quizzes && typeof value.quizzes === 'object' && !Array.isArray(value.quizzes)) for(const [key,score] of Object.entries(value.quizzes).slice(0,40)) {
    if(/^[a-z][a-z0-9-]{0,40}$/.test(key) && Number.isFinite(score)) quizzes[key]=Math.max(0,Math.min(100,score));
  }
  const today=study.shift(study.dayKey(),1),days=study.cleanDays(value.activity?.days,today);
  const result = { version: 2, questions, last, quizzes, activity: {days,daily:study.cleanDays(value.activity?.daily,today).filter(day=>days.includes(day))} };
  if (Buffer.byteLength(JSON.stringify(result)) > 250000) fail(413, 'Progress exceeds 250 KB. Export older notes or shorten them.');
  return result;
}
export async function handleApi(request, context = {}) {
  try {
    const path = new URL(request.url).pathname.replace(/^\/(?:\.netlify\/functions\/api|api)\/?/, '').replace(/\/$/, '');
    if (!['GET', 'POST', 'PUT'].includes(request.method)) fail(405, 'Method not allowed.');
    if (request.method !== 'GET') {
      if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'This request must come from PrepAtoZ.');
    }
    if (path === 'session' && request.method === 'GET' && !configured()) return json({ user: null, accountsAvailable: false });
    const db = await database(), user = await currentUser(request, db);
    if (path === 'session' && request.method === 'GET') return json({ user: user ? publicUser(user) : null, accountsAvailable: true });
    const ip = context.ip || 'local';
    if (path === 'auth/register' && request.method === 'POST') {
      await throttle(db, 'register:' + ip, 6, 3600000);
      const body = await readBody(request), address = email(body.email), secret = password(body.password);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const answer = normalizeAnswer(body.answer);
      if (name.length < 2 || name.length > 60 || !QUESTIONS.has(body.question) || answer.length < 8 || answer.length > 200) fail(400, 'Enter your name, a recovery question and an answer of at least 8 characters.');
      if (address === ownerEmail()) fail(409, 'This address is reserved. Please sign in.');
      const id = randomUUID();
      const [pwHash, recoveryHash] = await Promise.all([hashSecret(secret), hashSecret(answer)]);
      try { await db.query('INSERT INTO users(id,email,name,password_hash,role,recovery_question,recovery_hash,created_ms) VALUES (?,?,?,?,?,?,?,?)', [id, address, name, pwHash, 'user', body.question, recoveryHash, Date.now()]); }
      catch (error) { if (/unique|constraint/i.test(error.message)) fail(409, 'Unable to register these details. Try signing in.'); throw error; }
      return startSession(db, { id, email: address, name, role: 'user' }, request);
    }
    if (path === 'auth/login' && request.method === 'POST') {
      const body = await readBody(request), address = email(body.email);
      if (typeof body.password !== 'string' || body.password.length > 256) fail(400, 'Enter your password.');
      await throttle(db, 'login-ip:' + ip, 30, 900000); await throttle(db, 'login-user:' + address, 10, 900000);
      const [found] = await db.query('SELECT * FROM users WHERE email=?', [address]);
      if (!await checkSecret(body.password, found?.password_hash)) fail(401, 'Email or password is incorrect.');
      return startSession(db, found, request);
    }
    if (path === 'auth/reset' && request.method === 'POST') {
      const body = await readBody(request), address = email(body.email), next = password(body.password);
      await throttle(db, 'reset-ip:' + ip, 10, 3600000); await throttle(db, 'reset-user:' + address, 5, 3600000);
      const [found] = await db.query('SELECT * FROM users WHERE email=?', [address]);
      const match = await checkSecret(normalizeAnswer(body.answer).slice(0, 200), found?.recovery_hash);
      if (!found || found.role === 'admin' || !QUESTIONS.has(body.question) || found.recovery_question !== body.question || !match) fail(400, 'Recovery details could not be verified. Admin recovery is handled by the owner.');
      const nextHash = await hashSecret(next);
      await db.batch([{ sql: 'UPDATE users SET password_hash=? WHERE id=?', args: [nextHash, found.id] }, { sql: 'DELETE FROM sessions WHERE user_id=?', args: [found.id] }]);
      return json({ message: 'Password reset. Please sign in with your new password.' }, 200, { 'Set-Cookie': cookie('', request, 0) });
    }
    if (path === 'auth/logout' && request.method === 'POST') {
      const value = sessionToken(request); if (value) await db.query('DELETE FROM sessions WHERE token_hash=?', [digest(value)]);
      return json({ user: null }, 200, { 'Set-Cookie': cookie('', request, 0) });
    }
    if (path === 'progress') {
      if (!user) fail(401, 'Please sign in to sync progress.');
      if (request.method === 'GET') { const [row] = await db.query('SELECT body,revision FROM progress WHERE user_id=?', [user.id]); return json({ progress: row ? JSON.parse(row.body) : null, revision: Number(row?.revision || 0) }); }
      if (request.method === 'PUT') {
        const body = await readBody(request), clean = cleanProgress(body.progress, user.role === 'admin');
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid progress revision.');
        const [row] = body.revision === 0
          ? await db.query('INSERT INTO progress(user_id,body,revision,updated_ms) VALUES (?,?,1,?) ON CONFLICT(user_id) DO NOTHING RETURNING revision', [user.id, JSON.stringify(clean), Date.now()])
          : await db.query('UPDATE progress SET body=?,revision=revision+1,updated_ms=? WHERE user_id=? AND revision=? RETURNING revision', [JSON.stringify(clean), Date.now(), user.id, body.revision]);
        if (!row) fail(409, 'Progress changed in another tab. Reload before syncing again.');
        return json({ revision: Number(row.revision) });
      }
    }
    if (path === 'admin/content' && request.method === 'GET') {
      if (!user) fail(401, 'Sign in to continue.'); if (user.role !== 'admin') fail(403, 'Administrator access is required.');
      return json(privateData);
    }
    if (path.startsWith('admin/pdf/') && request.method === 'GET') {
      if (!user) fail(401, 'Sign in to continue.'); if (user.role !== 'admin') fail(403, 'Administrator access is required.');
      const id = decodeURIComponent(path.slice('admin/pdf/'.length));
      const topic = privateData.topics.find(t => t.id === id);
      if (!topic?.privatePdf) fail(404, 'Guide not found.');
      const bytes = await readFile(resolve(process.cwd(), 'private/pdfs', topic.privatePdf));
      return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${topic.privatePdf.replace(/[^a-zA-Z0-9 ._-]/g, '')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    fail(404, 'Not found.');
  } catch (error) {
    if (!error.status) console.error('PrepAtoZ API failure:', error.name, error.code || 'internal');
    return json({ error: error.status ? error.message : 'The service is temporarily unavailable. Please try again.' }, error.status || 503);
  }
}
