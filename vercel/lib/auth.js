const { getSession } = require('./auth-store');

const COOKIE_NAME = 'bp_session';

function parseCookies(req) {
  const raw = String(req.headers?.cookie || '');
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    const v = decodeURIComponent(part.slice(i + 1).trim());
    out[k] = v;
  }
  return out;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function getAuthUser(req) {
  const token = parseCookies(req)[COOKIE_NAME] || '';
  const sess = await getSession(token);
  if (!sess?.username) return null;
  return { username: sess.username, token };
}

async function requireAuth(req, res, send) {
  const user = await getAuthUser(req);
  if (!user) {
    send(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  return user;
}

module.exports = { COOKIE_NAME, parseCookies, setSessionCookie, clearSessionCookie, getAuthUser, requireAuth };
