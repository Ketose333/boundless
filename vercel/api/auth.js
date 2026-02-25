const { send, parseBody } = require('../lib/http');
const { createUser, verifyUser, createSession, deleteSession, getUserPublic } = require('../lib/auth-store');
const { getAuthUser, setSessionCookie, clearSessionCookie } = require('../lib/auth');

module.exports = async (req, res) => {
  const action = String((req.query && req.query.action) || '').trim();

  if (req.method === 'GET') {
    if (action !== 'me') return send(res, 400, { ok: false, error: 'action required' });
    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { ok: false, error: 'unauthorized' });
    const profile = await getUserPublic(user.username);
    return send(res, 200, { ok: true, user: profile || { username: user.username, displayName: user.username } });
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    if (action === 'register') {
      const created = await createUser(body.username, body.password, body.displayName);
      if (!created.ok) return send(res, 400, { ok: false, error: created.error });
      const token = await createSession(created.user.username);
      setSessionCookie(res, token);
      return send(res, 200, { ok: true, user: created.user });
    }
    if (action === 'login') {
      const user = await verifyUser(body.username, body.password);
      if (!user) return send(res, 401, { ok: false, error: 'invalid credentials' });
      const token = await createSession(user.username);
      setSessionCookie(res, token);
      return send(res, 200, { ok: true, user });
    }
    if (action === 'logout') {
      const user = await getAuthUser(req);
      if (user?.token) await deleteSession(user.token);
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { ok: false, error: 'unsupported action' });
  }

  return send(res, 405, { ok: false, error: 'method not allowed' });
};
