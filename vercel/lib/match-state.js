function isMatchLive(room) {
  return !!room?.game;
}

function getResultSnapshot(room) {
  return room?.finalGame || null;
}

function startMatch(room, game) {
  room.game = game || null;
  room.finalGame = null;
  room.finalGameAt = null;
  return room;
}

function markMatchEnded(room, finalGame, now = Date.now()) {
  room.game = null;
  room.finalGame = finalGame || null;
  room.finalGameAt = finalGame ? now : null;
  return room;
}

function toRoomStatePayload(room, opts = {}) {
  const {
    includeAgents = [],
    hideGame = false,
    agentNames = {},
    restricted = false
  } = opts;

  const agents = Array.isArray(includeAgents) ? includeAgents : [];
  const live = isMatchLive(room);
  const resultGame = getResultSnapshot(room);

  return {
    ok: true,
    roomId: room?.roomId,
    ownerId: room?.ownerId,
    agents,
    agentsCount: agents.length,
    started: live,
    joinable: agents.length < 2,
    game: hideGame ? null : (resultGame || room?.game || null),
    restricted: !!restricted,
    agentNames
  };
}

module.exports = {
  isMatchLive,
  getResultSnapshot,
  startMatch,
  markMatchEnded,
  toRoomStatePayload
};
