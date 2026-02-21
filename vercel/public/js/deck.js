(() => {
  const $ = (id) => document.getElementById(id);
  const S = globalThis.BP_SHARED_CARDS || {};
  const defs = S.CARD_DEFS || {};
  const normalize = S.normalizeCardKey || ((k) => k);
  const races = S.CARD_RACES || [];
  const themes = S.CARD_THEMES || [];
  const elements = S.CARD_ELEMENTS || [];

  const allCards = Object.keys(defs).sort((a, b) => a.localeCompare(b));
  const PAGE_SIZE = 12;

  let deck = [];
  let me = null;
  let poolPage = 1;
  let filter = { race: '', theme: '', element: '' };
  const LOADING = globalThis.BP_LOADING || { show: () => {}, hide: () => {} };
  const C = globalThis.BP_RULES_CONST || { MIN_DECK: 30, MAX_SAME_CARD: 3 };

  const q = new URLSearchParams(location.search);
  const initAgent = q.get('agentId') || '';
  $('agentId').value = initAgent;

  function setStatus(msg) {
    const el = $('deckStat');
    if (!el) return;
    if (!msg) return;
    const safe = String(msg);
    el.textContent = `${el.textContent} · ${safe}`;
  }

  function spellKindLabel(kind) {
    const map = { normal: '일반', continuous: '지속', equip: '장착' };
    return map[String(kind || '').toLowerCase()] || '마법';
  }

  function safeCardName(def, key) {
    if (def?.name) return def.name;
    return '알 수 없는 카드';
  }

  function saveErrorLabel(err) {
    const raw = String(err || '').toLowerCase();
    if (raw.includes('agent')) return '플레이어 정보가 올바르지 않아요.';
    if (raw.includes('deck')) return '덱 데이터 형식이 올바르지 않아요.';
    if (raw.includes('min')) return `덱은 ${C.MIN_DECK}장 이상이어야 해요.`;
    return '저장에 실패했어요. 잠시 후 다시 시도해 주세요.';
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
        <div class='deck-card__effect'>${d.effect || '효과 없음'}</div>
        <div class='deck-card__actions'>
          <button class='ghost' onclick="removeCard('${k}')">-1</button>
          <button class='primary' onclick="addCard('${k}')">+1</button>
        </div>
      </article>`;
    }).join('');

    const info = $('poolPageInfo');
    if (info) info.textContent = `${poolPage} / ${totalPages}`;

    $('deck').innerHTML = Object.entries(c)
      .sort((a, b) => a[0].localeCompare(b[0]))
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
              <div class='deck-card__effect'>${d.effect || '효과 없음'}</div>
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

  window.prevPoolPage = () => { poolPage = Math.max(1, poolPage - 1); render(); };
  window.nextPoolPage = () => {
    const total = Math.max(1, Math.ceil(filteredCards().length / PAGE_SIZE));
    poolPage = Math.min(total, poolPage + 1);
    render();
  };

  window.loadDeck = async () => {
    if (!agentId()) return;
    const r = await api(`/api/deck?agentId=${encodeURIComponent(agentId())}`);
    if (!r.ok) return setStatus('불러오기에 실패했어요.');
    deck = Array.isArray(r.deck) ? r.deck.map(normalize) : [];
    render();
    setStatus('불러왔어요.');
  };

  window.saveDeck = async () => {
    if (!agentId()) return;
    if (deck.length < C.MIN_DECK) return setStatus(`덱은 ${C.MIN_DECK}장 이상이어야 합니다.`);
    const r = await api('/api/deck', 'POST', { agentId: agentId(), deck });
    if (!r.ok) return setStatus(saveErrorLabel(r.error));
    setStatus('저장 완료');
  };

  window.goLobby = () => {
    const p = new URLSearchParams();
    if (agentId()) p.set('agentId', agentId());
    location.href = '/lobby.html' + (p.toString() ? `?${p}` : '');
  };

  async function bootstrap() {
    LOADING.show('덱 화면을 불러오는 중이에요...', { mode: 'percent' });
    try {
      const m = await api('/api/auth?action=me');
      if (!m.ok) {
        location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      me = m.user;
      $('agentId').value = me.username;
      renderFilters();
      await window.loadDeck();
      render();
    } finally {
      LOADING.hide();
    }
  }

  bootstrap();
})();
