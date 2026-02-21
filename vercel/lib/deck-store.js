const { kv } = (() => {
  try { return require('@vercel/kv'); } catch { return {}; }
})();

const mem = globalThis.__tcg_deck_store || new Map();
globalThis.__tcg_deck_store = mem;

const PREFIX = 'tcg:deck:';

function hasKV() {
  return !!kv && typeof kv.get === 'function' && process.env.KV_REST_API_URL;
}

function keyOf(agentId) {
  return PREFIX + String(agentId || '').trim();
}

function normalizeDeck(deck = []) {
  return (Array.isArray(deck) ? deck : []).map(String).filter(Boolean);
}

function validateDeck(deck = []) {
  const d = normalizeDeck(deck);
  if (d.length < 30) return { ok: false, reason: 'deck must have at least 30 cards' };
  const count = {};
  for (const k of d) {
    count[k] = (count[k] || 0) + 1;
    if (count[k] > 3) return { ok: false, reason: `card copy limit exceeded: ${k}` };
  }
  return { ok: true };
}

async function getDeck(agentId) {
  const key = keyOf(agentId);
  if (hasKV()) return (await kv.get(key)) || null;
  return mem.get(key) || null;
}

async function setDeck(agentId, deck) {
  const key = keyOf(agentId);
  const payload = normalizeDeck(deck);
  if (hasKV()) {
    await kv.set(key, payload, { ex: 60 * 60 * 24 * 30 });
    return;
  }
  mem.set(key, payload);
}

async function clearAllDecks() {
  if (hasKV() && typeof kv.keys === 'function') {
    const keys = await kv.keys(`${PREFIX}*`);
    if (Array.isArray(keys) && keys.length > 0 && typeof kv.del === 'function') {
      await kv.del(...keys);
      return { ok: true, cleared: keys.length, backend: 'kv' };
    }
    return { ok: true, cleared: 0, backend: 'kv' };
  }

  let cleared = 0;
  for (const key of mem.keys()) {
    if (key.startsWith(PREFIX)) {
      mem.delete(key);
      cleared += 1;
    }
  }
  return { ok: true, cleared, backend: 'mem' };
}

module.exports = { getDeck, setDeck, validateDeck, normalizeDeck, clearAllDecks };
