const { send, parseBody } = require('../../lib/http');
const { getDeck, setDeck, validateDeck, normalizeDeck, clearAllDecks } = require('../../lib/deck-store');
const { requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
  const auth = await requireAuth(req, res, send);
  if (!auth) return;
  const action = String((req.query && req.query.action) || '').trim();

  if (req.method === 'GET') {
    const agentId = String(req.query.agentId || auth.username).trim();
    if (agentId !== auth.username) return send(res, 403, { ok: false, error: 'forbidden' });
    const deck = await getDeck(agentId);
    return send(res, 200, { ok: true, agentId, deck: deck || null });
  }

  if (req.method === 'POST') {
    const body = parseBody(req);

    if (action === 'clear_all') {
      const confirm = String(body.confirm || '').trim();
      if (confirm !== 'CONFIRM_ALL_DECKS') return send(res, 400, { ok: false, error: 'confirm token required' });
      const r = await clearAllDecks();
      return send(res, 200, { ok: true, ...r, clearedAllDecks: true });
    }

    const agentId = String(body.agentId || auth.username).trim();
    if (agentId !== auth.username) return send(res, 403, { ok: false, error: 'forbidden' });

    const deck = normalizeDeck(body.deck || []);
    const v = validateDeck(deck);
    if (!v.ok) return send(res, 400, { ok: false, error: v.reason });

    await setDeck(agentId, deck);
    return send(res, 200, { ok: true, agentId, saved: deck.length });
  }

  return send(res, 405, { ok: false, error: 'method not allowed' });
};
