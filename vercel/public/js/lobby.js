(() => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const pid = () => (me?.username || $('playerId').value.trim());
  const rid = () => sanitizeRoomId($('roomId').value);

  const ROOM_KEY = 'bp_last_room_id';
  const AGENT_KEY = 'bp_last_agent_id';

  let me = null;
  let autoEntering = false;
  let checkingRoom = false;

  const LOADING = globalThis.BP_LOADING || { show: () => {}, hide: () => {} };
  const T = globalThis.BP_TERMBOOK || {};

  function sanitizeRoomId(v = '') {
    return String(v).toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 6);
  }

  function mapErrorMessage(raw = '') {
    if (typeof T.mapApiError === 'function') return T.mapApiError(raw);
    return raw || '요청 처리에 실패했어요. 잠시 후 다시 시도해 주세요.';
  }

  function setStatus(text, tone = 'idle') {
    const s = $('roomStatus');
    if (!s) return;
    s.textContent = text;
    s.className = `pill ${tone === 'ok' ? 'ok' : ''}`;
  }

  function loadSavedRoom() {
    try { return (sessionStorage.getItem(ROOM_KEY) || '').trim(); } catch { return ''; }
  }

  function saveRoom(roomId) {
    const v = sanitizeRoomId(roomId || '');
    if (!v) return;
    try { sessionStorage.setItem(ROOM_KEY, v); } catch {}
  }

  function saveAgent(agentId) {
    const v = String(agentId || '').trim();
    if (!v) return;
    try { sessionStorage.setItem(AGENT_KEY, v); } catch {}
  }

  function cooldownUntil(roomId) {
    if (!roomId) return 0;
    try {
      return Number(sessionStorage.getItem(`bp_room_end_cooldown_${roomId}`) || 0);
    } catch {
      return 0;
    }
  }

  function setCooldown(roomId, ms = 8000) {
    if (!roomId) return;
    try {
      sessionStorage.setItem(`bp_room_end_cooldown_${roomId}`, String(Date.now() + ms));
    } catch {}
  }

  function inCooldown(roomId) {
    return Date.now() < cooldownUntil(roomId);
  }

  function hydrateQuery() {
    const qr = sanitizeRoomId((q.get('roomId') || '').trim());
    const sr = loadSavedRoom();
    const r = qr || sr;
    if (r) {
      $('roomId').value = r;
      saveRoom(r);
    }
    if (q.get('ended') === '1' && r) setCooldown(r, 9000);
  }

  function bindRoomInputHandlers() {
    const input = $('roomId');
    if (!input) return;
    const normalize = () => {
      const next = sanitizeRoomId(input.value);
      if (next !== input.value) input.value = next;
    };
    input.addEventListener('input', normalize);
    input.addEventListener('paste', () => setTimeout(normalize, 0));
    input.addEventListener('blur', normalize);
  }

  async function api(path, method = 'GET', body) {
    if (method === 'GET' && !body) {
      const r = await fetch(path);
      return await r.json();
    }
    const opt = { method, headers: { 'content-type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    return await r.json();
  }

  function roomRender(r = {}) {
    const agents = Array.isArray(r.agents) ? r.agents : [];
    if (r.roomId) saveRoom(r.roomId);
    const agentsCount = Number.isFinite(r.agentsCount) ? Number(r.agentsCount) : agents.length;
    const inProgress = typeof r.started === 'boolean' ? r.started : !!r.game;
    const joinable = typeof r.joinable === 'boolean' ? r.joinable : agentsCount < 2;

    $('roomCode').textContent = sanitizeRoomId(r.roomId || rid() || '------') || '------';
    $('roomPlayers').textContent = `참가자: ${agents.length ? agents.join(', ') : `${agentsCount}/2`}`;
    $('roomOwner').textContent = `방장: ${r.ownerId || '-'}`;
    $('roomGame').textContent = `매치: ${inProgress ? '진행 중' : '대기 중'}`;

    const liveRoom = $('liveRoom');
    const liveAgents = $('liveAgents');
    const liveJoinable = $('liveJoinable');
    if (liveRoom) liveRoom.textContent = inProgress ? '진행 중' : (r.ok ? '대기 중' : '-');
    if (liveAgents) liveAgents.textContent = `${agentsCount}/2`;
    if (liveJoinable) liveJoinable.textContent = joinable ? '가능' : '가득참';
  }

  function tryAutoEnter(r = {}) {
    if (autoEntering) return;
    if (!r?.ok) return;
    if (!r.started) return;
    const room = rid() || sanitizeRoomId(r.roomId) || loadSavedRoom();
    if (!room) return;
    if (inCooldown(room)) return;
    const agents = Array.isArray(r.agents) ? r.agents : [];
    const meId = pid();
    if (!meId || !agents.includes(meId)) return;
    saveRoom(room);
    saveAgent(meId);
    autoEntering = true;
    window.location.href = `/game.html?roomId=${encodeURIComponent(room)}&agentId=${encodeURIComponent(meId)}`;
  }

  window.createRoom = async () => {
    setStatus(T.status?.lobbyCreating || '방 생성 중', 'idle');
    LOADING.show(T.status?.lobbyCreating || '방 생성 중', { mode: 'percent' });
    try {
      const meId = pid();
      const r = await api('/api/rooms?action=create', 'POST', { agentId: meId });
      if (!r.ok) {
        setStatus(mapErrorMessage(r.error), 'idle');
        return;
      }
      if (r.roomId) {
        $('roomId').value = sanitizeRoomId(r.roomId);
        saveRoom(r.roomId);
      }
      saveAgent(meId);
      roomRender(r);
      setStatus(T.status?.lobbyReady || '방 생성 완료', 'ok');
      tryAutoEnter(r);
    } finally {
      LOADING.hide();
    }
  };

  window.checkRoom = async (opts = {}) => {
    if (!rid()) return;
    if (checkingRoom) return;
    checkingRoom = true;
    const silent = !!opts.silent;
    if (!silent) {
      setStatus(T.status?.lobbyChecking || '방 상태 확인 중', 'idle');
      LOADING.show(T.status?.lobbyChecking || '방 상태 확인 중', { mode: 'percent' });
    }
    try {
      const r = await api(`/api/rooms?action=state&roomId=${encodeURIComponent(rid())}`);
      roomRender(r);
      tryAutoEnter(r);
      if (!silent) {
        setStatus(r.ok ? (T.status?.lobbyChecked || '방 상태 확인됨') : mapErrorMessage(r.error || '방을 찾을 수 없음'), r.ok ? 'ok' : 'idle');
      }
    } finally {
      if (!silent) LOADING.hide();
      checkingRoom = false;
    }
  };

  window.joinRoom = async () => {
    if (!rid()) return;
    const room = rid();
    const meId = pid();
    setStatus(T.status?.lobbyJoining || '입장 중', 'idle');
    LOADING.show(T.status?.lobbyJoining || '입장 중', { mode: 'percent' });
    try {
      const r = await api('/api/rooms?action=join', 'POST', { roomId: room, agentId: meId });
      if (!r.ok) {
        setStatus(mapErrorMessage(r.error || r.reason || 'join failed'), 'idle');
        return;
      }
      saveRoom(room);
      saveAgent(meId);
      if (r.spectator) {
        setStatus(T.status?.roomSpectator || '방이 가득 차 관전 모드로 입장', 'idle');
        window.location.href = `/game.html?roomId=${encodeURIComponent(room)}&agentId=${encodeURIComponent(meId)}&spectator=1`;
        return;
      }
      if (!r.started) {
        roomRender({ ok: true, roomId: room, agents: r.agents || [], ownerId: r.ownerId || '-', game: null });
        setStatus(T.status?.lobbyJoinedWait || '입장 완료 · 상대 대기 중', 'ok');
        return;
      }
      window.location.href = `/game.html?roomId=${encodeURIComponent(room)}&agentId=${encodeURIComponent(meId)}`;
    } finally {
      LOADING.hide();
    }
  };

  window.retryCheck = () => window.checkRoom();
  window.retryJoin = () => window.joinRoom();

  window.goDeck = () => {
    window.location.href = `/deck.html?agentId=${encodeURIComponent(pid())}`;
  };

  async function bootstrap() {
    LOADING.show('로비를 불러오는 중이에요', { mode: 'percent' });
    try {
      const m = await api('/api/auth?action=me');
      if (!m.ok) {
        location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      me = m.user;
      $('playerId').value = me.username;
      saveAgent(me.username);
      const liveAuth = $('liveAuth');
      if (liveAuth) liveAuth.textContent = me.displayName || me.username;
      setStatus(`로그인: ${me.displayName || me.username}`, 'ok');
      hydrateQuery();
      bindRoomInputHandlers();
      roomRender({ ok: false, roomId: rid(), agents: [], ownerId: '-', game: null });
      if (rid()) {
        window.checkRoom();
        setInterval(() => {
          if (!rid() || autoEntering) return;
          window.checkRoom({ silent: true });
        }, 2000);
      }
    } finally {
      LOADING.hide();
    }
  }

  bootstrap();
})();
