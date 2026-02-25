const { randomUUID, scryptSync, timingSafeEqual } = require('node:crypto');
const { loadKV, canUseKV, tryKV } = require('./kv-safe');

const kv = loadKV();
const mem = globalThis.__tcg_auth_store || { users: new Map(), sessions: new Map() };
globalThis.__tcg_auth_store = mem;

const USER_PREFIX = 'tcg:user:';
const SESSION_PREFIX = 'tcg:session:';
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

function hasKV() { return canUseKV(kv); }
function userKey(username) { return USER_PREFIX + username; }
function sessionKey(token) { return SESSION_PREFIX + token; }

function normalizeUsername(v) {
  return String(v || '').trim().toLowerCase();
}

function hashPassword(password, salt = randomUUID()) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, packed) {
  const [salt, hex] = String(packed || '').split(':');
  if (!salt || !hex) return false;
  const got = scryptSync(String(password), salt, 64);
  const exp = Buffer.from(hex, 'hex');
  if (got.length !== exp.length) return false;
  return timingSafeEqual(got, exp);
}

async function getUser(username) {
  const u = normalizeUsername(username);
  if (!u) return null;
  if (hasKV()) return tryKV(() => kv.get(userKey(u)), () => mem.users.get(u) || null);
  return mem.users.get(u) || null;
}

async function createUser(username, password, displayName = '') {
  const u = normalizeUsername(username);
  if (!u || u.length < 3) return { ok: false, error: 'username too short' };
  if (!/^[a-z0-9_]{3,24}$/.test(u)) return { ok: false, error: 'username format invalid (a-z0-9_)' };
  const p = String(password || '');
  if (p.length < 8) return { ok: false, error: 'password too short (min 8)' };
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return { ok: false, error: 'password must include letters and numbers' };
  const exists = await getUser(u);
  if (exists) return { ok: false, error: 'username already exists' };
  const dn = String(displayName || '').trim().slice(0, 24) || u;
  const user = { username: u, displayName: dn, passwordHash: hashPassword(password), createdAt: Date.now() };
  if (hasKV()) await tryKV(() => kv.set(userKey(u), user), () => mem.users.set(u, user));
  else mem.users.set(u, user);
  return { ok: true, user: { username: u, displayName: dn } };
}

async function verifyUser(username, password) {
  const user = await getUser(username);
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? { username: user.username, displayName: user.displayName || user.username } : null;
}

async function getUserPublic(username) {
  const user = await getUser(username);
  if (!user) return null;
  return { username: user.username, displayName: user.displayName || user.username };
}

async function createSession(username) {
  const token = randomUUID() + randomUUID();
  const payload = { username: normalizeUsername(username), createdAt: Date.now() };
  if (hasKV()) await tryKV(() => kv.set(sessionKey(token), payload, { ex: SESSION_TTL_SEC }), () => mem.sessions.set(token, payload));
  else mem.sessions.set(token, payload);
  return token;
}

async function getSession(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  if (hasKV()) return tryKV(() => kv.get(sessionKey(t)), () => mem.sessions.get(t) || null);
  return mem.sessions.get(t) || null;
}

async function deleteSession(token) {
  const t = String(token || '').trim();
  if (!t) return;
  if (hasKV() && typeof kv.del === 'function') await tryKV(() => kv.del(sessionKey(t)), () => mem.sessions.delete(t));
  else mem.sessions.delete(t);
}

module.exports = { normalizeUsername, createUser, verifyUser, getUserPublic, createSession, getSession, deleteSession };
