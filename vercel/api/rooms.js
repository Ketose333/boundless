const { randomUUID } = require('node:crypto');
const { send, parseBody } = require('../lib/http');
const { getRoom, setRoom, clearRoomsByOwner, clearInactiveRooms, clearAllRooms } = require('../lib/store');
const { initGame } = require('../lib/game');
const { getDeck, validateDeck } = require('../lib/deck-store');
const { getUserPublic } = require('../lib/auth-store');
const { requireAuth } = require('../lib/auth');
const { isMatchLive, getResultSnapshot, startMatch, markMatchEnded, toRoomStatePayload } = require('../lib/match-state');

const INACTIVE_TIMEOUT_MS = 120 * 1000;

async function buildAgentNames(agents = []) {
  const names = {};
  await Promise.all((Array.isArray(agents) ? agents : []).map(async (agentId) => {
    const user = await getUserPublic(agentId);
    names[agentId] = user?.displayName || agentId;
  }));
  return names;
}

function applyInactiveForfeit(room, viewerId) {
  if (!room?.game || room.game.winnerId) return false;
  const agents = Array.isArray(room.agents) ? room.agents : [];
  if (agents.length !== 2 || !agents.includes(viewerId)) return false;

  const now = Date.now();
  const lastSeen = room.lastSeen && typeof room.lastSeen === 'object' ? room.lastSeen : {};
  const selfSeen = Number(lastSeen[viewerId] || 0);
  if (!selfSeen || (now - selfSeen) >= INACTIVE_TIMEOUT_MS) return false;

  const opponentId = agents.find((id) => id !== viewerId);
  const oppSeen = Number(lastSeen[opponentId] || 0);
  if (!opponentId || !oppSeen) return false;
  if ((now - oppSeen) < INACTIVE_TIMEOUT_MS) return false;

  room.game.winnerId = viewerId;
  room.game.log = Array.isArray(room.game.log) ? room.game.log : [];
  room.game.log.push(`${opponentId} timeout`);
  room.updatedAt = now;
  return true;
}

