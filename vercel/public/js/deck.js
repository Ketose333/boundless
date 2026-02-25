(() => {
  const $ = (id) => document.getElementById(id);
  const S = globalThis.BP_SHARED_CARDS || {};
  const defs = S.CARD_DEFS || {};
  const normalize = S.normalizeCardKey || ((k) => k);
  const races = [...(S.CARD_RACES || [])].sort((a, b) => a.localeCompare(b, 'ko'));
  const themes = [...(S.CARD_THEMES || [])].sort((a, b) => a.localeCompare(b, 'ko'));
  const elements = S.CARD_ELEMENTS || [];

  function compareCardKeys(a, b) {
    const ta = String(defs[a]?.theme || '');
    const tb = String(defs[b]?.theme || '');
    const themeCmp = ta.localeCompare(tb, 'ko');
    if (themeCmp !== 0) return themeCmp;

    const na = String(defs[a]?.name || a);
    const nb = String(defs[b]?.name || b);
    const nameCmp = na.localeCompare(nb, 'ko');
    if (nameCmp !== 0) return nameCmp;

    return a.localeCompare(b);
  }

  const allCards = Object.keys(defs).sort(compareCardKeys);
  const PAGE_SIZE = 10;

  let deck = [];
  let me = null;
  let slots = [];
  let activeSlotId = '';
  let poolPage = 1;
  let filter = { race: '', theme: '', element: '' };
  const LOADING = globalThis.BP_LOADING || { show: () => {}, hide: () => {} };
  const C = globalThis.BP_RULES_CONST || { MIN_DECK: 30, MAX_SAME_CARD: 3 };
  const CODEC = globalThis.BP_DECK_CODEC || null;

  const q = new URLSearchParams(location.search);
  const initAgent = q.get('agentId') || '';
  $('agentId').value = initAgent;

  function setStatus(msg) {
    const el = $('deckStat');
    if (!el) return;
    if (!msg) return;
    const safe = String(msg).replace(/\s+/g, ' ').trim();
    // 상태는 항상 최신 1건만 노출한다.
    el.textContent = safe;
  }

  function spellKindLabel(kind) {
    const map = { normal: '일반', continuous: '지속', equip: '장착' };
    return map[String(kind || '').toLowerCase()] || '마법';
  }

  function safeCardName(def, key) {
    if (def?.name) return def.name;
    return '알 수 없는 카드';
  }

  function normalizeEffectText(raw = '') {
    return String(raw || '')
      .replace(/([^\s(])\(/g, '$1 (')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function saveErrorLabel(err) {
    const raw = String(err || '').toLowerCase();
    if (raw.includes('agent')) return '플레이어 정보가 올바르지 않아요.';
    if (raw.includes('deck')) return '덱 데이터 형식이 올바르지 않아요.';
    if (raw.includes('min')) return `덱은 ${C.MIN_DECK}장 이상이어야 해요.`;
    return '저장에 실패했어요. 잠시 후 다시 시도해 주세요.';
  }

  function recipeErrorLabel(code) {
    const map = {
      EMPTY: '덱 코드가 비어 있어요.',
      INVALID_FORMAT: '덱 코드 형식이 올바르지 않아요.',
      INVALID_JSON: '덱 코드 해석에 실패했어요.',
      INVALID_VERSION: '지원하지 않는 덱 코드 버전이에요.',
      INVALID_CARDS: '카드 목록 형식이 올바르지 않아요.',
      UNKNOWN_CARD: '존재하지 않는 카드가 포함되어 있어요.',
      INVALID_COUNT: `카드 수량은 1~${C.MAX_SAME_CARD}장만 가능해요.`,
      DECK_MIN: `덱은 최소 ${C.MIN_DECK}장 이상이어야 해요.`
    };
    return map[code] || '덱 코드를 적용하지 못했어요.';
  }

  function encodeRecipeCode() {
    if (!CODEC || typeof CODEC.encodeV2FromCounts !== 'function') return '';
    return CODEC.encodeV2FromCounts(countMap());
  }

  function decodeRecipeCode(rawCode) {
    if (!CODEC || typeof CODEC.decodeDeckCode !== 'function') return { ok: false, reason: 'INVALID_FORMAT' };
    const parsed = CODEC.decodeDeckCode(rawCode);
    if (!parsed.ok) return parsed;
    if ((parsed.deck || []).length < C.MIN_DECK) return { ok: false, reason: 'DECK_MIN' };
    return { ok: true, deck: parsed.deck };
  }

  function agentId() { return (me?.username || $('agentId').value.trim()); }

  async function api(path, method = 'GET', body) {
    const opt = { method, headers: { 'content-type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    return await r.json();
  }

  function countMap() {
    const m = {};
    for (const k of deck) m[k] = (m[k] || 0) + 1;
    return m;
  }

  function filteredCards() {
    return allCards.filter((k) => {
      const d = defs[k] || {};
      if (filter.race && d.race !== filter.race) return false;
      if (filter.theme && d.theme !== filter.theme) return false;
      if (filter.element && d.element !== filter.element) return false;
      return true;
    });
  }

  function renderFilters() {
    const wrap = $('poolFilters');
    if (!wrap) return;
    const mk = (id, label, items) => `
      <label class="pool-filter">${label}
        <select id="${id}">
          <option value="">전체</option>
          ${items.map((x) => `<option value="${x}">${x}</option>`).join('')}
        </select>
      </label>`;

    wrap.innerHTML = [
      mk('filterRace', '종족', races),
      mk('filterTheme', '테마', themes),
      mk('filterElement', '속성', elements)
    ].join('');

    $('filterRace').value = filter.race;
    $('filterTheme').value = filter.theme;
    $('filterElement').value = filter.element;

    const onChange = () => {
      filter = {
        race: $('filterRace').value,
        theme: $('filterTheme').value,
        element: $('filterElement').value
      };
      poolPage = 1;
      render();
    };

    $('filterRace').onchange = onChange;
    $('filterTheme').onchange = onChange;
    $('filterElement').onchange = onChange;
  }

  function renderSlotPicker() {
    const sel = $('deckSlot');
    if (!sel) return;
    sel.innerHTML = (slots || []).map((s) => `<option value="${s.id}">${s.name || '덱 슬롯'}</option>`).join('');
    if (activeSlotId) sel.value = activeSlotId;
  }

  function render() {
    const c = countMap();
    const valid = deck.length >= C.MIN_DECK;
    $('deckStat').textContent = `${deck.length}장 (최소 ${C.MIN_DECK} / 동명 최대 ${C.MAX_SAME_CARD}) ${valid ? '· 사용 가능' : '· 미완성'}`;

    const cards = filteredCards();
    const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
    if (poolPage > totalPages) poolPage = totalPages;
    if (poolPage < 1) poolPage = 1;
    const start = (poolPage - 1) * PAGE_SIZE;
    const pageCards = cards.slice(start, start + PAGE_SIZE);

    $('pool').className = 'deck-pool-grid';
    $('pool').innerHTML = pageCards.map((k) => {
      const d = defs[k];
      const n = c[k] || 0;
      const typeLabel = d.type === 'monster' ? '유닛' : '마법';
      const stat = d.type === 'monster' ? `${d.atk}/${d.hp}` : spellKindLabel(d.spellKind);
      const chips = [d.race, d.theme, d.element].filter(Boolean)
        .map((v) => `<span class='deck-chip'>${v}</span>`)
        .join('');
      return `<article class='deck-card'>
        <div class='deck-card__top'>
          <b>${safeCardName(d, k)}</b>
          <span class='deck-card__count'>x${n}</span>
        </div>
        <div class='muted'>비용 ${d.cost} · ${typeLabel} · ${stat}</div>
        <div class='deck-card__meta'>${chips}</div>
        <div class='deck-card__effect'>${normalizeEffectText(d.effect || '') || '효과 없음'}</div>
        <div class='deck-card__actions'>
          <button class='ghost' onclick="removeCard('${k}')">-1</button>
          <button class='primary' onclick="addCard('${k}')">+1</button>
        </div>
      </article>`;
    }).join('');

    const info = $('poolPageInfo');
    if (info) info.textContent = `${poolPage} / ${totalPages}`;

    $('deck').innerHTML = Object.entries(c)
      .sort((a, b) => compareCardKeys(a[0], b[0]))
      .map(([k, n]) => {
        const d = defs[k] || {};
        const typeLabel = d.type === 'monster' ? '유닛' : '마법';
        const stat = d.type === 'monster' ? `${d.atk ?? '-'}/${d.hp ?? '-'}` : spellKindLabel(d.spellKind);
        const chips = [d.race, d.theme, d.element].filter(Boolean)
          .map((v) => `<span class='deck-chip'>${v}</span>`)
          .join('');
        return `
          <details class='deck-line deck-line--fold'>
            <summary>
              <span>
                <strong>${safeCardName(d, k)}</strong>
                <small class="muted">비용 ${d.cost ?? '-'} · ${typeLabel} · ${stat}</small>
                <div class='deck-card__meta'>${chips}</div>
              </span>
              <b>x${n}</b>
            </summary>
            <div class='deck-line__detail'>
              <div class='deck-card__effect'>${normalizeEffectText(d.effect || '') || '효과 없음'}</div>
            </div>
          </details>
        `;
      })
      .join('') || '<div class="muted">비어 있어요.</div>';
  }

  window.addCard = (k) => {
    const nk = normalize(k);
    const c = countMap();
    if ((c[nk] || 0) >= C.MAX_SAME_CARD) return setStatus(`동명 ${C.MAX_SAME_CARD}장 제한`);
    deck.push(nk);
    render();
  };

  window.removeCard = (k) => {
    const nk = normalize(k);
    const i = deck.indexOf(nk);
    if (i >= 0) deck.splice(i, 1);
    render();
  };

  window.createSlot = async () => {
    const nameInput = await (window.BP_ALERT?.prompt('새 슬롯 이름을 입력해 주세요.', '슬롯 추가', {
      inputValue: `덱 ${(slots || []).length + 1}`
    }) ?? Promise.resolve(prompt('새 슬롯 이름', `덱 ${(slots || []).length + 1}`)));
    if (nameInput == null) return;
    const name = String(nameInput || '').trim();
    const r = await api('/api/deck?action=create_slot', 'POST', { agentId: agentId(), name });
    if (!r.ok) return setStatus('슬롯 생성 실패');
    slots = Array.isArray(r.slots) ? r.slots : [];
    activeSlotId = String(r.activeSlotId || '');
    renderSlotPicker();
    deck = currentSlotDeck();
    render();
    setStatus('슬롯을 추가했어요.');
  };

  window.deleteSlot = async () => {
    if (!activeSlotId) return;
    const ok = await (window.BP_ALERT?.confirm('현재 슬롯을 삭제할까?', '슬롯 삭제 확인') ?? Promise.resolve(confirm('현재 슬롯을 삭제할까?')));
    if (!ok) return;
    const r = await api('/api/deck?action=delete_slot', 'POST', { agentId: agentId(), slotId: activeSlotId });
    if (!r.ok) return setStatus('슬롯 삭제 실패(최소 1개 필요)');
    slots = Array.isArray(r.slots) ? r.slots : [];
    activeSlotId = String(r.activeSlotId || '');
    renderSlotPicker();
    deck = currentSlotDeck();
    render();
    setStatus('슬롯을 삭제했어요.');
  };

  window.switchSlot = async (slotId) => {
    const r = await api('/api/deck?action=switch_slot', 'POST', { agentId: agentId(), slotId });
    if (!r.ok) return setStatus('슬롯 전환 실패');
    slots = Array.isArray(r.slots) ? r.slots : [];
    activeSlotId = String(r.activeSlotId || '');
    renderSlotPicker();
    deck = currentSlotDeck();
    render();
    setStatus('슬롯을 전환했어요.');
  };

  window.prevPoolPage = () => { poolPage = Math.max(1, poolPage - 1); render(); };
  window.nextPoolPage = () => {
    const total = Math.max(1, Math.ceil(filteredCards().length / PAGE_SIZE));
    poolPage = Math.min(total, poolPage + 1);
    render();
  };

  async function loadSlots() {
    if (!agentId()) return false;
    const r = await api(`/api/deck?action=slots&agentId=${encodeURIComponent(agentId())}`);
    if (!r.ok) return false;
    slots = Array.isArray(r.slots) ? r.slots : [];
    activeSlotId = String(r.activeSlotId || '');
    renderSlotPicker();
    return true;
  }

  function currentSlotDeck() {
    const cur = (slots || []).find((s) => s.id === activeSlotId);
    return Array.isArray(cur?.deck) ? cur.deck.map(normalize) : [];
  }

  window.loadDeck = async () => {
    if (!agentId()) return;
    const okSlots = await loadSlots();
    if (!okSlots) return setStatus('슬롯을 불러오지 못했어요.');
    deck = currentSlotDeck();
    render();
    setStatus('불러왔어요.');
  };

  window.saveDeck = async () => {
    if (!agentId()) return;
    if (deck.length < C.MIN_DECK) return setStatus(`덱은 ${C.MIN_DECK}장 이상이어야 해요.`);
    const r = await api('/api/deck', 'POST', { agentId: agentId(), deck });
    if (!r.ok) return setStatus(saveErrorLabel(r.error));
    setStatus('저장 완료');
  };

  window.exportDeckCode = async () => {
    if (deck.length < C.MIN_DECK) {
      setStatus(`덱은 ${C.MIN_DECK}장 이상이어야 코드 생성이 가능해요.`);
      return;
    }
    const code = encodeRecipeCode();
    const el = $('deckCode');
    if (el) el.value = code;
    try {
      await navigator.clipboard.writeText(code);
      setStatus('덱 코드를 생성하고 클립보드에 복사했어요.');
    } catch {
      setStatus('덱 코드를 생성했어요.');
    }
  };

  window.importDeckCode = () => {
    const code = $('deckCode')?.value || '';
    const result = decodeRecipeCode(code);
    if (!result.ok) {
      setStatus(recipeErrorLabel(result.reason));
      return;
    }
    deck = result.deck;
    render();
    setStatus('덱 코드를 적용했어요.');
  };

  window.goLobby = () => {
    const p = new URLSearchParams();
    if (agentId()) p.set('agentId', agentId());
    location.href = '/lobby.html' + (p.toString() ? `?${p}` : '');
  };

  async function applyPendingImportCode() {
    const pending = localStorage.getItem('bp_import_deck_code') || '';
    if (!pending) return;
    localStorage.removeItem('bp_import_deck_code');
    const codeEl = $('deckCode');
    if (codeEl) codeEl.value = pending;
    const result = decodeRecipeCode(pending);
    if (!result.ok) {
      setStatus(recipeErrorLabel(result.reason));
      return;
    }
    const r = await api('/api/deck?action=import_slot', 'POST', {
      agentId: agentId(),
      name: `허브 덱 ${new Date().toLocaleDateString('ko-KR')}`,
      deck: result.deck,
    });
    if (!r.ok) {
      setStatus('허브 덱 슬롯 생성 실패. 슬롯 수를 확인해줘.');
      return;
    }
    slots = Array.isArray(r.slots) ? r.slots : [];
    activeSlotId = String(r.activeSlotId || '');
    renderSlotPicker();
    deck = currentSlotDeck();
    render();
    setStatus('허브 덱을 새 슬롯으로 가져왔어요.');
  }

  async function bootstrap() {
    LOADING.show('덱 화면을 불러오는 중이에요', { mode: 'percent' });
    try {
      const m = await api('/api/auth?action=me');
      if (!m.ok) {
        location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      me = m.user;
      $('agentId').value = me.username;
      renderFilters();
      $('deckSlot')?.addEventListener('change', (e) => {
        const v = String(e.target?.value || '');
        if (v) window.switchSlot(v);
      });
      await window.loadDeck();
      render();
      await applyPendingImportCode();
    } finally {
      LOADING.hide();
    }
  }

  bootstrap();
})();
