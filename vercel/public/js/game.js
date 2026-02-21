(() => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);

  let me = null;
  let game = null;
  let selectedHand = null;
  let selectedAttacker = null;
  let selectedSpellTarget = null;
  let leavingGame = false;
  let hadLiveGame = false;
  let lastRenderSig = '';
  let lastPhaseKey = '';
  let autoAdvanceDrawKey = '';
  let autoAdvanceEndKey = '';
  let phaseFxTimer = null;
  let endRedirectTimer = null;
  let isSpectator = q.get('spectator') === '1';
  let viewMeId = '';
  let viewOppId = '';
  let agentNames = {};
  let handLongPressTimer = null;
  let handLongPressIndex = null;
  let boardLongPressTimer = null;
  let suppressHandClickUntil = 0;

  const S = globalThis.BP_SHARED_CARDS || {};
  const normalizeCardKey = S.normalizeCardKey || ((k) => k);
  const getCardDef = S.getCardDef || ((k) => ({ name: k }));
  const getCardType = S.getCardType || (() => 'spell');

  const ROOM_KEY = 'bp_last_room_id';
  const AGENT_KEY = 'bp_last_agent_id';
  const LOADING = globalThis.BP_LOADING || { show: () => {}, hide: () => {} };
  const T = globalThis.BP_TERMBOOK || {};

  const pid = () => (me?.username || (q.get('agentId') || '').trim() || loadSavedAgent()).trim();
  const rid = () => ((q.get('roomId') || '').trim() || loadSavedRoom()).trim();

  function loadSavedRoom() {
    try { return (sessionStorage.getItem(ROOM_KEY) || '').trim(); } catch { return ''; }
  }

  function saveRoom(roomId) {
    const v = String(roomId || '').trim();
    if (!v) return;
    try { sessionStorage.setItem(ROOM_KEY, v); } catch {}
  }

  function loadSavedAgent() {
    try { return (sessionStorage.getItem(AGENT_KEY) || '').trim(); } catch { return ''; }
  }

  function saveAgent(agentId) {
    const v = String(agentId || '').trim();
    if (!v) return;
    try { sessionStorage.setItem(AGENT_KEY, v); } catch {}
  }

  function esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function phaseLabel(p) {
    if (typeof T.phaseLabel === 'function') return T.phaseLabel(p);
    return { draw: '드로우', main: '메인', battle: '배틀', end: '엔드' }[p] || p;
  }

  function gameSig(g) {
    if (!g) return '';
    return [
      g.turn,
      g.phase,
      g.activeAgentId,
      g.winnerId || '-',
      (g.stack || []).length,
      JSON.stringify(g.agents || {})
    ].join('|');
  }

  function spellSlotKey(slot) {
    if (!slot) return '';
    if (typeof slot === 'string') return slot;
    return slot.key || slot.cardKey || '';
  }

  function cardDefByKey(key) {
    if (!key) return null;
    return getCardDef(normalizeCardKey(key)) || null;
  }

  function cardName(key) {
    const defName = cardDefByKey(key)?.name;
    if (defName) return defName;
    return '알 수 없는 카드';
  }

  function displayName(agentId) {
    const id = String(agentId || '').trim();
    if (!id) return '플레이어';
    return String(agentNames[id] || id);
  }

  function actorLabel(agentId) {
    return displayName(agentId);
  }

  function reasonLabel(reason) {
    const map = {
      'not your turn': '지금은 내 턴이 아니에요.',
      'main only': '메인 페이즈에서만 사용할 수 있어요.',
      'battle only': '배틀 페이즈에서만 할 수 있어요.',
      'not enough mana': '마나가 부족해요.',
      'bad handIndex': '선택한 카드가 유효하지 않아요.',
      'monster zone full': '유닛 존이 가득 찼어요.',
      'spell zone full': '마법 존이 가득 찼어요.',
      'invalid attacker': '공격할 유닛을 다시 선택해 주세요.',
      'invalid target': '공격 대상이 유효하지 않아요.',
      'guard blocks direct attack': '상대 가드 유닛 때문에 직접 공격할 수 없어요.',
      'stack empty': '해결할 연쇄가 없어요.',
      'stack payload missing': '연쇄 데이터가 없어 해결할 수 없어요.',
      'unsupported action': '지원하지 않는 행동이에요.',
      'game ended': '이미 게임이 끝났어요.',
      'unknown actor': '플레이어 정보를 찾을 수 없어요.',
      'battle blocked': '첫 턴에는 배틀이 제한돼요.',
      'opponent timeout': '상대 미응답으로 승리 처리됐어요.'
    };
    return map[String(reason || '')] || '지금은 그 행동을 할 수 없어요.';
  }

  function sanitizeRecentLog(line) {
    const raw = String(line || '').trim();
    if (!raw) return '';
    const normalized = raw
      .replace(/\bmain\b/gi, '메인')
      .replace(/\bdraw\b/gi, '드로우')
      .replace(/\bbattle\b/gi, '배틀')
      .replace(/\bend\b/gi, '엔드');

    if (/deck out/i.test(normalized)) {
      const actor = normalized.split(' ')[0] || '';
      return `${actorLabel(actor)} 님 덱 소진.`;
    }
    if (/timeout/i.test(normalized)) {
      const actor = normalized.split(' ')[0] || '';
      return `${actorLabel(actor)} 님 연결 시간 초과`;
    }
    if (/search failed/i.test(normalized)) return '탐색에 실패했어요.';
    if (/recruit failed/i.test(normalized)) return '징집에 실패했어요.';
    if (/effect skipped/i.test(normalized)) return '효과가 조건을 만족하지 못해 발동되지 않았어요.';
    if (/deployed/i.test(normalized)) {
      const parts = normalized.split(' ');
      return `${actorLabel(parts[0])} 님 · 유닛 전개`;
    }
    if (/used/i.test(normalized)) {
      const parts = normalized.split(' ');
      return `${actorLabel(parts[0])} 님 · 마법 사용`;
    }
    if (/attacked agent/i.test(normalized)) {
      const parts = normalized.split(' ');
      return `${actorLabel(parts[0])} 님 · 본체 공격`;
    }
    if (/attacked/i.test(normalized)) {
      const parts = normalized.split(' ');
      return `${actorLabel(parts[0])} 님 · 전투 진행`;
    }
    if (/turn .* draw step resolved/i.test(normalized)) return '턴이 진행됐어요.';
    if (/game initialized/i.test(normalized)) return '게임이 시작됐어요.';

    return '최근 행동이 갱신됐어요.';
  }

  function winnerLabel(winnerId) {
    if (!winnerId) return '-';
    return actorLabel(winnerId);
  }

  function renderCardContent({ key = null, unit = null, hand = false } = {}) {
    const baseKey = key || unit?.key || null;
    if (!baseKey) return `<div class="slot-empty"></div>`;
    const def = cardDefByKey(baseKey) || {};
    const name = def.name || baseKey;
    const effect = def.effect || '';
    const type = getCardType(baseKey);
    const stat = unit
      ? `${unit.atk}/${unit.hp}`
      : (type === 'monster' && Number.isFinite(def.atk) && Number.isFinite(def.hp) ? `${def.atk}/${def.hp}` : '');
    const meta = [def.guard ? '가드' : '', def.race, def.theme, def.element].filter(Boolean).join(' | ');

    return `
      <div class="card-mini ${hand ? 'hand' : 'zone'}">
        <div class="card-mini__name">${esc(name)}</div>
        ${meta ? `<div class="card-mini__effect">${esc(meta)}</div>` : ''}
        ${effect ? `<div class="card-mini__effect">${esc(effect)}</div>` : '<div class="card-mini__effect muted">효과 없음</div>'}
        ${stat ? `<div class="card-mini__stat">${esc(stat)}</div>` : ''}
      </div>
    `;
  }

  const keywordDescMap = {
    ...(S.KEYWORD_TEXT || {}),
    가드: (S.KEYWORD_TEXT && S.KEYWORD_TEXT.가드) || '상대 필드에 가드 유닛이 있으면 에이전트 직접 공격이 불가능하다.'
  };

  function keywordDescription(kw, def = {}) {
    const key = String(kw || '').trim();
    if (!key) return '설명이 없다.';
    if (keywordDescMap[key]) return keywordDescMap[key];

    if (def?.race && key === String(def.race)) return '종족 태그: 일부 카드 효과의 조건으로 사용된다.';
    if (def?.theme && key === String(def.theme)) return '테마 태그: 같은 테마 카드와의 시너지 조건으로 사용된다.';
    if (def?.element && key === String(def.element)) return '속성 태그: 효과 조건/시너지 판정에 사용된다.';

    return `카드 효과 텍스트 안의 키워드(${key})다.`;
  }

  function cardKeywords(def = {}) {
    const out = new Set();
    const raw = String(def?.effect || '');
    const regex = /<([^>]+)>/g;
    let m;
    while ((m = regex.exec(raw)) !== null) {
      const src = String(m[1] || '');
      for (const part of src.split('/')) {
        const token = String(part || '').split(':')[0].trim();
        if (token) out.add(token);
      }
    }
    if (def?.guard) out.add('가드');
    for (const v of [def?.race, def?.theme, def?.element]) {
      if (v) out.add(String(v));
    }
    return Array.from(out);
  }

  function openCardOverlayByKey(cardKey) {
    const key = normalizeCardKey(cardKey);
    const def = cardDefByKey(key);
    if (!def) return;
    const overlay = $('cardInspectOverlay');
    const preview = $('cardOverlayPreview');
    const meta = $('cardOverlayMeta');
    const keywords = $('cardOverlayKeywords');
    if (!overlay || !preview || !meta || !keywords) return;

    preview.innerHTML = `<div class="hand-card card-overlay__card">${renderCardContent({ key, hand: true })}</div>`;
    meta.innerHTML = `
      <div class="card-overlay__title">${esc(def.name || key)}</div>
      <div class="card-overlay__line">종류: ${esc(getCardType(key) === 'monster' ? '유닛' : '마법')}</div>
      <div class="card-overlay__line">코스트: ${esc(def.cost ?? 0)}</div>
      ${def.effect ? `<div class="card-overlay__effect">${esc(def.effect)}</div>` : '<div class="card-overlay__effect muted">효과 없음</div>'}
    `;

    const list = cardKeywords(def);
    keywords.innerHTML = list.length
      ? list.map((kw) => `<div class="card-overlay__kw"><strong>${esc(kw)}</strong><span>${esc(keywordDescription(kw, def))}</span></div>`).join('')
      : '<div class="muted">키워드가 없어요.</div>';

    overlay.classList.remove('hidden');
  }

  function openCardOverlayByUnit(unitId) {
    const unit = unitId ? game?.units?.[unitId] : null;
    if (!unit?.key) return;
    openCardOverlayByKey(unit.key);
  }

  function closeCardOverlay() {
    $('cardInspectOverlay')?.classList.add('hidden');
  }

  function selectionText(meAgent) {
    if (isSpectator) return '관전 중이에요.';
    if (selectedHand !== null) {
      const k = meAgent?.hand?.[selectedHand];
      return `선택 카드: ${cardName(k)}`;
    }
    if (selectedAttacker) {
      const u = game?.units?.[selectedAttacker];
      return `공격 유닛: ${cardName(u?.key || selectedAttacker)}`;
    }
    if (selectedSpellTarget) {
      const u = game?.units?.[selectedSpellTarget];
      return `장착 대상: ${cardName(u?.key || selectedSpellTarget)}`;
    }
    return '선택된 항목이 없어요.';
  }

  async function api(path, method = 'GET', body) {
    const opt = { method, headers: { 'content-type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    return await r.json();
  }

  function slot(html, click, fn, extra = '', dataAttrs = '') {
    const cls = `slot ${click ? 'clickable' : ''} ${extra}`.trim();
    return `<button class="${cls}" type="button" ${fn ? `onclick="${fn}"` : ''}${dataAttrs}>${html}</button>`;
  }

  function showPhaseFx(text) {
    let el = $('phaseFx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'phaseFx';
      el.className = 'phase-fx hidden';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    if (phaseFxTimer) clearTimeout(phaseFxTimer);
    phaseFxTimer = setTimeout(() => el.classList.remove('show'), 640);
  }

  function scheduleEndRedirect(delay = 1500) {
    if (endRedirectTimer) return;
    endRedirectTimer = setTimeout(() => {
      if (game?.winnerId) goLobby(true);
    }, delay);
  }

  function markEndedCooldown(ms = 8000) {
    const room = rid();
    if (!room) return;
    try {
      sessionStorage.setItem(`bp_room_end_cooldown_${room}`, String(Date.now() + ms));
    } catch { }
  }

  function hasLiveMatch() {
    return !isSpectator && !!(game && !game.winnerId);
  }

  function syncUrlWithState() {
    const room = rid();
    const agent = pid();
    if (!room || !agent) return;
    const u = new URL(location.href);
    let changed = false;
    if (!u.searchParams.get('roomId')) {
      u.searchParams.set('roomId', room);
      changed = true;
    }
    if (!u.searchParams.get('agentId')) {
      u.searchParams.set('agentId', agent);
      changed = true;
    }
    if (changed) history.replaceState(null, '', `${u.pathname}?${u.searchParams.toString()}`);
  }

  async function goLobby(force = false) {
    if (leavingGame) return;
    if (!force && hasLiveMatch()) {
      const ok = await (window.BP_ALERT?.confirm('진행 중인 게임에서 나가면 복귀가 번거로울 수 있어요. 이동할까요?', '대기실 이동 확인')
        ?? Promise.resolve(confirm('진행 중인 게임에서 나가면 복귀가 번거로울 수 있어요. 이동할까요?')));
      if (!ok) return;
    }
    if (game?.winnerId) markEndedCooldown();
    leavingGame = true;
    location.href = `/lobby.html?roomId=${encodeURIComponent(rid())}&agentId=${encodeURIComponent(pid())}${game?.winnerId ? '&ended=1' : ''}`;
  }

  function getHandOverlapPx(count, containerWidth = 0) {
    const n = Number(count || 0);
    if (n <= 1) return 0;

    const mobile = window.matchMedia?.('(max-width: 560px)')?.matches;
    const cardW = mobile ? 118 : 110;
    const available = Math.max(220, Number(containerWidth || 0));
    const total = cardW * n;
    const neededOverlap = Math.ceil((total - available) / (n - 1));
    return Math.max(0, Math.min(cardW - 34, neededOverlap));
  }

  function renderGame(r = {}) {
    if (r.game) game = r.game;
    if (r.agentNames && typeof r.agentNames === 'object') agentNames = r.agentNames;
    if (!game) return;

    const ids = Object.keys(game.agents || {});
    const participant = !!game.agents?.[pid()];
    isSpectator = isSpectator || !participant || !!r.spectator;

    const viewer = participant ? pid() : ids[0];
    const meAgent = game.agents?.[viewer];
    const oppId = ids.find((x) => x !== viewer);
    const opp = game.agents?.[oppId];
    viewMeId = viewer;
    viewOppId = oppId || '';
    const myTurn = game.activeAgentId === pid();

    const phaseKey = `${game.turn}:${game.activeAgentId}:${game.phase}`;
    if (phaseKey !== lastPhaseKey) {
      showPhaseFx(`${phaseLabel(game.phase)} 페이즈`);
      lastPhaseKey = phaseKey;
    }

    const turnEl = $('turnBanner');
    if (turnEl) {
      turnEl.className = `hud-turn ${myTurn ? 'is-me' : 'is-opp'}`;
      turnEl.textContent = `${displayName(game.activeAgentId)} 턴 · Turn ${game.turn}`;
    }

    const phaseEl = $('phaseBadge');
    if (phaseEl) phaseEl.textContent = phaseLabel(game.phase);

    const meta = $('metaBadges');
    if (meta) {
      meta.innerHTML = [
        `<span class="badge">Stack ${game.stack?.length || 0}</span>`,
        game.winnerId ? `<span class="badge">승자 ${winnerLabel(game.winnerId)}</span>` : ''
      ].join('');
    }

    const focus = $('focusChip');
    if (focus) focus.textContent = selectionText(meAgent);

    const selectedInfo = $('selectedInfo');
    if (selectedInfo) {
      const base = isSpectator ? '관전 모드: 액션을 할 수 없어요.' : (myTurn ? '행동할 수 있어요.' : `${displayName(game.activeAgentId)} 턴을 기다리는 중이에요.`);
      const recentRaw = Array.isArray(game.log) && game.log.length ? game.log[game.log.length - 1] : '';
      const recent = sanitizeRecentLog(recentRaw);
      selectedInfo.textContent = recent ? `${base} · 최근: ${recent}` : base;
    }

    $('myMon').innerHTML = (meAgent?.monsterZone || [null, null, null]).map((v, i) => {
      const u = v ? game?.units?.[v] : null;
      const selectedKey = selectedHand !== null ? meAgent?.hand?.[selectedHand] : null;
      const selectedDef = selectedKey ? cardDefByKey(selectedKey) : null;
      const canSelectAttacker = !!(v && u && !u.exhausted && myTurn && game.phase === 'battle');
      const canEquipTarget = !!(v && selectedHand !== null && selectedDef?.spellKind === 'equip' && myTurn && game.phase === 'main');
      const canDeploy = selectedHand !== null && !v && getCardType(meAgent?.hand?.[selectedHand]) === 'monster' && myTurn && game.phase === 'main';
      const click = canSelectAttacker || canDeploy || canEquipTarget;
      const fn = canSelectAttacker
        ? `selectAttacker(${i})`
        : (canDeploy ? `placeSelectedToMonster(${i})` : (canEquipTarget ? `selectSpellTarget(${i})` : ''));
      const extra = [
        v && selectedSpellTarget === v ? 'target-picked' : '',
        v && selectedAttacker === v ? 'attacker-picked' : '',
        v && u?.exhausted ? 'exhausted' : ''
      ].filter(Boolean).join(' ');
      const inspectAttr = v ? ` data-inspect-unit="${esc(v)}"` : '';
      return slot(renderCardContent({ unit: u }), click, fn, extra, inspectAttr);
    }).join('');

    $('oppMon').innerHTML = (opp?.monsterZone || [null, null, null]).map((v, i) => {
      const canTarget = !!(selectedAttacker && myTurn && game.phase === 'battle' && v);
      const u = v ? game?.units?.[v] : null;
      const fn = canTarget ? `attackOpponentUnit(${i})` : '';
      const inspectAttr = v ? ` data-inspect-unit="${esc(v)}"` : '';
      return slot(renderCardContent({ unit: u }), canTarget, fn, '', inspectAttr);
    }).join('');

    $('mySpell').innerHTML = (meAgent?.spellZone || [null, null, null, null]).map((v, i) => {
      const canDeploy = selectedHand !== null && !v && getCardType(meAgent?.hand?.[selectedHand]) === 'spell' && myTurn && game.phase === 'main';
      const spellKey = spellSlotKey(v);
      const fn = canDeploy ? `placeSelectedToSpell(${i})` : '';
      const inspectAttr = spellKey ? ` data-inspect-key="${esc(spellKey)}"` : '';
      return slot(renderCardContent({ key: spellKey }), canDeploy, fn, '', inspectAttr);
    }).join('');

    $('oppSpell').innerHTML = (opp?.spellZone || [null, null, null, null]).map((v) => {
      const spellKey = spellSlotKey(v);
      const inspectAttr = spellKey ? ` data-inspect-key="${esc(spellKey)}"` : '';
      return slot(renderCardContent({ key: spellKey }), false, '', '', inspectAttr);
    }).join('');

    const myDeckLeft = Array.isArray(meAgent?.deck) ? meAgent.deck.length : '-';
    const oppDeckLeft = Array.isArray(opp?.deck) ? opp.deck.length : '-';
    $('mySide').innerHTML = `<div class="hp">HP ${meAgent?.hp ?? '-'}</div><div class="mana">Mana ${meAgent?.mana ?? '-'}/${meAgent?.manaMax ?? '-'}</div>`;
    $('oppSide').innerHTML = `<div class="hp">HP ${opp?.hp ?? '-'}</div><div class="mana">Mana ${opp?.mana ?? '-'}/${opp?.manaMax ?? '-'}</div>`;

    const myGrave = meAgent?.graveyard || [];
    const oppGrave = opp?.graveyard || [];
    const myDeckEl = $('myDeck');
    if (myDeckEl) myDeckEl.textContent = `덱 ${myDeckLeft}장`;
    const oppDeckEl = $('oppDeck');
    if (oppDeckEl) oppDeckEl.textContent = `덱 ${oppDeckLeft}장`;
    const myGraveEl = $('myGrave');
    if (myGraveEl) myGraveEl.textContent = `무덤 ${myGrave.length}`;
    const oppGraveEl = $('oppGrave');
    if (oppGraveEl) oppGraveEl.textContent = `무덤 ${oppGrave.length}`;

    if (!isSpectator) {
      const handCards = meAgent?.hand || [];
      const handEl = $('hand');
      const overlap = getHandOverlapPx(handCards.length, handEl?.clientWidth || 0);
      handEl.style.setProperty('--hand-overlap', `${overlap}px`);
      handEl.classList.toggle('is-overlap', overlap > 0);
      handEl.innerHTML = handCards.map((k, i) => {
        const sel = selectedHand === i ? 'sel' : '';
        return `<button class="hand-card ${sel}" style="--hand-i:${i}" type="button" data-hand-index="${i}" onclick="handleHandCardClick(event, ${i})">${renderCardContent({ key: k, hand: true })}</button>`;
      }).join('');
      bindHandLongPress();
    } else {
      const handEl = $('hand');
      handEl.classList.remove('is-overlap');
      handEl.style.removeProperty('--hand-overlap');
      handEl.innerHTML = '<div class="muted">관전 중이에요.에는 손패 비공개</div>';
    }

    const overlay = $('gameEndOverlay');
    const text = $('gameEndText');
    if (game.winnerId) {
      if (overlay && text) {
        text.textContent = `${winnerLabel(game.winnerId)} 승리`;
        overlay.classList.remove('hidden');
      }
      markEndedCooldown();
      scheduleEndRedirect(1400);
    } else {
      overlay?.classList.add('hidden');
    }

    $('btnEnd').disabled = isSpectator || !myTurn;
    $('btnStack').disabled = isSpectator || !myTurn || (game.stack?.length || 0) === 0;
    $('btnConcede').disabled = isSpectator;
    const attackBtn = $('oppAttackPanel');
    if (attackBtn) attackBtn.disabled = isSpectator || !myTurn || game.phase !== 'battle' || !selectedAttacker;
  }


  async function refreshState(showToast = false) {
    const room = rid();
    if (leavingGame || !room) return;
    saveRoom(room);
    const meId = pid();
    if (meId) saveAgent(meId);
    const r = await api(`/api/rooms?action=state&roomId=${encodeURIComponent(room)}`);
    if (!r.ok) return;

    if (!r.game) {
      if (hadLiveGame) return goLobby(true);
      return;
    }

    hadLiveGame = true;
    const sig = gameSig(r.game);
    if (sig !== lastRenderSig || showToast) {
      renderGame(r);
      lastRenderSig = sig;
    }

    const isMyDrawPhase = !isSpectator && r.game?.activeAgentId === pid() && r.game?.phase === 'draw';
    if (isMyDrawPhase) {
      const key = `${r.game.turn}:${r.game.activeAgentId}:draw`;
      if (autoAdvanceDrawKey !== key) {
        autoAdvanceDrawKey = key;
        setTimeout(() => {
          if (game && game.activeAgentId === pid() && game.phase === 'draw' && !game.winnerId) act('end_phase');
        }, 700);
      }
    }

    const isMyEndPhase = !isSpectator && r.game?.activeAgentId === pid() && r.game?.phase === 'end';
    if (isMyEndPhase) {
      const key = `${r.game.turn}:${r.game.activeAgentId}:end`;
      if (autoAdvanceEndKey !== key) {
        autoAdvanceEndKey = key;
        setTimeout(() => {
          if (game && game.activeAgentId === pid() && game.phase === 'end' && !game.winnerId) act('end_phase');
        }, 700);
      }
    }

    if (r.game?.winnerId) scheduleEndRedirect(1400);
  }

  async function act(type, payload) {
    if (isSpectator) return;
    const r = await api('/api/game?action=action', 'POST', {
      roomId: rid(),
      action: { type, payload }
    });
    if (!r?.ok) {
      const msg = reasonLabel(r?.reason);
      await (window.BP_ALERT?.info(msg, '게임 액션') ?? Promise.resolve(alert(msg)));
      await refreshState(false);
      return;
    }
    renderGame(r);
    if (r?.matchEnded || r?.roomReset || r?.game?.winnerId) scheduleEndRedirect(1100);
  }

  function selectHand(i) {
    if (!game || game.activeAgentId !== pid()) return;
    selectedHand = selectedHand === i ? null : i;
    selectedAttacker = null;
    selectedSpellTarget = null;
    renderGame({});
  }

  function selectAttacker(zoneIndex) {
    const meAgent = game?.agents?.[pid()];
    const id = meAgent?.monsterZone?.[zoneIndex];
    const unit = id ? game?.units?.[id] : null;
    if (!id || !unit || unit.exhausted || game.phase !== 'battle' || game.activeAgentId !== pid()) return;
    selectedAttacker = selectedAttacker === id ? null : id;
    selectedHand = null;
    selectedSpellTarget = null;
    renderGame({});
  }


  function selectSpellTarget(zoneIndex) {
    const meAgent = game?.agents?.[pid()];
    const unitId = meAgent?.monsterZone?.[zoneIndex];
    if (!unitId) return;
    selectedSpellTarget = selectedSpellTarget === unitId ? null : unitId;
    selectedAttacker = null;
    renderGame({});
  }

  async function placeSelectedToMonster(zoneIndex) {
    if (selectedHand === null) return;
    const meAgent = game?.agents?.[pid()];
    const k = meAgent?.hand?.[selectedHand];
    if (!k || getCardType(k) !== 'monster') return;
    if (game.activeAgentId !== pid() || game.phase !== 'main') return;
    const def = cardDefByKey(k) || {};
    const payload = { handIndex: selectedHand, zoneIndex };
    if (def.spellKind === 'equip' && selectedSpellTarget) payload.targetUnitId = selectedSpellTarget;
    await act('play_card', payload);
    selectedHand = null;
    selectedSpellTarget = null;
    renderGame({});
  }

  async function placeSelectedToSpell(zoneIndex) {
    if (selectedHand === null) return;
    const meAgent = game?.agents?.[pid()];
    const k = meAgent?.hand?.[selectedHand];
    if (!k || getCardType(k) !== 'spell') return;
    if (game.activeAgentId !== pid() || game.phase !== 'main') return;
    const def = cardDefByKey(k) || {};
    const payload = { handIndex: selectedHand, zoneIndex };
    if (def.spellKind === 'equip' && selectedSpellTarget) payload.targetUnitId = selectedSpellTarget;
    await act('play_card', payload);
    selectedHand = null;
    selectedSpellTarget = null;
    renderGame({});
  }

  async function attackOpponentUnit(zoneIndex) {
    if (!selectedAttacker || game.phase !== 'battle') return;
    const ids = Object.keys(game.agents || {});
    const oppId = ids.find((x) => x !== pid());
    const target = game.agents?.[oppId]?.monsterZone?.[zoneIndex];
    if (!target) return;
    await act('attack', { attackerId: selectedAttacker, targetUnitId: target });
    selectedAttacker = null;
    renderGame({});
  }

  async function attackOpponentAgent() {
    if (!selectedAttacker || game.phase !== 'battle') return;
    await act('attack', { attackerId: selectedAttacker });
    selectedAttacker = null;
    renderGame({});
  }

  function handleHandCardClick(event, i) {
    if (Date.now() < suppressHandClickUntil) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    selectHand(i);
  }

  function clearHandLongPressState() {
    const handEl = $('hand');
    handEl?.querySelectorAll('.hand-card.pressing').forEach((el) => el.classList.remove('pressing'));
    if (handLongPressTimer) {
      clearTimeout(handLongPressTimer);
      handLongPressTimer = null;
    }
    handLongPressIndex = null;
  }

  function bindHandLongPress() {
    const handEl = $('hand');
    if (!handEl || handEl.dataset.lpBound === '1') return;
    handEl.dataset.lpBound = '1';

    handEl.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.hand-card[data-hand-index]');
      if (!btn) return;
      const idx = Number(btn.dataset.handIndex);
      if (!Number.isFinite(idx)) return;
      clearHandLongPressState();
      handLongPressIndex = idx;
      btn.classList.add('pressing');
      handLongPressTimer = setTimeout(() => {
        suppressHandClickUntil = Date.now() + 380;
        btn.classList.remove('pressing');
        const meAgent = game?.agents?.[viewMeId || pid()];
        const key = meAgent?.hand?.[idx];
        if (key) openCardOverlayByKey(key);
        handLongPressTimer = null;
      }, 420);
    });

    const cancel = () => clearHandLongPressState();
    handEl.addEventListener('pointerup', cancel);
    handEl.addEventListener('pointercancel', cancel);
    handEl.addEventListener('pointerleave', cancel);
  }

  function bindBoardInspectLongPress() {
    if (document.body.dataset.boardLpBound === '1') return;
    document.body.dataset.boardLpBound = '1';

    const clearBoardLongPress = () => {
      if (boardLongPressTimer) {
        clearTimeout(boardLongPressTimer);
        boardLongPressTimer = null;
      }
      document.querySelectorAll('.slot.pressing, .grave-card.pressing').forEach((el) => el.classList.remove('pressing'));
    };

    document.body.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.slot[data-inspect-unit], .slot[data-inspect-key], .grave-card[data-inspect-key]');
      if (!btn) return;
      clearBoardLongPress();
      btn.classList.add('pressing');
      const inspectUnit = btn.getAttribute('data-inspect-unit') || '';
      const inspectKey = btn.getAttribute('data-inspect-key') || '';
      boardLongPressTimer = setTimeout(() => {
        btn.classList.remove('pressing');
        if (inspectUnit) openCardOverlayByUnit(inspectUnit);
        else if (inspectKey) openCardOverlayByKey(inspectKey);
        boardLongPressTimer = null;
      }, 420);
    });

    document.body.addEventListener('pointerup', clearBoardLongPress);
    document.body.addEventListener('pointercancel', clearBoardLongPress);
    document.body.addEventListener('pointerleave', clearBoardLongPress);
  }

  function openGrave(which) {
    if (!game) return;
    const targetId = which === 'opp' ? viewOppId : viewMeId;
    const title = `${displayName(targetId)} 무덤`;
    const drawer = $('graveDrawer');
    const listEl = $('graveList');
    const titleEl = $('graveDrawerTitle');
    if (!drawer || !listEl || !titleEl || !targetId) return;

    const grave = Array.isArray(game.agents?.[targetId]?.graveyard) ? game.agents[targetId].graveyard : [];
    const latestFirst = [...grave].reverse();
    titleEl.textContent = `${title} (${grave.length})`;
    listEl.innerHTML = latestFirst.map((k) => `<button type="button" class="hand-card grave-card" data-inspect-key="${esc(k)}">${renderCardContent({ key: k, hand: true })}</button>`).join('')
      || '<div class="muted">무덤이 비어 있어요.</div>';
    drawer.classList.remove('hidden');
  }

  function closeGrave() {
    $('graveDrawer')?.classList.add('hidden');
  }

  async function concedeAndExit() {
    await act('concede');
    goLobby(true);
  }

  window.refreshState = refreshState;
  window.act = act;
  window.selectHand = selectHand;
  window.selectAttacker = selectAttacker;
  window.selectSpellTarget = selectSpellTarget;
  window.placeSelectedToMonster = placeSelectedToMonster;
  window.placeSelectedToSpell = placeSelectedToSpell;
  window.attackOpponentUnit = attackOpponentUnit;
  window.attackOpponentAgent = attackOpponentAgent;
  window.openGrave = openGrave;
  window.closeGrave = closeGrave;
  window.openCardOverlayByKey = openCardOverlayByKey;
  window.openCardOverlayByUnit = openCardOverlayByUnit;
  window.closeCardOverlay = closeCardOverlay;
  window.handleHandCardClick = handleHandCardClick;
  window.concedeAndExit = concedeAndExit;
  window.goLobby = goLobby;

  async function bootstrap() {
    LOADING.show('매치를 불러오는 중이에요...', { mode: 'percent' });
    try {
      const m = await api('/api/auth?action=me');
      if (!m.ok) {
        location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      me = m.user;
      saveAgent(me.username);
      const room = rid();
      const meId = pid();
      if (room) saveRoom(room);
      if (!room || !meId) {
        goLobby(true);
        return;
      }
      syncUrlWithState();
      await refreshState(false);
      bindBoardInspectLongPress();
      setInterval(() => refreshState(false), 2500);
    } finally {
      LOADING.hide();
    }
  }

  addEventListener('beforeunload', (e) => {
    if (!hasLiveMatch()) return;
    e.preventDefault();
    e.returnValue = '';
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCardOverlay();
  });

  bootstrap();
})();
