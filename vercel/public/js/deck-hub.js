(() => {
  const $ = (id) => document.getElementById(id);
  const LOADING = globalThis.BP_LOADING || { show: () => {}, hide: () => {} };
  const S = globalThis.BP_SHARED_CARDS || {};
  const CODEC = globalThis.BP_DECK_CODEC || null;
  const defs = S.CARD_DEFS || {};
  const normalize = S.normalizeCardKey || ((k) => k);

  async function api(path, method = 'GET', body) {
    const opt = { method, headers: { 'content-type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: text || `HTTP ${r.status}` };
    }
  }

  function setStat(msg) {
    const el = $('hubStat');
    if (el) el.textContent = msg || '';
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function compareDeckOrder(aKey, bKey) {
    const a = normalize(aKey);
    const b = normalize(bKey);
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

  function summarizeDeck(code) {
    if (!CODEC || typeof CODEC.decodeDeckCode !== 'function') return null;
    const parsed = CODEC.decodeDeckCode(code || '');
    if (!parsed || !parsed.ok || !Array.isArray(parsed.deck)) return null;

    const count = new Map();
    const effectCount = new Map();
    const effectMap = [
      { k: '피해', re: /(피해|공격|직격|사격|폭파)/ },
      { k: '회복', re: /(회복|치유|수복)/ },
      { k: '서치', re: /(덱.*가져|탐색|서치)/ },
      { k: '전개', re: /(전개|소환|배치)/ },
      { k: '마나', re: /(마나|코스트|충전)/ },
      { k: '보호', re: /(수호|방어|보호)/ },
      { k: '장착', re: /(장착|부착)/ },
      { k: '연쇄', re: /(연쇄|스택|체인)/ }
    ];

    for (const raw of parsed.deck) {
      const key = normalize(raw);
      count.set(key, (count.get(key) || 0) + 1);
      const d = defs[key] || {};
      const txt = String(d.effect || '').toLowerCase();
      for (const em of effectMap) {
        if (em.re.test(txt)) effectCount.set(em.k, (effectCount.get(em.k) || 0) + 1);
      }
    }

    const rows = Array.from(count.entries())
      .map(([key, qty]) => ({ key, qty, name: defs[key]?.name || key }))
      .sort((a, b) => compareDeckOrder(a.key, b.key));

    const effects = Array.from(effectCount.entries())
      .filter(([, n]) => Number(n) > 0)
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'ko'))
      .slice(0, 6)
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'));

    return { total: parsed.deck.length, kinds: rows.length, rows, effects };
  }

  function buildDeckListHtml(summary) {
    if (!summary) return '<div class="muted">덱 리스트를 해석하지 못했어.</div>';
    const top = summary.rows.slice(0, 10)
      .map((r) => `<li><span>${esc(r.name)}</span><b>x${r.qty}</b></li>`)
      .join('');

    return `
      <div class="hub-decklist__head">
        <span>덱 리스트</span>
        <span class="muted">${summary.total}장 · ${summary.kinds}종</span>
      </div>
      <ul class="hub-decklist__list">${top}</ul>
      ${summary.rows.length > 10 ? `<div class="muted" style="margin-top:6px">외 ${summary.rows.length - 10}종</div>` : ''}
    `;
  }

  function buildEffectSummaryHtml(summary) {
    if (!summary) return '<div class="muted">효과 요약 없음</div>';
    const chips = (summary.effects || [])
      .map(([name, n]) => `<span class="hub-chip">${esc(name)} <b>${n}</b></span>`)
      .join('');
    return `
      <div class="hub-decklist__head">
        <span>효과 경향</span>
        <span class="muted">대략 요약</span>
      </div>
      <div class="hub-effects__chips">${chips || '<span class="muted">표시할 효과 없음</span>'}</div>
    `;
  }

  async function ensureAuth() {
    const m = await api('/api/auth?action=me');
    if (!m.ok) {
      location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return null;
    }
    return m.user;
  }

  function syncQueryState() {
    const u = new URL(location.href);
    const q = ($('hubQ')?.value || '').trim();
    const sort = ($('hubSort')?.value || 'latest').trim();
    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    if (sort && sort !== 'latest') u.searchParams.set('sort', sort); else u.searchParams.delete('sort');
    history.replaceState(null, '', `${u.pathname}${u.search}`);
  }

  function hydrateQueryState() {
    const u = new URL(location.href);
    const q = u.searchParams.get('q') || '';
    const sort = u.searchParams.get('sort') || 'latest';
    if ($('hubQ')) $('hubQ').value = q;
    if ($('hubSort')) $('hubSort').value = sort;
  }

  const PAGE_SIZE = 20;
  let hubOffset = 0;
  let hubTotal = 0;
  let meUser = null;

  function isMine(it) {
    const mine = String((meUser && (meUser.username || meUser.id)) || '');
    const owner = String(it.author || '');
    return !!mine && mine === owner;
  }

  function cardHtml(it) {
    const code = String(it.code || '');
    const summary = summarizeDeck(code);
    const deckListHtml = buildDeckListHtml(summary);
    const effectHtml = buildEffectSummaryHtml(summary);
    return `
      <article class="hub-card" data-code="${esc(code)}" id="code_${it.id}">
        <div class="hub-card__top">
          <div>
            <h3>${esc(it.title)}</h3>
            <div class="hub-meta">
              <span>@${esc(it.author)}</span>
              <span>${esc((it.tags || []).join(', '))}</span>
              <span>${it.cardsCount}장</span>
            </div>
          </div>
          <div class="hub-meta">
            <span>⬇ ${it.imports || 0}</span>
          </div>
        </div>
        <p class="muted">${esc(it.description || '')}</p>
        <div class="hub-card__body">
          <div class="hub-decklist">${deckListHtml}</div>
          <div class="hub-effects">${effectHtml}</div>
        </div>
        <div class="hub-actions">
          <button class="ghost" onclick="copyHubCode('${it.id}')">코드 복사</button>
          <button class="primary" onclick="importToDeck('${it.id}')">내 덱으로 가져오기</button>
          ${isMine(it) ? `<button class="ghost" onclick="deleteHubPost('${it.id}')" style="border-color:#8e3b3b;color:#ffb8b8">삭제</button>` : ''}
        </div>
      </article>
    `;
  }

  async function refreshHub(reset = true) {
    syncQueryState();
    if (reset) hubOffset = 0;

    const q = encodeURIComponent(($('hubQ')?.value || '').trim());
    const sort = encodeURIComponent(($('hubSort')?.value || 'latest').trim());
    const r = await api(`/api/deck-hub?q=${q}&sort=${sort}&limit=${PAGE_SIZE}&offset=${hubOffset}`);
    if (!r.ok) {
      setStat('허브 목록을 불러오지 못했어요.');
      return;
    }

    const list = $('hubList');
    const items = r.items || [];
    hubTotal = Number(r.total || 0);

    if (reset) {
      list.innerHTML = items.map(cardHtml).join('') || '<div class="panel">아직 올라온 덱이 없어요.</div>';
    } else {
      list.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
    }

    hubOffset += items.length;
    const moreBtn = $('hubLoadMore');
    if (moreBtn) {
      moreBtn.style.display = hubOffset < hubTotal ? 'inline-flex' : 'none';
    }

    setStat(`총 ${hubTotal}개 · ${hubOffset}개 표시`);
  }

  async function publishDeckPost() {
    const title = ($('postTitle')?.value || '').trim();
    const description = ($('postDesc')?.value || '').trim();
    const code = ($('postCode')?.value || '').trim();
    const tags = ($('postTags')?.value || '').split(',').map((x) => x.trim()).filter(Boolean);

    const r = await api('/api/deck-hub', 'POST', { title, description, code, tags });
    if (!r.ok) {
      const msg = String(r.error || 'unknown').split('\n')[0].slice(0, 120);
      setStat(`업로드 실패: ${msg}`);
      return;
    }
    setStat('덱을 허브에 올렸어요.');
    $('postTitle').value = '';
    $('postDesc').value = '';
    $('postTags').value = '';
    await refreshHub();
  }

  

  async function importToDeck(id) {
    const d = await api(`/api/deck-hub?action=detail&id=${encodeURIComponent(id)}`);
    if (!d.ok || !d.post) {
      setStat('덱 정보를 불러오지 못했어요.');
      return;
    }

    try {
      localStorage.setItem('bp_import_deck_code', d.post.code || '');
      await api('/api/deck-hub?action=import', 'POST', { id });
      location.href = '/deck.html';
    } catch {
      setStat('가져오기에 실패했어요.');
    }
  }

  async function copyHubCode(id) {
    const el = document.getElementById(`code_${id}`);
    if (!el) return;
    const text = el.getAttribute('data-code') || '';
    try {
      await navigator.clipboard.writeText(text);
      setStat('코드를 복사했어요.');
    } catch {
      setStat('복사에 실패했어요.');
    }
  }


  async function deleteHubPost(id) {
    const ok = await (window.BP_ALERT?.confirm('이 덱을 허브에서 삭제할까?', '덱 삭제 확인') ?? Promise.resolve(confirm('이 덱을 허브에서 삭제할까?')));
    if (!ok) return;
    const r = await api('/api/deck-hub?action=delete', 'POST', { id });
    if (!r.ok) {
      setStat('삭제 실패: 권한 또는 상태를 확인해 주세요.');
      return;
    }
    setStat('허브에서 삭제했어요.');
    await refreshHub(true);
  }

  async function loadMoreHub() {
    await refreshHub(false);
  }

  window.refreshHub = () => refreshHub(true);
  window.loadMoreHub = loadMoreHub;
  window.publishDeckPost = publishDeckPost;
  
  window.importToDeck = importToDeck;
  window.copyHubCode = copyHubCode;
  window.deleteHubPost = deleteHubPost;

  (async () => {
    LOADING.show('덱 허브를 불러오는 중이에요', { mode: 'percent' });
    try {
      hydrateQueryState();
      const user = await ensureAuth();
      if (!user) return;
      meUser = user;

      $('hubQ')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') refreshHub();
      });
      $('hubSort')?.addEventListener('change', () => refreshHub());

      await refreshHub();
    } finally {
      LOADING.hide();
    }
  })();
})();
