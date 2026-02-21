(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.BP_SHARED_CARDS = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // 키워드/용어 단일 소스
  const TERMS = {
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

  const KEYWORD_TEXT = {
    [TERMS.deploy]: '카드를 존에 배치하고 기본 비용을 지불한다.',
    [TERMS.active]: '메인 페이즈에 수동으로 발동하는 효과다.',
    [TERMS.continuous]: '필드에 남아 있는 동안 영향이 유지된다.',
    [TERMS.forced]: '조건을 만족하면 자동으로 적용된다.',
    [TERMS.optional]: '사용자가 조건을 보고 발동 여부를 선택한다.',
    [TERMS.search]: '덱에서 조건에 맞는 카드를 찾아 손패로 가져온다.',
    [TERMS.recruit]: '덱에서 유닛을 즉시 필드로 전개한다.',
    [TERMS.heal]: '유닛 체력을 회복한다.',
    [TERMS.overcharge]: '일시적으로 마나를 획득한다.',
    [TERMS.chain]: '스택에 올린 뒤 resolve_stack 시점에 해결된다.',
    [TERMS.targeting]: '효과가 아군/적군/특정 유닛을 대상으로 지정한다.',
    [TERMS.pressure]: '적 유닛이나 에이전트에게 직접 피해를 준다.',
    [TERMS.equip]: '아군 유닛에 부착되어 능력치를 강화한다.',
    [TERMS.guard]: '상대 필드에 가드 유닛이 있으면 에이전트를 직접 공격할 수 없다.'
  };

  const ACTION_KEYWORD = {
    heal_self_unit: TERMS.heal,
    search_to_hand: TERMS.search,
    recruit_from_deck: TERMS.recruit,
    gain_mana: TERMS.overcharge,
    push_stack: TERMS.chain,
    damage_unit: TERMS.pressure,
    heal_unit: TERMS.targeting,
    damage_agent: TERMS.pressure,
    attach_equip: TERMS.equip
  };

  const STACK_EFFECT_DEFAULTS = {
    direct_hit: { kind: 'damage_agent', target: 'opponent', value: 3 }
  };

  const CARD_RACES = ['인간족', '기계족', '야전족', '술법'];
  const CARD_THEMES = ['선봉', '방호', '화력', '전술', '정비', '연금', '심연'];
  const CARD_ELEMENTS = ['불', '물', '바람', '땅', '빛', '어둠', '전기', '무'];

  const META_DEFAULTS = {
    monster: { race: '인간족', theme: '선봉', element: '무' },
    spell: { race: '술법', theme: '전술', element: '무' }
  };

  const CARD_META_OVERRIDES = {
    vanguard: { race: '인간족', theme: '선봉', element: '빛' },
    sharpshooter: { race: '인간족', theme: '화력', element: '바람' },
    heavy_cavalry: { race: '인간족', theme: '선봉', element: '땅' },
    guard_corps: { race: '인간족', theme: '방호', element: '땅' },
    war_engine: { race: '기계족', theme: '화력', element: '불' },
    field_medic: { race: '인간족', theme: '연금', element: '물' },
    interceptor: { race: '인간족', theme: '화력', element: '바람' },
    vanguard_captain: { race: '인간족', theme: '선봉', element: '빛' },
    direct_hit: { race: '술법', theme: '심연', element: '불' },
    tactical_order: { race: '술법', theme: '전술', element: '빛' },
    overload: { race: '술법', theme: '연금', element: '전기' },
    defense_stance: { race: '술법', theme: '방호', element: '땅' },
    battlefield_analysis: { race: '술법', theme: '전술', element: '빛' },
    suppression_fire: { race: '술법', theme: '심연', element: '불' },
    emergency_repair: { race: '술법', theme: '연금', element: '물' },
    chain_burst: { race: '술법', theme: '심연', element: '어둠' },
    reserve_call: { race: '술법', theme: '선봉', element: '바람' },
    tactical_volley: { race: '술법', theme: '심연', element: '불' },
    reinforced_blade: { race: '술법', theme: '선봉', element: '불' },
    guardian_plating: { race: '술법', theme: '방호', element: '땅' },
    element_resonance: { race: '술법', theme: '전술', element: '빛' },
    lineage_muster: { race: '술법', theme: '선봉', element: '바람' },
    alchemist_rite: { race: '술법', theme: '연금', element: '빛' },
    abyssal_whisper: { race: '술법', theme: '심연', element: '어둠' }
  };

  // effect 문자열은 수동 하드코딩하지 않고 DSL로 자동 생성
  const CARD_BLUEPRINTS = {
    vanguard: {
      name: '선봉대',
      type: 'monster',
      cost: 1,
      atk: 1,
      hp: 2,
      effects: [
        { timing: 'on_deploy', cost: { mana: 1 }, action: { kind: 'heal_self_unit', value: 1 } }
      ]
    },
    sharpshooter: {
      name: '정조준수',
      type: 'monster',
      cost: 2,
      atk: 2,
      hp: 2,
      effects: [
        { timing: 'on_deploy', cost: { mana: 1 }, action: { kind: 'search_to_hand', filter: { type: 'spell' }, count: 1, label: 'spell' } }
      ]
    },
    heavy_cavalry: { name: '중장기병', type: 'monster', cost: 3, atk: 2, hp: 4, effects: [] },
    guard_corps: { name: '방호대', type: 'monster', cost: 4, atk: 3, hp: 5, guard: true, effects: [] },
    war_engine: { name: '결전병기', type: 'monster', cost: 6, atk: 6, hp: 6, effects: [] },

    direct_hit: {
      name: '직격탄',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'push_stack', effectKey: 'direct_hit' } }
      ]
    },
    tactical_order: {
      name: '전술명령',
      type: 'spell',
      spellKind: 'normal',
      cost: 3,
      effects: [
        { timing: 'on_play', action: { kind: 'search_to_hand', filter: { type: 'spell' }, count: 1, label: 'spell' } }
      ]
    },
    overload: {
      name: '과충전',
      type: 'spell',
      spellKind: 'normal',
      cost: 0,
      effects: [
        { timing: 'on_play', action: { kind: 'gain_mana', value: 2 } }
      ]
    },
    defense_stance: {
      name: '방어태세',
      type: 'spell',
      spellKind: 'continuous',
      cost: 1,
      effects: [
        { timing: 'on_play', action: { kind: 'recruit_from_deck', count: 1 } }
      ]
    },
    battlefield_analysis: {
      name: '상황분석',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'search_to_hand', filter: { type: 'monster' }, count: 1, label: 'monster' } },
        { timing: 'on_play', action: { kind: 'recruit_from_deck', count: 1 } }
      ]
    }

    ,field_medic: {
      name: '의무병',
      type: 'monster',
      cost: 2,
      atk: 1,
      hp: 3,
      effects: [
        { timing: 'on_deploy', mode: 'optional', cost: { mana: 1 }, action: { kind: 'heal_unit', target: 'ally_front', value: 2 } }
      ]
    },
    interceptor: {
      name: '요격수',
      type: 'monster',
      cost: 3,
      atk: 3,
      hp: 2,
      effects: [
        { timing: 'on_deploy', action: { kind: 'damage_unit', target: 'enemy_front', value: 1 } }
      ]
    },
    vanguard_captain: {
      name: '선봉지휘관',
      type: 'monster',
      cost: 4,
      atk: 3,
      hp: 4,
      guard: true,
      effects: [
        { timing: 'on_deploy', action: { kind: 'search_to_hand', filter: { type: 'monster' }, count: 1, label: 'monster' } }
      ]
    },

    suppression_fire: {
      name: '제압사격',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'damage_unit', target: 'enemy_front', value: 2 } }
      ]
    },
    emergency_repair: {
      name: '응급수복',
      type: 'spell',
      spellKind: 'normal',
      cost: 1,
      effects: [
        { timing: 'on_play', action: { kind: 'heal_unit', target: 'ally_front', value: 2 } }
      ]
    },
    chain_burst: {
      name: '연쇄폭파',
      type: 'spell',
      spellKind: 'normal',
      cost: 3,
      effects: [
        { timing: 'on_play', action: { kind: 'push_stack', effectKey: 'chain_burst', stackAction: { kind: 'damage_agent', target: 'opponent', value: 3 } } }
      ]
    },
    reserve_call: {
      name: '예비소집',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'recruit_from_deck', count: 1 } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'search_to_hand', filter: { type: 'monster' }, count: 1, label: 'monster' } }
      ]
    },
    reinforced_blade: {
      name: '강화검',
      type: 'spell',
      spellKind: 'equip',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equip', target: 'ally_front', bonus: { atk: 2, hp: 0 } } }
      ]
    },
    guardian_plating: {
      name: '수호장갑',
      type: 'spell',
      spellKind: 'equip',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equip', target: 'ally_front', bonus: { atk: 0, hp: 2 } } }
      ]
    },
    lineage_muster: {
      name: '혈통소집',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { race: '인간족', min: 1 } }, action: { kind: 'search_to_hand', filter: { race: '인간족', type: 'monster' }, count: 1, label: 'race' } },
        { timing: 'on_play', condition: { actorBoardHas: { race: '인간족', min: 2 } }, action: { kind: 'recruit_from_deck', count: 1 } }
      ]
    },
    alchemist_rite: {
      name: '연금의식',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { theme: '연금', min: 1 } }, action: { kind: 'search_to_hand', filter: { theme: '연금' }, count: 1, label: 'theme' } },
        { timing: 'on_play', condition: { actorBoardHas: { theme: '연금', min: 2 } }, action: { kind: 'heal_unit', target: 'ally_front', value: 2 } }
      ]
    },
    abyssal_whisper: {
      name: '심연의속삭임',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 1 } }, action: { kind: 'damage_unit', target: 'enemy_front', value: 2 } },
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 2 } }, action: { kind: 'damage_agent', target: 'opponent', value: 1 } }
      ]
    },
    tactical_volley: {
      name: '전술일제사격',
      type: 'spell',
      spellKind: 'normal',
      cost: 4,
      effects: [
        { timing: 'on_play', action: { kind: 'damage_unit', target: 'enemy_front', value: 3 } },
        { timing: 'on_play', action: { kind: 'damage_agent', target: 'opponent', value: 1 } }
      ]
    }

  };

  const TEMPO_PATCH_OVERRIDES = {
    war_engine: { cost: 4, atk: 7, hp: 7 },
    direct_hit: {
      effects: [
        { timing: 'on_play', action: { kind: 'push_stack', effectKey: 'direct_hit', stackAction: { kind: 'damage_agent', target: 'opponent', value: 3 } } }
      ]
    }
  };

  function applyTempoPatch(blueprints) {
    const next = {};
    for (const [key, def] of Object.entries(blueprints || {})) {
      const card = { ...def };
      if (card.type === 'monster') {
        if (card.cost >= 3) card.cost = Math.max(1, card.cost - 1);
        if (card.cost <= 2) card.atk = Number(card.atk || 0) + 1;
      }
      if (card.type === 'spell') {
        card.cost = Math.max(0, Number(card.cost || 0) - 1);
      }
      const override = TEMPO_PATCH_OVERRIDES[key];
      if (override) Object.assign(card, JSON.parse(JSON.stringify(override)));
      next[key] = card;
    }
    return next;
  }

  function extractCardKey(input) {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (typeof input === 'object') return String(input.key || input.cardKey || '').trim();
    return String(input || '').trim();
  }

  function normalizeCardKey(key) {
    return extractCardKey(key);
  }

  function toUnitLabel(type) {
    if (type === 'spell') return '마법';
    if (type === 'monster') return '유닛';
    return '카드';
  }

  function timingIntro(def, eff) {
    const mana = Number(eff?.cost?.mana || 0);
    const paid = mana > 0 ? ` 마나 ${mana}을 내면` : '';
    const modeLabel = eff?.mode === 'optional' ? TERMS.optional : TERMS.forced;
    if (eff?.timing === 'on_deploy') return `${TERMS.deploy} 시${paid} (${modeLabel})`;
    if (eff?.timing === 'active') return `${TERMS.active} 시${paid} (${modeLabel})`;
    if (eff?.timing === 'on_play') return `${TERMS.active} 해결 시${paid} (${modeLabel})`;
    return `${modeLabel}${paid ? `,${paid.trim()}` : ''}`;
  }

  function conditionPhrase(condition = {}) {
    const board = condition?.actorBoardHas;
    if (board) {
      const chunks = [];
      if (board.race) chunks.push(board.race);
      if (board.theme) chunks.push(board.theme);
      if (board.element) chunks.push(board.element);
      const n = Number(board.min || 1);
      if (chunks.length) return `${chunks.join(' · ')} 유닛 ${n}기 이상일 때`;
    }
    return '';
  }

  function actionSentence(def, eff) {
    const action = eff?.action || {};
    const count = Math.max(1, Number(action.count || 1));
    const value = Number(action.value || 0);

    switch (action.kind) {
      case 'heal_self_unit':
        return `${TERMS.heal}: 체력 ${value || 1} 회복`;
      case 'search_to_hand': {
        const f = action?.filter || {};
        const chunks = [];
        if (f.race) chunks.push(`${f.race}`);
        if (f.theme) chunks.push(`${f.theme}`);
        if (f.element) chunks.push(`${f.element}`);
        if (f.type) chunks.push(`${toUnitLabel(f.type)}`);
        const label = chunks.length ? chunks.join(' · ') : '카드';
        return `${TERMS.search}: 덱에서 ${label} ${count}장을 찾아 손패에 넣고 덱을 섞어요`;
      }
      case 'recruit_from_deck':
        return `${TERMS.recruit}: 덱에서 유닛 ${count}장을 곧바로 ${TERMS.recruit}하고 덱을 섞어요`;
      case 'gain_mana':
        return `${TERMS.overcharge}: 즉시 마나 ${value || 0} 획득`;
      case 'push_stack': {
        const stackAction = action?.stackAction || STACK_EFFECT_DEFAULTS[action?.effectKey] || null;
        if (stackAction?.kind === 'damage_agent') {
          return `${TERMS.chain}: 스택 해결 시 상대 에이전트에게 ${Number(stackAction.value || 0)} 피해`;
        }
        return `${TERMS.chain}: 스택에 올린 뒤 해결`;
      }
      case 'damage_unit':
        return `${TERMS.pressure}: 대상 유닛에게 ${value || 0} 피해`;
      case 'heal_unit':
        return `${TERMS.targeting}/${TERMS.heal}: 아군 유닛 체력 ${value || 0} 회복`;
      case 'damage_agent':
        return `${TERMS.pressure}: 상대 에이전트에게 ${value || 0} 피해`;
      case 'attach_equip': {
        const atk = Number(action?.bonus?.atk || 0);
        const hp = Number(action?.bonus?.hp || 0);
        return `${TERMS.equip}: 아군 유닛에 ${TERMS.equip}해 공격 ${atk >= 0 ? '+' : ''}${atk}, 체력 ${hp >= 0 ? '+' : ''}${hp}`;
      }
      default:
        return '효과가 적용돼요';
    }
  }

  function buildCardEffect(key, def) {
    const effects = Array.isArray(def.effects) ? def.effects : [];

    if (def.type === 'monster') {
      const guardText = def.guard ? ` <${TERMS.guard}>.` : '';
      const head = `<${TERMS.deploy}: {${def.cost}}> ${def.atk}/${def.hp} ${def.name}.${guardText}`;
      if (!effects.length) return `${head} 기본 유닛이에요.`;
      const tails = effects.map((e) => `${timingIntro(def, e)} ${conditionPhrase(e?.condition)} ${actionSentence(def, e)}.`.replace(/\s+/g, ' ').trim());
      return `${head} ${tails.join(' ')}`.trim();
    }

    const spellHead = def.spellKind === 'continuous'
      ? `<${TERMS.continuous}: {${def.cost}}>`
      : (def.spellKind === 'equip'
        ? `<${TERMS.equip}: {${def.cost}}>`
        : `<${TERMS.active}: {${def.cost}}>`);
    if (!effects.length) return `${spellHead} 효과가 없어요.`;

    const sentences = effects.map((e) => `${conditionPhrase(e?.condition)} ${actionSentence(def, e)}.`.replace(/\s+/g, ' ').trim());
    return `${spellHead} ${sentences.join(' ')}`.trim();
  }

  const TEMPO_BLUEPRINTS = applyTempoPatch(CARD_BLUEPRINTS);

  const CARD_DEFS = Object.fromEntries(
    Object.entries(TEMPO_BLUEPRINTS).map(([k, v]) => {
      const effect = buildCardEffect(k, v);
      const baseMeta = META_DEFAULTS[v.type] || META_DEFAULTS.spell;
      const meta = { ...baseMeta, ...(CARD_META_OVERRIDES[k] || {}) };
      return [k, { ...v, ...meta, effect }];
    })
  );

  function getCardDef(key) {
    return CARD_DEFS[normalizeCardKey(key)] || null;
  }

  function getCardCost(key) {
    const def = getCardDef(key);
    return def ? Number(def.cost || 0) : 0;
  }

  function getCardType(key) {
    const def = getCardDef(key);
    return def?.type || 'spell';
  }

  function isNormalSpell(key) {
    return getCardDef(key)?.spellKind === 'normal';
  }

  function getStackDefaultAction(effectKey) {
    const base = STACK_EFFECT_DEFAULTS[String(effectKey || '').trim()];
    return base ? JSON.parse(JSON.stringify(base)) : null;
  }

  function buildKeywordCatalog() {
    const found = new Set();
    const bracket = /<([^>]+)>/g;

    for (const def of Object.values(CARD_DEFS)) {
      const text = String(def?.effect || '');
      let m;
      while ((m = bracket.exec(text)) !== null) {
        const raw = String(m[1] || '').trim();
        const token = raw.split(':')[0].split('/')[0].trim();
        if (token) found.add(token);
      }

      const effects = Array.isArray(def?.effects) ? def.effects : [];
      for (const e of effects) {
        const kind = e?.action?.kind;
        const kw = ACTION_KEYWORD[kind];
        if (kw) found.add(kw);
      }

      for (const t of Object.values(TERMS)) {
        if (text.includes(t)) found.add(t);
      }
    }

    return Array.from(found)
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map((name) => ({ name, description: KEYWORD_TEXT[name] || '카드 효과 텍스트 문맥에 따라 처리된다.' }));
  }

  return {
    TERMS,
    CARD_RACES,
    CARD_THEMES,
    CARD_ELEMENTS,
    CARD_DEFS,
    KEYWORD_TEXT,
    extractCardKey,
    normalizeCardKey,
    getCardDef,
    getCardCost,
    getCardType,
    isNormalSpell,
    getStackDefaultAction,
    buildKeywordCatalog,
    buildCardEffect
  };
});