module.exports = async (req, res) => {
  const auth = await requireAuth(req, res, send);
  if (!auth) return;
  const action = String((req.query && req.query.action) || '').trim();

  if (req.method === 'GET') {
    if (action !== 'state') return send(res, 400, { ok: false, error: 'action required' });
    const roomId = String(req.query.roomId || '').trim();
    if (!roomId) return send(res, 400, { ok: false, error: 'roomId required' });
    const room = await getRoom(roomId);
    if (!room) return send(res, 404, { ok: false, error: 'room not found' });
    const agents = Array.isArray(room.agents) ? room.agents : [];
    const isMember = agents.includes(auth.username);
    let finalGame = getResultSnapshot(room);
    if (isMember) {
      room.lastSeen = room.lastSeen && typeof room.lastSeen === 'object' ? room.lastSeen : {};
      room.lastSeen[auth.username] = Date.now();
      room.updatedAt = Date.now();
      const changed = applyInactiveForfeit(room, auth.username);
      if (changed) room.endedBy = 'inactive_timeout';
      if (room.game?.winnerId) {
        finalGame = room.game;
        markMatchEnded(room, finalGame, Date.now());
      } else if (isMatchLive(room) && room.finalGame) {
        // 새 게임이 진행 중이면 이전 종료 스냅샷은 정리
        startMatch(room, room.game);
      }
      await setRoom(roomId, room);
    }
    const agentNames = await buildAgentNames(agents);

    if (!isMember) {
      return send(res, 200, toRoomStatePayload(room, {
        includeAgents: [],
        hideGame: true,
        restricted: true,
        agentNames
      }));
    }

    return send(res, 200, toRoomStatePayload({ ...room, finalGame }, {
      includeAgents: room.agents,
      hideGame: false,
      restricted: false,
      agentNames
    }));
  }

  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' });
  const body = parseBody(req);

  if (action === 'create') {
    const agentId = auth.username;
    const roomId = randomUUID().replace(/-/g, '').slice(0, 6);
    const now = Date.now();
    const room = { roomId, ownerId: agentId, agents: [agentId], game: null, createdAt: now, updatedAt: now, lastSeen: { [agentId]: now } };
    await setRoom(roomId, room);
    const agentNames = await buildAgentNames(room.agents);
    return send(res, 201, { ok: true, roomId, agents: room.agents, agentNames });
  }

  if (action === 'join') {
    const roomId = String(body.roomId || '').trim();
    const agentId = auth.username;
    if (!roomId) return send(res, 400, { ok: false, error: 'roomId required' });
    const room = await getRoom(roomId);
    if (!room) return send(res, 404, { ok: false, error: 'room not found' });

    const alreadyJoined = room.agents.includes(agentId);
    if (!alreadyJoined) {
      if (room.agents.length >= 2) return send(res, 409, { ok: false, error: 'room full' });
      room.agents.push(agentId);
    }

    // 1인으로는 시작 금지 + 동일 계정 2슬롯 금지
    if (room.agents.length === 2 && !room.game) {
      const [a1, a2] = room.agents;
      if (!a1 || !a2 || a1 === a2) {
        return send(res, 409, { ok: false, error: 'two distinct agents required' });
      }
      const d1 = await getDeck(a1);
      const d2 = await getDeck(a2);
      const decksByAgent = {};
      if (d1 && validateDeck(d1).ok) decksByAgent[a1] = d1;
      if (d2 && validateDeck(d2).ok) decksByAgent[a2] = d2;
      startMatch(room, initGame(room.roomId, a1, a2, decksByAgent));
    }

    room.lastSeen = room.lastSeen && typeof room.lastSeen === 'object' ? room.lastSeen : {};
    room.lastSeen[agentId] = Date.now();
    room.updatedAt = Date.now();
    await setRoom(roomId, room);
    const agentNames = await buildAgentNames(room.agents);
    return send(res, 200, {
      ok: true,
      roomId,
      ownerId: room.ownerId,
      agents: room.agents,
      started: !!room.game,
      joined: !alreadyJoined,
      waitingForOpponent: room.agents.length < 2,
      agentNames
    });
  }

  if (action === 'reset') {
    const roomId = String(body.roomId || '').trim();
    const agents = Array.isArray(body.agents) && body.agents.length ? body.agents.map(String).slice(0, 2) : null;
    if (!roomId) return send(res, 400, { ok: false, error: 'roomId required' });
    const room = await getRoom(roomId);
    if (!room) return send(res, 404, { ok: false, error: 'room not found' });
    if (room.ownerId !== auth.username) return send(res, 403, { ok: false, error: 'only owner can reset room' });
    if (!agents) return send(res, 400, { ok: false, error: 'agents required' });
    const now = Date.now();
    const next = { roomId, ownerId: room.ownerId, agents, game: null, finalGame: null, finalGameAt: null, createdAt: room.createdAt || now, updatedAt: now, lastSeen: { [auth.username]: now } };
    await setRoom(roomId, next);
    const agentNames = await buildAgentNames(next.agents);
    return send(res, 200, { ok: true, roomId, agents: next.agents, game: null, reset: true, agentNames });
  }

  if (action === 'clear') {
    const r = await clearRoomsByOwner(auth.username);
    return send(res, 200, { ok: true, ...r, clearedMine: true });
  }

  if (action === 'clear_inactive') {
    const r = await clearInactiveRooms();
    return send(res, 200, { ok: true, ...r, clearedInactive: true });
  }

  if (action === 'clear_all') {
    const confirm = String(body.confirm || '').trim();
    if (confirm !== 'CONFIRM_ALL_ROOMS') return send(res, 400, { ok: false, error: 'confirm token required' });
    const r = await clearAllRooms();
    return send(res, 200, { ok: true, ...r, clearedAll: true });
  }

  return send(res, 400, { ok: false, error: 'unsupported action' });
};
