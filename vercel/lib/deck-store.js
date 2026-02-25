const { loadKV, canUseKV, tryKV } = require('./kv-safe');

const kv = loadKV();
const mem = globalThis.__tcg_deck_store || new Map();
globalThis.__tcg_deck_store = mem;

const PREFIX = 'tcg:deck:';
const MAX_SLOTS = 10;

function hasKV() {
  return canUseKV(kv);
}

function keyOf(agentId) {
  return PREFIX + String(agentId || '').trim();
}

function normalizeDeck(deck = []) {
  return (Array.isArray(deck) ? deck : []).map(String).filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function makeSlotId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultModel(deck = []) {
  const slotId = makeSlotId();
  return {
    activeSlotId: slotId,
    slots: [{ id: slotId, name: '기본 덱', deck: normalizeDeck(deck), updatedAt: nowIso(), source: 'manual' }]
  };
}

function ensureModel(raw) {
  const obj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const slots = Array.isArray(obj.slots)
    ? obj.slots.map((s, i) => ({
      id: String(s?.id || `slot_${i + 1}`),
      name: String(s?.name || `덱 ${i + 1}`),
      deck: normalizeDeck(s?.deck || []),
      updatedAt: String(s?.updatedAt || nowIso()),
      source: String(s?.source || 'manual')
    })).slice(0, MAX_SLOTS)
    : [];
  if (!slots.length) return defaultModel([]);
  const activeSlotId = slots.some((s) => s.id === obj.activeSlotId) ? String(obj.activeSlotId) : slots[0].id;
  return { activeSlotId, slots };
}

function activeSlot(model) {
  const m = ensureModel(model);
  return m.slots.find((s) => s.id === m.activeSlotId) || m.slots[0];
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

async function _getRaw(agentId) {
  const key = keyOf(agentId);
  if (hasKV()) return tryKV(() => kv.get(key), () => mem.get(key) || null);
  return mem.get(key) || null;
}

async function _setRaw(agentId, raw) {
  const key = keyOf(agentId);
  if (hasKV()) {
    await tryKV(() => kv.set(key, raw, { ex: 60 * 60 * 24 * 30 }), () => mem.set(key, raw));
    return;
  }
  mem.set(key, raw);
}

async function getDeck(agentId) {
  const raw = await _getRaw(agentId);
  const model = ensureModel(raw || {});
  return normalizeDeck(activeSlot(model)?.deck || []);
}

async function setDeck(agentId, deck) {
  const raw = await _getRaw(agentId);
  const model = ensureModel(raw || {});
  const current = activeSlot(model);
  current.deck = normalizeDeck(deck);
  current.updatedAt = nowIso();
  current.source = 'manual';
  model.slots = model.slots.map((s) => (s.id === current.id ? current : s));
  await _setRaw(agentId, model);
}

async function getDeckSlots(agentId) {
  const raw = await _getRaw(agentId);
  const model = ensureModel(raw || {});
  return model;
}

async function setActiveSlot(agentId, slotId) {
  const model = await getDeckSlots(agentId);
  if (!model.slots.some((s) => s.id === slotId)) return null;
  model.activeSlotId = slotId;
  await _setRaw(agentId, model);
  return model;
}

async function createSlot(agentId, name = '') {
  const model = await getDeckSlots(agentId);
  if (model.slots.length >= MAX_SLOTS) return null;
  const id = makeSlotId();
  model.slots.push({ id, name: String(name || `덱 ${model.slots.length + 1}`), deck: [], updatedAt: nowIso(), source: 'manual' });
  model.activeSlotId = id;
  await _setRaw(agentId, model);
  return model;
}

async function deleteSlot(agentId, slotId) {
  const model = await getDeckSlots(agentId);
  if (model.slots.length <= 1) return null;
  const next = model.slots.filter((s) => s.id !== slotId);
  if (next.length === model.slots.length) return null;
  model.slots = next;
  if (model.activeSlotId === slotId) model.activeSlotId = next[0].id;
  await _setRaw(agentId, model);
  return model;
}

async function importDeckToNewSlot(agentId, deck, name = '허브 가져온 덱') {
  const model = await getDeckSlots(agentId);
  if (model.slots.length >= MAX_SLOTS) return null;
  const id = makeSlotId();
  model.slots.push({ id, name: String(name || '허브 가져온 덱'), deck: normalizeDeck(deck), updatedAt: nowIso(), source: 'import' });
  model.activeSlotId = id;
  await _setRaw(agentId, model);
  return model;
}

async function clearAllDecks() {
  if (hasKV() && typeof kv.keys === 'function') {
    return tryKV(async () => {
      const keys = await kv.keys(`${PREFIX}*`);
      if (Array.isArray(keys) && keys.length > 0 && typeof kv.del === 'function') {
        await kv.del(...keys);
        return { ok: true, cleared: keys.length, backend: 'kv' };
      }
      return { ok: true, cleared: 0, backend: 'kv' };
    }, async () => {
      let cleared = 0;
      for (const key of mem.keys()) {
        if (key.startsWith(PREFIX)) {
          mem.delete(key);
          cleared += 1;
        }
      }
      return { ok: true, cleared, backend: 'mem' };
    });
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

module.exports = {
  getDeck,
  setDeck,
  getDeckSlots,
  setActiveSlot,
  createSlot,
  deleteSlot,
  importDeckToNewSlot,
  validateDeck,
  normalizeDeck,
  clearAllDecks
};
