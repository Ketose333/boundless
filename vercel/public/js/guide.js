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
      deploy: '전개',
      active: '기동',
      continuous: '지속',
      forced: '강제',
      optional: '선택',
      search: '탐색',
      recruit: '징집',
      heal: '치유',
      overcharge: '과충전',
      chain: '연쇄',
      targeting: '대상',
      pressure: '제압',
      equip: '장착',
      guard: '가드'
    };
    const raw = String(name || '').trim();
    return map[raw] || raw || '키워드';
  };

  const safeDesc = (desc) => {
    const raw = String(desc || '');
    if (!raw.trim()) return '설명이 아직 준비되지 않았어요.';
    return raw
      .replaceAll('resolve_stack', '연쇄 해결')
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
