const { loadKV, canUseKV, tryKV } = require('./kv-safe');

const kv = loadKV();
const mem = globalThis.__tcg_mem_store || new Map();
globalThis.__tcg_mem_store = mem;

const PREFIX = 'tcg:room:';
const INACTIVE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function hasKV() {
  return canUseKV(kv);
}

async function getRoom(roomId) {
  const key = PREFIX + roomId;
  if (hasKV()) return tryKV(() => kv.get(key), () => mem.get(key) || null);
  return mem.get(key) || null;
}

async function setRoom(roomId, room) {
  const key = PREFIX + roomId;
  if (hasKV()) {
    await tryKV(() => kv.set(key, room, { ex: 60 * 60 * 24 }), () => mem.set(key, room));
    return;
  }
  mem.set(key, room);
}

async function listRooms() {
  if (hasKV() && typeof kv.keys === 'function') {
    return tryKV(async () => {
      const keys = await kv.keys(`${PREFIX}*`);
      if (!Array.isArray(keys) || keys.length === 0) return [];
      const rows = await Promise.all(keys.map((k) => kv.get(k)));
      return rows.filter(Boolean);
    }, () => {
      const rows = [];
      for (const [key, value] of mem.entries()) {
        if (key.startsWith(PREFIX)) rows.push(value);
      }
      return rows;
    });
  }

  const rows = [];
  for (const [key, value] of mem.entries()) {
    if (key.startsWith(PREFIX)) rows.push(value);
  }
  return rows;
}

async function clearRoomsByOwner(ownerId) {
  const owner = String(ownerId || '').trim();
  if (!owner) return { ok: false, cleared: 0, backend: hasKV() ? 'kv' : 'mem' };

  if (hasKV() && typeof kv.keys === 'function') {
    return tryKV(async () => {
      const keys = await kv.keys(`${PREFIX}*`);
      if (!Array.isArray(keys) || keys.length === 0 || typeof kv.del !== 'function') return { ok: true, cleared: 0, backend: 'kv' };
      const rows = await Promise.all(keys.map((k) => kv.get(k)));
      const delKeys = keys.filter((_, i) => rows[i]?.ownerId === owner);
      if (delKeys.length) await kv.del(...delKeys);
      return { ok: true, cleared: delKeys.length, backend: 'kv' };
    }, async () => {
      let cleared = 0;
      for (const [key, value] of mem.entries()) {
        if (key.startsWith(PREFIX) && value?.ownerId === owner) {
          mem.delete(key);
          cleared += 1;
        }
      }
      return { ok: true, cleared, backend: 'mem' };
    });
  }

  let cleared = 0;
  for (const [key, value] of mem.entries()) {
    if (key.startsWith(PREFIX) && value?.ownerId === owner) {
      mem.delete(key);
      cleared += 1;
    }
  }
  return { ok: true, cleared, backend: 'mem' };
}

async function clearInactiveRooms(timeoutMs = INACTIVE_TIMEOUT_MS) {
  const now = Date.now();
  const isInactive = (room) => {
    if (!room) return false;
    const agents = Array.isArray(room.agents) ? room.agents : [];
    const game = room.game || null;
    const lastSeen = (room && typeof room.lastSeen === 'object' && room.lastSeen) ? room.lastSeen : {};
    const roomTouchedAt = Number(room.updatedAt || room.createdAt || 0) || 0;

    if (!game || agents.length < 2 || game.winnerId) {
      if (!roomTouchedAt) return true;
      return (now - roomTouchedAt) >= timeoutMs;
    }

    return agents.every((agentId) => {
      const ts = Number(lastSeen[agentId] || 0);
      if (!ts) return true;
      return (now - ts) >= timeoutMs;
    });
  };

  if (hasKV() && typeof kv.keys === 'function') {
    return tryKV(async () => {
      const keys = await kv.keys(`${PREFIX}*`);
      if (!Array.isArray(keys) || keys.length === 0 || typeof kv.del !== 'function') {
        return { ok: true, cleared: 0, backend: 'kv' };
      }
      const rows = await Promise.all(keys.map((k) => kv.get(k)));
      const delKeys = keys.filter((_, i) => isInactive(rows[i]));
      if (delKeys.length) await kv.del(...delKeys);
      return { ok: true, cleared: delKeys.length, backend: 'kv' };
    }, async () => {
      let cleared = 0;
      for (const [key, value] of mem.entries()) {
        if (key.startsWith(PREFIX) && isInactive(value)) {
          mem.delete(key);
          cleared += 1;
        }
      }
      return { ok: true, cleared, backend: 'mem' };
    });
  }

  let cleared = 0;
  for (const [key, value] of mem.entries()) {
    if (key.startsWith(PREFIX) && isInactive(value)) {
      mem.delete(key);
      cleared += 1;
    }
  }
  return { ok: true, cleared, backend: 'mem' };
}

async function clearAllRooms() {
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

module.exports = { getRoom, setRoom, listRooms, clearRoomsByOwner, clearInactiveRooms, clearAllRooms, hasKV };
