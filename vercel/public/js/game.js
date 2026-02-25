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
  let effectPickResolver = null;
  let actInFlight = false;
  let refreshSeq = 0;
  let uiBusyCount = 0;

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

  const CARD_RENDER = window.BP_CARD_RENDER?.create?.({
    esc,
    normalizeCardKey,
    getCardDef,
    getCardType
  }) || null;
  const TERM = (key, fallback) => (S.TERMS && S.TERMS[key]) || fallback;
  const KW_GUARD = TERM('guard', '수호');
  const KW_CHAIN = TERM('chain', '연쇄');
  const KW_SEARCH = TERM('search', '탐색');
  const KW_RECRUIT = TERM('recruit', '징집');
  const KW_EQUIP = TERM('equip', '장착');
  const UNIT_TARGET_KINDS = new Set(['attach_equipment', 'heal_unit', 'deal_damage_to_unit', 'self_destroy_unit', 'release_unit', 'banish_unit', 'lock_attack_this_turn']);

  function getEffectUnitTargetSpec(effects = []) {
    const targets = (Array.isArray(effects) ? effects : []).filter(Boolean);
    if (!targets.length) return null;

    let wantsAlly = false;
    let wantsEnemy = false;
    let required = false;

    for (const e of targets) {
      if (!isConditionMetLocal(e?.condition || {})) continue;
      const action = e?.action || {};
      if (!UNIT_TARGET_KINDS.has(action.kind)) continue;
      if (action.target === 'ally_front') {
        wantsAlly = true;
        if ((e?.mode || 'forced') !== 'optional') required = true;
      }
      if (action.target === 'enemy_front') {
        wantsEnemy = true;
        if ((e?.mode || 'forced') !== 'optional') required = true;
      }
    }

    if (!wantsAlly && !wantsEnemy) return null;
    if (wantsAlly && wantsEnemy) return { side: 'any', required };
    return { side: wantsEnemy ? 'enemy' : 'ally', required };
  }

  function getPendingUnitTargetSpec() {
    const meAgent = game?.agents?.[pid()];
    const cardKey = selectedHand !== null ? meAgent?.hand?.[selectedHand] : null;
    if (!cardKey) return null;
    const timing = getCardType(cardKey) === 'monster' ? 'on_deploy' : 'on_play';
    const def = cardDefByKey(cardKey) || {};
    const effects = Array.isArray(def.effects) ? def.effects : [];
    const timed = effects.filter((e) => e && e.timing === timing);
    return getEffectUnitTargetSpec(timed);
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
      'guard blocks direct attack': `상대 ${KW_GUARD} 유닛 때문에 직접 공격할 수 없어요.`,
      'stack empty': `해결할 ${KW_CHAIN}가 없어요.`,
      'stack payload missing': `${KW_CHAIN} 데이터가 없어 해결할 수 없어요.`,
      'stack not empty': '스택이 비어야 그 행동을 할 수 있어요.',
      'priority required': '지금은 우선권이 없어요.',
      'unsupported action': '지원하지 않는 행동이에요.',
      'game ended': '이미 게임이 끝났어요.',
      'unknown actor': '플레이어 정보를 찾을 수 없어요.',
      'battle blocked': '첫 턴에는 배틀이 제한돼요.',
      'opponent timeout': '상대 미응답으로 승리 처리됐어요.'
    };
    return map[String(reason || '')] || '지금은 그 행동을 할 수 없어요.';
  }


  function matchesCardFilterLocal(cardKey, filter = {}) {
    const k = normalizeCardKey(cardKey);
    const def = getCardDef(k) || {};
    if (filter.key && k !== filter.key) return false;
    if (filter.type && getCardType(k) !== filter.type) return false;
    if (filter.race && def.race !== filter.race) return false;
    if (filter.theme && def.theme !== filter.theme) return false;
    if (filter.element && def.element !== filter.element) return false;
    return true;
  }

  function isConditionMetLocal(condition = {}, context = {}) {
    if (!condition || typeof condition !== 'object' || !Object.keys(condition).length) return true;
    const meAgent = game?.agents?.[pid()];
    if (!meAgent) return false;

    const board = condition.actorBoardHas;
    if (board) {
      const min = Number(board.min || 1);
      const count = (meAgent.monsterZone || [])
        .map((uid) => uid && game?.units?.[uid])
        .filter(Boolean)
        .filter((u) => matchesCardFilterLocal(u.key, board))
        .length;
      if (count < min) return false;
    }

    if (condition.actorManaAtLeast != null) {
      if ((meAgent.mana || 0) < Number(condition.actorManaAtLeast)) return false;
    }

    return true;
  }

  function closeEffectPickOverlay(commit = false, picks = null) {
    const overlay = $('effectPickOverlay');
    if (overlay) overlay.classList.add('hidden');
    const done = effectPickResolver;
    effectPickResolver = null;
    if (typeof done === 'function') done(commit ? (Array.isArray(picks) ? picks : []) : null);
  }

  async function pickCardsFromOverlay(title, candidates = [], count = 1) {
    const overlay = $('effectPickOverlay');
    const titleEl = $('effectPickTitle');
    const guideEl = $('effectPickGuide');
    const listEl = $('effectPickList');
    if (!overlay || !titleEl || !guideEl || !listEl) return null;

    const picks = [];
    let pool = [...candidates];

    return await new Promise((resolve) => {
      effectPickResolver = resolve;

      const render = () => {
        titleEl.textContent = title;
        guideEl.textContent = `카드를 눌러 선택해줘. (${picks.length}/${count})`;

        listEl.innerHTML = pool.map((k, idx) => renderCardButton({
          key: k,
          className: 'effect-pick-overlay__item',
          attrs: ` data-pick-index="${idx}" data-inspect-key="${esc(k)}"`
        })).join('') || '<div class="muted">선택 가능한 카드가 없어요.</div>';

        listEl.querySelectorAll('[data-pick-index]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-pick-index'));
            if (!Number.isInteger(idx) || idx < 0 || idx >= pool.length) return;
            picks.push(pool[idx]);
            pool.splice(idx, 1);
            if (picks.length >= count || !pool.length) {
              closeEffectPickOverlay(true, picks);
              return;
            }
            render();
          });
        });
      };

      render();
      overlay.classList.remove('hidden');
    });
  }



  function pickBestTargetUnitId(action = {}) {
    const meId = pid();
    const ids = Object.keys(game?.agents || {});
    const oppId = ids.find((x) => x !== meId);

    const allyUnits = (game?.agents?.[meId]?.monsterZone || [])
      .map((uid) => uid && game?.units?.[uid])
      .filter(Boolean);
    const enemyUnits = (game?.agents?.[oppId]?.monsterZone || [])
      .map((uid) => uid && game?.units?.[uid])
      .filter(Boolean);

    if (action.target === 'ally_front') {
      if (selectedSpellTarget && game?.units?.[selectedSpellTarget]?.ownerId === meId) return selectedSpellTarget;
      return null;
    }
    if (action.target === 'enemy_front') {
      if (selectedSpellTarget && game?.units?.[selectedSpellTarget]?.ownerId === oppId) return selectedSpellTarget;
      return enemyUnits[0]?.id || null;
    }
    if (action.target === 'self_unit') return allyUnits[0]?.id || null;
    return null;
  }

  async function buildEffectSelectionPayload(cardKey, timing) {
    const def = cardDefByKey(cardKey) || {};
    const effects = Array.isArray(def.effects) ? def.effects : [];
    const targets = effects.filter((e) => e && e.timing === timing);
    if (!targets.length) return {};

    const meAgent = game?.agents?.[pid()];
    const deck = Array.isArray(meAgent?.deck) ? [...meAgent.deck] : [];

    const selectedEffectIndexes = [];
    const selectedEffectCardChoices = {};
    let targetUnitId = null;

    for (let i = 0; i < targets.length; i++) {
      const e = targets[i] || {};
      if (!isConditionMetLocal(e.condition || {})) continue;

      const manaCost = Number(e?.cost?.mana || 0);
      const manaNow = Number(meAgent?.mana || 0);
      const costHint = manaCost > 0 ? `마나 ${manaCost} 소모 (현재 ${manaNow})` : '마나 소모 없음';

      const isOptional = (e?.mode || 'forced') === 'optional';
      if (isOptional) {
        const ok = await (window.BP_ALERT?.confirm(`선택 효과를 발동할까?\n${costHint}`, '선택 효과') ?? Promise.resolve(true));
        if (!ok) continue;
      }
      selectedEffectIndexes.push(i);

      const kind = e?.action?.kind;
      const count = Math.max(1, Number(e?.action?.count || 1));
      let candidates = [];

      if (kind === 'search_deck_to_hand') {
        candidates = deck.filter((k) => matchesCardFilterLocal(k, e?.action?.filter || {}));
      } else if (kind === 'deploy_from_deck') {
        candidates = deck.filter((k) => getCardType(k) === 'monster' && matchesCardFilterLocal(k, e?.action?.filter || {}));
      }

      if (candidates.length) {
        const unique = [];
        const seen = new Set();
        for (const k of candidates) {
          const nk = normalizeCardKey(k);
          if (seen.has(nk)) continue;
          seen.add(nk);
          unique.push(nk);
        }
        const baseTitle = kind === 'search_deck_to_hand' ? `덱 ${KW_SEARCH} 카드 선택` : `${KW_RECRUIT} 카드 선택`;
        const title = manaCost > 0 ? `${baseTitle} · 마나 ${manaCost}` : baseTitle;
        const picked = await pickCardsFromOverlay(title, unique, Math.min(count, unique.length));
        if (picked == null) {
          if (isOptional) continue;
          return null;
        }
        selectedEffectCardChoices[String(i)] = picked;
      }

      const pickedTarget = pickBestTargetUnitId(e?.action || {});
      if (pickedTarget) targetUnitId = pickedTarget;
    }

    const payload = {};
    if (selectedEffectIndexes.length) payload.selectedEffectIndexes = selectedEffectIndexes;
    if (Object.keys(selectedEffectCardChoices).length) payload.selectedEffectCardChoices = selectedEffectCardChoices;
    if (targetUnitId) payload.targetUnitId = targetUnitId;
    return payload;
  }

  function winnerLabel(winnerId) {
    if (!winnerId) return '-';
    return actorLabel(winnerId);
  }

  function renderCardContent({ key = null, unit = null, hand = false } = {}) {
    if (CARD_RENDER?.renderCardContent) return CARD_RENDER.renderCardContent({ key, unit, hand });
    const baseKey = key || unit?.key || null;
    if (!baseKey) return `<div class="slot-empty"></div>`;
    const def = cardDefByKey(baseKey) || {};
    const name = def.name || baseKey;
    const effect = normalizeEffectText(def.effect || '');
    const type = getCardType(baseKey);
    const stat = unit
      ? `${unit.atk}/${unit.hp}`
      : (type === 'monster' && Number.isFinite(def.atk) && Number.isFinite(def.hp) ? `${def.atk}/${def.hp}` : '');
    const meta = [def.guard ? KW_GUARD : '', def.race, def.theme, def.element].filter(Boolean).join(' | ');

    const typeClass = type === 'monster' ? 'card-mini--unit' : 'card-mini--spell';
    return `
      <div class="card-mini ${typeClass} ${hand ? 'hand' : 'zone'}">
        <div class="card-mini__name">${esc(name)}</div>
        ${meta ? `<div class="card-mini__effect">${esc(meta)}</div>` : ''}
        ${effect ? `<div class="card-mini__effect">${esc(effect)}</div>` : '<div class="card-mini__effect muted">효과 없음</div>'}
        ${stat ? `<div class="card-mini__stat">${esc(stat)}</div>` : ''}
      </div>
    `;
  }

  const keywordDescMap = {
    ...(S.KEYWORD_TEXT || {}),
    [KW_GUARD]: (S.KEYWORD_TEXT && S.KEYWORD_TEXT[KW_GUARD]) || `상대 필드에 ${KW_GUARD} 유닛이 있으면 에이전트 직접 공격이 불가능하다.`
  };

  function keywordDescription(kw, def = {}) {
    const key = String(kw || '').trim();
    if (!key) return '설명이 없어요.';
    if (keywordDescMap[key]) return keywordDescMap[key];

    if (def?.race && key === String(def.race)) return '종족 태그: 일부 카드 효과의 조건으로 사용돼요.';
    if (def?.theme && key === String(def.theme)) return '테마 태그: 같은 테마 카드와의 시너지 조건으로 사용돼요.';
    if (def?.element && key === String(def.element)) return '속성 태그: 효과 조건/시너지 판정에 사용돼요.';

    return `카드 효과 텍스트 안의 키워드(${key})다.`;
  }

  function normalizeEffectText(raw = '') {
    return String(raw || '')
      .replace(/([^\s(])\(/g, '$1 (')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
    if (def?.guard) out.add(KW_GUARD);
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

    preview.innerHTML = renderCardButton({ key, className: 'card-overlay__card' });
    meta.innerHTML = `
      <div class="card-overlay__title">${esc(def.name || key)}</div>
      <div class="card-overlay__line">종류: ${esc(getCardType(key) === 'monster' ? '유닛' : '마법')}</div>
      <div class="card-overlay__line">코스트: ${esc(def.cost ?? 0)}</div>
      ${def.effect ? `<div class="card-overlay__effect">${esc(normalizeEffectText(def.effect))}</div>` : '<div class="card-overlay__effect muted">효과 없음</div>'}
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


  function renderCardButton({
    key,
    className = '',
    style = '',
    attrs = '',
    onClick = ''
  } = {}) {
    if (CARD_RENDER?.renderCardButton) {
      return CARD_RENDER.renderCardButton({ key, className, style, attrs, onClick });
    }
    const cls = `hand-card ${className}`.trim();
    const styleAttr = style ? ` style="${style}"` : '';
    const clickAttr = onClick ? ` onclick="${onClick}"` : '';
    return `<button class="${cls}" type="button"${styleAttr}${attrs}${clickAttr}>${renderCardContent({ key, hand: true })}</button>`;
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
      return `대상 유닛: ${cardName(u?.key || selectedSpellTarget)}`;
    }
    return '선택된 항목이 없어요.';
  }

  async function api(path, method = 'GET', body) {
    const opt = { method, headers: { 'content-type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    return await r.json();
  }



  function setActionButtonsDisabled(disabled) {
    for (const id of ['btnEnd', 'btnStack', 'btnConcede', 'oppAttackPanel']) {
      const el = $(id);
      if (el) {
        if (disabled) el.setAttribute('disabled', 'disabled');
        else el.removeAttribute('disabled');
      }
    }
  }

  function beginUiBusy(message = '처리 중이에요') {
    uiBusyCount += 1;
    setActionButtonsDisabled(true);
    if (uiBusyCount === 1) LOADING.show(message, { mode: 'spinner' });
  }

  function endUiBusy() {
    uiBusyCount = Math.max(0, uiBusyCount - 1);
    if (uiBusyCount === 0) {
      LOADING.hide();
      renderGame({});
    }
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

  const AUTO_END_REDIRECT = false;

  function scheduleEndRedirect(delay = 1500) {
    if (!AUTO_END_REDIRECT) return;
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
    const priorityHolder = game.priority?.holderId || game.activeAgentId;
    const myPriority = priorityHolder === pid();

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

    const boardEl = document.querySelector('.board');
    if (boardEl) {
      const myZone = boardEl.querySelector('.zone-block.me');
      const oppZone = boardEl.querySelector('.zone-block.opp');
      const activeIsMe = game.activeAgentId === pid();
      myZone?.classList.toggle('is-active-turn', !!activeIsMe);
      myZone?.classList.toggle('is-waiting-turn', !activeIsMe);
      oppZone?.classList.toggle('is-active-turn', !activeIsMe);
      oppZone?.classList.toggle('is-waiting-turn', !!activeIsMe);
    }

    const phaseEl = $('phaseBadge');
    if (phaseEl) phaseEl.textContent = phaseLabel(game.phase);

    const meta = $('metaBadges');
    if (meta) {
      meta.innerHTML = [
        `<span class="badge">Stack ${game.stack?.length || 0}</span>`,
        `<span class="badge">우선권 ${displayName(priorityHolder)}</span>`,
        game.winnerId ? `<span class="badge">승자 ${winnerLabel(game.winnerId)}</span>` : ''
      ].join('');
    }

    const focus = $('focusChip');
    if (focus) focus.textContent = selectionText(meAgent);

    const selectedInfo = $('selectedInfo');
    if (selectedInfo) {
      const base = isSpectator
        ? '관전 모드: 액션을 할 수 없어요.'
        : (myPriority
          ? '우선권이 있어요. 패스하거나 대응할 수 있어요.'
          : (myTurn ? '행동할 수 있어요.' : `${displayName(game.activeAgentId)} 턴을 기다리는 중이에요.`));
      selectedInfo.textContent = base;
    }

    $('myMon').innerHTML = (meAgent?.monsterZone || [null, null, null]).map((v, i) => {
      const u = v ? game?.units?.[v] : null;
      const selectedKey = selectedHand !== null ? meAgent?.hand?.[selectedHand] : null;
      const selectedDef = selectedKey ? cardDefByKey(selectedKey) : null;
      const targetSpec = getPendingUnitTargetSpec();
      const canSelectAttacker = !!(v && u && !u.exhausted && myTurn && game.phase === 'battle');
      const canEquipTarget = !!(v && selectedHand !== null && selectedDef?.spellKind === 'equip' && myTurn && game.phase === 'main');
      const canFieldTarget = !!(v && targetSpec && (targetSpec.side === 'ally' || targetSpec.side === 'any') && myTurn && game.phase === 'main');
      const canDeploy = selectedHand !== null && !v && getCardType(meAgent?.hand?.[selectedHand]) === 'monster' && myTurn && game.phase === 'main';
      const click = canSelectAttacker || canDeploy || canEquipTarget || canFieldTarget;
      const fn = canSelectAttacker
        ? `selectAttacker(${i})`
        : (canDeploy ? `placeSelectedToMonster(${i})` : ((canEquipTarget || canFieldTarget) ? `selectSpellTarget(${i})` : ''));
      const extra = [
        v && (canEquipTarget || canFieldTarget) ? 'targetable' : '',
        v && selectedSpellTarget === v ? 'target-picked' : '',
        v && selectedAttacker === v ? 'attacker-picked' : '',
        v && u?.exhausted ? 'exhausted' : ''
      ].filter(Boolean).join(' ');
      const inspectAttr = v ? ` data-inspect-unit="${esc(v)}"` : '';
      return slot(renderCardContent({ unit: u }), click, fn, extra, inspectAttr);
    }).join('');

    $('oppMon').innerHTML = (opp?.monsterZone || [null, null, null]).map((v, i) => {
      const targetSpec = getPendingUnitTargetSpec();
      const canAttackTarget = !!(selectedAttacker && myTurn && game.phase === 'battle' && v);
      const canFieldTarget = !!(v && targetSpec && (targetSpec.side === 'enemy' || targetSpec.side === 'any') && myTurn && game.phase === 'main');
      const canTarget = canAttackTarget || canFieldTarget;
      const u = v ? game?.units?.[v] : null;
      const fn = canAttackTarget ? `attackOpponentUnit(${i})` : (canFieldTarget ? `selectOpponentFieldTarget(${i})` : '');
      const extra = [
        v && canFieldTarget ? 'targetable' : '',
        v && selectedSpellTarget === v ? 'target-picked' : ''
      ].filter(Boolean).join(' ');
      const inspectAttr = v ? ` data-inspect-unit="${esc(v)}"` : '';
      return slot(renderCardContent({ unit: u }), canTarget, fn, extra, inspectAttr);
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
    const myHandCount = Array.isArray(meAgent?.hand) ? meAgent.hand.length : '-';
    const oppHandCount = Array.isArray(opp?.hand) ? opp.hand.length : '-';
    $('mySide').innerHTML = `
      <div class="stat-box stat-hp" aria-label="내 체력">
        <div class="stat-label">체력</div>
        <div class="stat-value">${meAgent?.hp ?? '-'}</div>
      </div>
      <div class="stat-box stat-mana" aria-label="내 마나">
        <div class="stat-label">마나</div>
        <div class="stat-value">${meAgent?.mana ?? '-'}/${meAgent?.manaMax ?? '-'}</div>
      </div>
      <div class="stat-box" aria-label="내 손패">
        <div class="stat-label">손패</div>
        <div class="stat-value">${myHandCount}</div>
      </div>
    `;
    $('oppSide').innerHTML = `
      <div class="stat-box stat-hp" aria-label="상대 체력">
        <div class="stat-label">체력</div>
        <div class="stat-value">${opp?.hp ?? '-'}</div>
      </div>
      <div class="stat-box stat-mana" aria-label="상대 마나">
        <div class="stat-label">마나</div>
        <div class="stat-value">${opp?.mana ?? '-'}/${opp?.manaMax ?? '-'}</div>
      </div>
      <div class="stat-box" aria-label="상대 손패">
        <div class="stat-label">손패</div>
        <div class="stat-value">${oppHandCount}</div>
      </div>
    `;

    const myGrave = meAgent?.graveyard || [];
    const oppGrave = opp?.graveyard || [];
    const myDeckEl = $('myDeck');
    if (myDeckEl) myDeckEl.textContent = `덱 ${myDeckLeft}`;
    const oppDeckEl = $('oppDeck');
    if (oppDeckEl) oppDeckEl.textContent = `덱 ${oppDeckLeft}`;
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
        return renderCardButton({
          key: k,
          className: sel,
          style: `--hand-i:${i}`,
          attrs: ` data-hand-index="${i}" data-inspect-key="${esc(k)}"`,
          onClick: `handleHandCardClick(event, ${i})`
        });
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
        const meWin = game.winnerId === pid();
        text.textContent = meWin ? '승리!' : '패배...';
        overlay.classList.remove('hidden');
      }
      markEndedCooldown();
      scheduleEndRedirect(1400);
    } else {
      overlay?.classList.add('hidden');
    }

    $('btnEnd').disabled = isSpectator || !myTurn || !myPriority;
    const passBtn = $('btnStack');
    if (passBtn) {
      passBtn.textContent = '우선권 패스';
      passBtn.disabled = isSpectator || !myPriority;
    }
    $('btnConcede').disabled = isSpectator;
    const attackBtn = $('oppAttackPanel');
    if (attackBtn) attackBtn.disabled = isSpectator || !myTurn || !myPriority || game.phase !== 'battle' || !selectedAttacker;
  }


  async function refreshState(showToast = false) {
    const room = rid();
    if (leavingGame || !room) return;
    saveRoom(room);
    const meId = pid();
    if (meId) saveAgent(meId);
    if (showToast) beginUiBusy('동기화 중이에요');
    try {
      const seq = ++refreshSeq;
      const r = await api(`/api/rooms?action=state&roomId=${encodeURIComponent(room)}`);
      if (seq !== refreshSeq) return;
      if (!r.ok) return;

      if (!r.game) {
        if (hadLiveGame) {
          // 종료 오버레이를 본 상태(승패 확정)에서는 자동 로비 이동하지 않는다.
          if (game?.winnerId) return;
          return goLobby(true);
        }
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
          if (game && game.activeAgentId === pid() && game.phase === 'draw' && !game.winnerId && !actInFlight) {
            act('end_phase', {}, { silent: true, source: 'auto-draw' });
          }
        }, 700);
      }
    }

    const isMyEndPhase = !isSpectator && r.game?.activeAgentId === pid() && r.game?.phase === 'end';
    if (isMyEndPhase) {
      const key = `${r.game.turn}:${r.game.activeAgentId}:end`;
      if (autoAdvanceEndKey !== key) {
        autoAdvanceEndKey = key;
        setTimeout(() => {
          if (game && game.activeAgentId === pid() && game.phase === 'end' && !game.winnerId && !actInFlight) {
            act('end_phase', {}, { silent: true, source: 'auto-end' });
          }
        }, 700);
      }
    }

    if (r.game?.winnerId) scheduleEndRedirect(1400);
    } finally {
      if (showToast) endUiBusy();
    }
  }

  async function act(type, payload, opts = {}) {
    if (isSpectator) return;
    if (actInFlight) return;
    actInFlight = true;
    if (!opts?.silent) beginUiBusy('행동 처리 중이에요');
    try {
      const r = await api('/api/game?action=action', 'POST', {
        roomId: rid(),
        action: { type, payload }
      });
      if (!r?.ok) {
        if (!opts?.silent) {
          const msg = reasonLabel(r?.reason);
          endUiBusy();
          await (window.BP_ALERT?.info(msg, '게임 액션') ?? Promise.resolve(alert(msg)));
        }
        await refreshState(false);
        return;
      }
      renderGame(r);
      lastRenderSig = gameSig(r.game);
      if (r?.matchEnded || r?.roomReset || r?.game?.winnerId) scheduleEndRedirect(1100);
    } finally {
      actInFlight = false;
      if (!opts?.silent) endUiBusy();
    }
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

  function selectOpponentFieldTarget(zoneIndex) {
    const ids = Object.keys(game?.agents || {});
    const oppId = ids.find((x) => x !== pid());
    const unitId = game?.agents?.[oppId]?.monsterZone?.[zoneIndex];
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
    const targetSpec = getPendingUnitTargetSpec();
    const payload = { handIndex: selectedHand, zoneIndex };
    if (targetSpec?.required && !selectedSpellTarget) {
      await (window.BP_ALERT?.info('대상 유닛을 먼저 선택해 주세요.', '대상 선택') ?? Promise.resolve(alert('대상 유닛을 먼저 선택해 주세요.')));
      return;
    }
    if (def.spellKind === 'equip' && selectedSpellTarget) payload.targetUnitId = selectedSpellTarget;
    else if (targetSpec && selectedSpellTarget) payload.targetUnitId = selectedSpellTarget;
    const effectPick = await buildEffectSelectionPayload(k, 'on_deploy');
    if (effectPick === null) return;
    Object.assign(payload, effectPick);
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
    const targetSpec = getPendingUnitTargetSpec();
    const payload = { handIndex: selectedHand, zoneIndex };

    if (targetSpec?.required && !selectedSpellTarget) {
      await (window.BP_ALERT?.info('대상 유닛을 먼저 선택해 주세요.', '대상 선택') ?? Promise.resolve(alert('대상 유닛을 먼저 선택해 주세요.')));
      return;
    }

    if (def.spellKind === 'equip' && selectedSpellTarget) payload.targetUnitId = selectedSpellTarget;
    else if (targetSpec && selectedSpellTarget) payload.targetUnitId = selectedSpellTarget;
    const effectPick = await buildEffectSelectionPayload(k, 'on_play');
    if (effectPick === null) return;
    Object.assign(payload, effectPick);
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
      const btn = e.target.closest('.slot[data-inspect-unit], .slot[data-inspect-key], .grave-card[data-inspect-key], .hand-card[data-inspect-key]');
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
    listEl.innerHTML = latestFirst.map((k) => renderCardButton({
      key: k,
      className: 'grave-card',
      attrs: ` data-inspect-key="${esc(k)}"`
    })).join('') || '<div class="muted">무덤이 비어 있어요.</div>';
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
  window.selectOpponentFieldTarget = selectOpponentFieldTarget;
  window.placeSelectedToMonster = placeSelectedToMonster;
  window.placeSelectedToSpell = placeSelectedToSpell;
  window.attackOpponentUnit = attackOpponentUnit;
  window.attackOpponentAgent = attackOpponentAgent;
  window.openGrave = openGrave;
  window.closeGrave = closeGrave;
  window.openCardOverlayByKey = openCardOverlayByKey;
  window.openCardOverlayByUnit = openCardOverlayByUnit;
  window.closeCardOverlay = closeCardOverlay;
  window.closeEffectPickOverlay = closeEffectPickOverlay;
  window.handleHandCardClick = handleHandCardClick;
  window.concedeAndExit = concedeAndExit;
  window.goLobby = goLobby;

  async function bootstrap() {
    LOADING.show('매치를 불러오는 중이에요', { mode: 'percent' });
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

  // 브라우저 기본 "사이트에서 나갈까요?" 경고를 사용하지 않는다.

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const effectPickOpen = !$('effectPickOverlay')?.classList.contains('hidden');
    if (effectPickOpen) {
      closeEffectPickOverlay(false);
      return;
    }
    closeCardOverlay();
  });

  bootstrap();
})();
