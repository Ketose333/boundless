const { send, parseBody } = require('../lib/http');
const { getRoom, setRoom } = require('../lib/store');
const { applyAction } = require('../lib/game');
const { requireAuth } = require('../lib/auth');
const { markMatchEnded } = require('../lib/match-state');

module.exports = async (req, res) => {
  const auth = await requireAuth(req, res, send);
  if (!auth) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' });

  const actionName = String((req.query && req.query.action) || '').trim();
  if (actionName !== 'action') return send(res, 400, { ok: false, error: 'action required' });

  const body = parseBody(req);
  const roomId = String(body.roomId || '').trim();
  const action = body.action || null;
  if (!roomId || !action) return send(res, 400, { ok: false, error: 'roomId/action required' });

  const room = await getRoom(roomId);
  if (!room) return send(res, 404, { ok: false, error: 'room not found' });
  if (room.agents?.length && !room.agents.includes(auth.username)) return send(res, 403, { ok: false, error: 'forbidden' });
  if (!room.game) return send(res, 409, { ok: false, error: 'game not started' });

  if ('actorId' in action) return send(res, 400, { ok: false, error: 'actorId is server-managed' });
  action.actorId = auth.username;
  room.lastSeen = room.lastSeen && typeof room.lastSeen === 'object' ? room.lastSeen : {};
  room.lastSeen[auth.username] = Date.now();
  room.updatedAt = Date.now();

  const result = applyAction(room.game, action);
  const nextGame = result.state;

  // 매치 종료 시: 룸은 유지(재사용), 게임 상태만 초기화.
  // 단, 상대/관전자 폴링에서 승패 스냅샷을 받을 수 있게 finalGame에 보관한다.
  if (nextGame?.winnerId) {
    markMatchEnded(room, nextGame, Date.now());
    await setRoom(roomId, room);
    return send(res, 200, {
      ok: result.ok,
      reason: result.reason,
      game: nextGame,
      matchEnded: true,
      roomReset: true
    });
  }

  room.game = nextGame;
  await setRoom(roomId, room);

  return send(res, 200, { ok: result.ok, reason: result.reason, game: room.game });
};
