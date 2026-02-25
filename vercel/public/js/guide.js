(() => {
  const S = globalThis.BP_SHARED_CARDS || {};
  const keywordEl = document.getElementById('keywordGuideList');
  if (!keywordEl) return;

  const esc = (v) => String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const list = typeof S.buildKeywordCatalog === 'function'
    ? S.buildKeywordCatalog()
    : [];

  const keywordLabel = (name) => {
    const map = {
      deploy: (S.TERMS && S.TERMS.deploy) || '전개',
      active: (S.TERMS && S.TERMS.active) || '사용',
      continuous: (S.TERMS && S.TERMS.continuous) || '지속',
      forced: (S.TERMS && S.TERMS.forced) || '자동',
      optional: (S.TERMS && S.TERMS.optional) || '선택',
      search: (S.TERMS && S.TERMS.search) || '탐색',
      recruit: (S.TERMS && S.TERMS.recruit) || '징집',
      heal: (S.TERMS && S.TERMS.heal) || '치유',
      overcharge: (S.TERMS && S.TERMS.overcharge) || '충전',
      chain: (S.TERMS && S.TERMS.chain) || '연쇄',
      targeting: (S.TERMS && S.TERMS.targeting) || '지정',
      pressure: (S.TERMS && S.TERMS.pressure) || '피해',
      equip: (S.TERMS && S.TERMS.equip) || '장착',
      guard: (S.TERMS && S.TERMS.guard) || '수호',
      release: (S.TERMS && S.TERMS.release) || '희생',
      banish: (S.TERMS && S.TERMS.banish) || '제외',
      selfDestruct: (S.TERMS && S.TERMS.selfDestruct) || '자폭'
    };
    const raw = String(name || '').trim();
    return map[raw] || raw || '키워드';
  };

  const safeDesc = (desc) => {
    const raw = String(desc || '');
    if (!raw.trim()) return '설명이 아직 준비되지 않았어요.';
    return raw
      .replaceAll('priority_pass', '우선권 패스')
      .replaceAll('on_play', '사용 시점')
      .replaceAll('on_deploy', '전개 시점');
  };

  keywordEl.className = 'guide-bullets';
  keywordEl.innerHTML = (list || []).map((k) => `
    <div class="bullet">
      <span class="bullet-dot" aria-hidden="true"></span>
      <div class="muted lh15"><span class="code-token">${esc(keywordLabel(k.name))}</span> : ${esc(safeDesc(k.description))}</div>
    </div>
  `).join('') || '<div class="muted lh15">키워드 데이터가 없어요.</div>';
})();
