const { send, parseBody } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');
const { createDeckPost, listDeckPosts, getDeckPost, deleteDeckPost, bumpMetric } = require('../../lib/deck-hub-store');
const { decodeDeckCodeSummary } = require('../../lib/deck-codec');

module.exports = async (req, res) => {
  try {
    const action = String((req.query && req.query.action) || '').trim();

    if (req.method === 'GET') {
    if (action === 'detail') {
      const id = String(req.query.id || '').trim();
      if (!id) return send(res, 400, { ok: false, error: 'id required' });
      const post = await getDeckPost(id);
      if (!post) return send(res, 404, { ok: false, error: 'not found' });
      return send(res, 200, { ok: true, post });
    }

    const q = String(req.query.q || '').trim();
    const sort = String(req.query.sort || 'latest').trim();
    const limit = Math.min(60, Math.max(1, Number(req.query.limit || 30)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const result = await listDeckPosts({ q, sort, limit, offset });
    return send(res, 200, { ok: true, ...result });
  }

  if (req.method === 'POST') {
    const auth = await requireAuth(req, res, send);
    if (!auth) return;
    const body = parseBody(req);

    


    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) return send(res, 400, { ok: false, error: 'id required' });
      const post = await getDeckPost(id);
      if (!post) return send(res, 404, { ok: false, error: 'not found' });
      if (String(post.author || '') !== String(auth.username || '')) return send(res, 403, { ok: false, error: 'forbidden' });
      await deleteDeckPost(id);
      return send(res, 200, { ok: true, id });
    }

    if (action === 'import') {
      const id = String(body.id || '').trim();
      const post = await bumpMetric(id, 'imports');
      if (!post) return send(res, 404, { ok: false, error: 'not found' });
      return send(res, 200, { ok: true, post });
    }

    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const code = String(body.code || '').trim();
    const tags = Array.isArray(body.tags) ? body.tags : [];

    if (!title || title.length > 60) return send(res, 400, { ok: false, error: 'title must be 1~60 chars' });
    if (description.length > 300) return send(res, 400, { ok: false, error: 'description too long' });

    const decoded = decodeDeckCodeSummary(code);
    if (!decoded.ok) return send(res, 400, { ok: false, error: decoded.reason });

    const post = await createDeckPost({
      title,
      description,
      author: auth.username,
      code,
      cardsCount: decoded.total,
      tags
    });

    return send(res, 200, { ok: true, post });
  }

    return send(res, 405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'DECK_HUB_SERVER_ERROR' });
  }
};
