(() => {
  function create(deps = {}) {
    const {
      esc = (v) => String(v ?? ''),
      normalizeCardKey = (k) => k,
      getCardDef = () => ({}),
      getCardType = () => 'spell'
    } = deps;

    function normalizeEffectText(raw = '') {
      return String(raw || '')
        .replace(/([^\s(])\(/g, '$1 (')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    function renderCardContent({ key = null, unit = null, hand = false } = {}) {
      const baseKey = key || unit?.key || null;
      if (!baseKey) return `<div class="slot-empty"></div>`;
      const nk = normalizeCardKey(baseKey);
      const def = getCardDef(nk) || {};
      const name = def.name || nk;
      const effect = normalizeEffectText(def.effect || '');
      const type = getCardType(nk);
      const stat = unit
        ? `${unit.atk}/${unit.hp}`
        : (type === 'monster' && Number.isFinite(def.atk) && Number.isFinite(def.hp) ? `${def.atk}/${def.hp}` : '');
      const meta = [def.guard ? '가드' : '', def.race, def.theme, def.element].filter(Boolean).join(' | ');

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

    function renderCardButton({
      key,
      className = '',
      style = '',
      attrs = '',
      onClick = ''
    } = {}) {
      const cls = `hand-card ${className}`.trim();
      const styleAttr = style ? ` style="${style}"` : '';
      const clickAttr = onClick ? ` onclick="${onClick}"` : '';
      return `<button class="${cls}" type="button"${styleAttr}${attrs}${clickAttr}>${renderCardContent({ key, hand: true })}</button>`;
    }

    return { renderCardContent, renderCardButton };
  }

  window.BP_CARD_RENDER = { create };
})();
