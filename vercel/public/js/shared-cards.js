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
    active: '사용',
    continuous: '지속',
    forced: '자동',
    optional: '선택',
    search: '탐색',
    recruit: '징집',
    heal: '치유',
    overcharge: '충전',
    chain: '연쇄',
    targeting: '지정',
    pressure: '피해',
    equip: '장착',
    guard: '수호',
    release: '희생',
    banish: '제외',
    selfDestruct: '자폭'
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
    [TERMS.chain]: '스택에 올린 뒤 스택 해결 시점에 해결된다.',
    [TERMS.targeting]: '아군/적군 유닛 중 대상을 정해 적용한다.',
    [TERMS.pressure]: '적 유닛이나 에이전트에게 직접 피해를 준다.',
    [TERMS.equip]: '아군 유닛에 부착되어 능력치를 강화한다.',
    [TERMS.guard]: '상대 필드에 수호 유닛이 있으면 본체 공격할 수 없다.',
    [TERMS.release]: '아군 유닛을 희생해 추가 효과의 코스트로 사용한다.',
    [TERMS.banish]: '대상 유닛을 무덤 대신 제외 영역으로 보낸다.',
    [TERMS.selfDestruct]: '자신 유닛을 즉시 파괴한다.'
  };

  const ACTION_KEYWORD = {
    heal_self: TERMS.heal,
    search_deck_to_hand: TERMS.search,
    deploy_from_deck: TERMS.recruit,
    gain_mana: TERMS.overcharge,
    enqueue_stack: TERMS.chain,
    deal_damage_to_unit: TERMS.pressure,
    heal_unit: TERMS.targeting,
    deal_damage_to_agent: TERMS.pressure,
    attach_equipment: TERMS.equip,
    self_destroy_unit: TERMS.selfDestruct,
    release_unit: TERMS.release,
    banish_unit: TERMS.banish,
    summon_gear5_route: TERMS.recruit,
    lock_attack_this_turn: TERMS.guard
  };

  const STACK_EFFECT_DEFAULTS = {
    abyss_direct_hit: { kind: 'deal_damage_to_agent', target: 'opponent', value: 3 }
  };

  const CARD_RACES = ['인간족', '기계족', '야수족', '정령족', '기사족', '술법'];
  const CARD_THEMES = ['균형', '기어', '알케미스타', '심연', '보급', '의식'];
  const CARD_ELEMENTS = ['불', '물', '바람', '땅', '빛', '어둠'];

  const META_DEFAULTS = {
    monster: { race: '인간족', theme: '균형', element: '빛' },
    spell: { race: '술법', theme: '균형', element: '빛' }
  };

  const CARD_META_OVERRIDES = {
    balance_observer: { race: '인간족', theme: '균형', element: '바람' },
    balance_guard_researcher: { race: '인간족', theme: '균형', element: '땅' },
    alchemista_tank_rabbit: { race: '기계족', theme: '알케미스타', element: '빛' },
    alchemista_rabbit_white: { race: '기계족', theme: '알케미스타', element: '빛' },
    alchemista_rabbit_black: { race: '기계족', theme: '알케미스타', element: '어둠' },
    alchemista_alice: { race: '인간족', theme: '알케미스타', element: '빛' },
    abyss_direct_hit: { race: '술법', theme: '심연', element: '불' },
    alchemista_workshop: { race: '술법', theme: '알케미스타', element: '빛' },
    alchemista_fixed_experiment: { race: '술법', theme: '알케미스타', element: '빛' },
    abyss_suppression_fire: { race: '술법', theme: '심연', element: '불' },
    alchemista_tuktak: { race: '술법', theme: '알케미스타', element: '빛' },
    abyss_chain_burst: { race: '술법', theme: '심연', element: '어둠' },
    balance_reserve_call: { race: '술법', theme: '균형', element: '바람' },
    abyss_tactical_volley: { race: '술법', theme: '심연', element: '불' },
    balance_reinforced_blade: { race: '술법', theme: '균형', element: '불' },
    balance_guardian_plating: { race: '술법', theme: '균형', element: '땅' },
    element_resonance: { race: '술법', theme: '균형', element: '빛' },
    alchemista_recovery_rite: { race: '술법', theme: '알케미스타', element: '빛' },
    alchemista_core_tuner: { race: '기계족', theme: '알케미스타', element: '빛' },
    alchemista_overlock_formula: { race: '술법', theme: '알케미스타', element: '어둠' },
    abyss_whisper: { race: '술법', theme: '심연', element: '어둠' },
    abyss_scout: { race: '야수족', theme: '심연', element: '어둠' },
    abyss_rift_stalker: { race: '야수족', theme: '심연', element: '바람' },
    abyss_dark_ritual_field: { race: '술법', theme: '심연', element: '어둠' },
    abyss_mark: { race: '술법', theme: '심연', element: '불' },
    abyss_doomsday_count: { race: '술법', theme: '심연', element: '빛' },
    supply_field_pack: { race: '술법', theme: '보급', element: '빛' },
    supply_mana_converter: { race: '술법', theme: '보급', element: '바람' },
    supply_recycle_protocol: { race: '술법', theme: '보급', element: '땅' },
    supply_quartermaster: { race: '인간족', theme: '보급', element: '땅' },
    supply_emergency_ration: { race: '술법', theme: '보급', element: '빛' },
    ritual_spark: { race: '술법', theme: '의식', element: '불' },
    ritual_echo_chant: { race: '술법', theme: '의식', element: '어둠' },
    ritual_null_seal: { race: '술법', theme: '의식', element: '어둠' },
    ritual_adept: { race: '정령족', theme: '의식', element: '어둠' },
    ritual_cataclysm_count: { race: '술법', theme: '의식', element: '빛' },
    gear_r_reverse: { race: '기계족', theme: '기어', element: '땅' },
    gear_1_clutch: { race: '기계족', theme: '기어', element: '땅' },
    gear_2_syncro: { race: '기계족', theme: '기어', element: '땅' },
    gear_3_downshift: { race: '기계족', theme: '기어', element: '땅' },
    gear_4_overdrive: { race: '기계족', theme: '기어', element: '땅' },
    gear_5_chronomesh: { race: '기계족', theme: '기어', element: '땅' },
    gear_6_antikythera_core: { race: '기계족', theme: '기어', element: '땅' },
    gear_guardian: { race: '기계족', theme: '기어', element: '땅' },
    gear_phase_signal: { race: '술법', theme: '기어', element: '땅' },
    gear_train_assembly: { race: '술법', theme: '기어', element: '땅' }
  };

  // effect 문자열은 수동 하드코딩하지 않고 DSL로 자동 생성
  const CARD_BLUEPRINTS = {
    balance_observer: {
      name: '정조준수',
      type: 'monster',
      cost: 2,
      atk: 2,
      hp: 2,
      effects: [
        { timing: 'on_deploy', cost: { mana: 1 }, action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'spell' }, count: 1, label: 'theme' } }
      ]
    },
    balance_guard_researcher: { name: '방호대', type: 'monster', cost: 4, atk: 3, hp: 5, guard: true, effects: [] },
    alchemista_tank_rabbit: { name: '알케미스타 기간탱크 래빗', type: 'monster', cost: 6, atk: 6, hp: 6, effects: [ { timing: 'on_deploy', mode: 'optional', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 2 } }, { timing: 'on_deploy', mode: 'optional', action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 2 } } ] },

    abyss_direct_hit: {
      name: '직격탄',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'enqueue_stack', effectKey: 'abyss_direct_hit' } }
      ]
    },
    alchemista_workshop: {
      name: '알케미스타 공방',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', mode: 'optional', cost: { mana: 3 }, condition: { actorBoardHas: { theme: '알케미스타', min: 1 } }, action: { kind: 'search_deck_to_hand', filter: { race: '기계족', type: 'monster' }, count: 2, label: 'race' } }
      ]
    },
    alchemista_fixed_experiment: {
      name: '알케미스타 고정 실험',
      type: 'spell',
      spellKind: 'equip',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 1, hp: 1 } } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 2 }, action: { kind: 'heal_unit', target: 'ally_front', value: 2 } }
      ]
    }

    ,alchemista_rabbit_white: {
      name: '알케미스타 래빗 화이트',
      type: 'monster',
      cost: 2,
      atk: 2,
      hp: 3,
      effects: [
        { timing: 'on_deploy', mode: 'optional', cost: { mana: 1 }, action: { kind: 'heal_unit', target: 'ally_front', value: 2 } },
        { timing: 'on_deploy', mode: 'optional', action: { kind: 'search_deck_to_hand', filter: { race: '기계족', type: 'monster' }, count: 1, label: 'race' } }
      ]
    },
    alchemista_rabbit_black: {
      name: '알케미스타 래빗 블랙',
      type: 'monster',
      cost: 4,
      atk: 3,
      hp: 2,
      effects: [
        { timing: 'on_deploy', mode: 'optional', cost: { mana: 5 }, action: { kind: 'search_deck_to_hand', filter: { theme: '알케미스타', type: 'monster' }, count: 1, label: 'theme' } }
      ]
    },
    alchemista_alice: {
      name: '알케미스타 앨리스',
      type: 'monster',
      cost: 4,
      atk: 4,
      hp: 3,
      effects: [
        { timing: 'on_deploy', mode: 'optional', condition: { actorBoardHas: { theme: '알케미스타', min: 2 } }, action: { kind: 'deploy_from_deck', filter: { theme: '알케미스타', type: 'monster' }, count: 1 } },
        { timing: 'on_deploy', mode: 'optional', action: { kind: 'search_deck_to_hand', filter: { theme: '알케미스타', type: 'spell' }, count: 1, label: 'theme' } }
      ]
    },

    abyss_suppression_fire: {
      name: '제압사격',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 2 } }
      ]
    },
    alchemista_tuktak: {
      name: '알케미스타 뚝딱뚝딱!',
      type: 'spell',
      spellKind: 'equip',
      cost: 3,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 2, hp: 0 } } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 3 }, action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: -1, hp: 3 } } }
      ]
    },
    abyss_chain_burst: {
      name: '연쇄폭파',
      type: 'spell',
      spellKind: 'normal',
      cost: 3,
      effects: [
        { timing: 'on_play', action: { kind: 'enqueue_stack', effectKey: 'abyss_chain_burst', stackAction: { kind: 'deal_damage_to_agent', target: 'opponent', value: 3 } } }
      ]
    },
    balance_reserve_call: {
      name: '예비소집',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'deploy_from_deck', filter: { theme: '균형', type: 'monster' }, count: 1 } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'monster' }, count: 1, label: 'theme' } }
      ]
    },
    balance_reinforced_blade: {
      name: '강화검',
      type: 'spell',
      spellKind: 'equip',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 2, hp: 0 } } }
      ]
    },
    balance_guardian_plating: {
      name: '수호장갑',
      type: 'spell',
      spellKind: 'equip',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 0, hp: 2 } } }
      ]
    },
    alchemista_recovery_rite: {
      name: '알케미스타 복원술',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { theme: '알케미스타', min: 1 } }, action: { kind: 'search_deck_to_hand', filter: { theme: '알케미스타', type: 'spell' }, count: 1, label: 'theme' } },
        { timing: 'on_play', condition: { actorBoardHas: { theme: '알케미스타', min: 2 } }, action: { kind: 'heal_unit', target: 'ally_front', value: 2 } }
      ]
    },
    alchemista_core_tuner: {
      name: '알케미스타 코어 튜너',
      type: 'monster',
      cost: 3,
      atk: 2,
      hp: 3,
      effects: [
        { timing: 'on_deploy', mode: 'optional', action: { kind: 'search_deck_to_hand', filter: { theme: '알케미스타', type: 'spell' }, count: 1, label: 'theme' } },
        { timing: 'on_deploy', mode: 'optional', condition: { actorBoardHas: { theme: '알케미스타', min: 2 } }, action: { kind: 'heal_unit', target: 'ally_front', value: 1 } }
      ]
    },
    alchemista_overlock_formula: {
      name: '알케미스타 오버록 공식',
      type: 'spell',
      spellKind: 'equip',
      cost: 3,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 1, hp: 1 } } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'search_deck_to_hand', filter: { theme: '알케미스타', type: 'monster' }, count: 1, label: 'theme' } }
      ]
    },
    abyss_whisper: {
      name: '심연의 속삭임',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 1 } }, action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 2 } },
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 2 } }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    abyss_tactical_volley: {
      name: '전술 일제사격',
      type: 'spell',
      spellKind: 'normal',
      cost: 4,
      effects: [
        { timing: 'on_play', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 3 } },
        { timing: 'on_play', action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    abyss_scout: {
      name: '심연 척후병',
      type: 'monster',
      cost: 2,
      atk: 2,
      hp: 2,
      effects: [
        { timing: 'on_deploy', mode: 'optional', condition: { actorBoardHas: { theme: '심연', min: 1 } }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    abyss_rift_stalker: {
      name: '균열 잠복자',
      type: 'monster',
      cost: 3,
      atk: 3,
      hp: 2,
      effects: [
        { timing: 'on_deploy', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 1 } },
        { timing: 'on_deploy', mode: 'optional', cost: { mana: 1 }, action: { kind: 'enqueue_stack', effectKey: 'abyss_direct_hit', stackAction: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } } }
      ]
    },
    abyss_dark_ritual_field: {
      name: '암흑 예식',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 1 } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    abyss_mark: {
      name: '심연 표식',
      type: 'spell',
      spellKind: 'equip',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 1, hp: 1 } } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    abyss_doomsday_count: {
      name: '종말 카운트',
      type: 'spell',
      spellKind: 'normal',
      cost: 3,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 2 } }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 3 } },
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 1 } }, action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 2 } }
      ]
    },

    supply_field_pack: {
      name: '현장 보급팩',
      type: 'spell',
      spellKind: 'normal',
      cost: 1,
      effects: [
        { timing: 'on_play', action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'spell' }, count: 1, label: 'theme' } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'monster' }, count: 1, label: 'theme' } }
      ]
    },
    supply_mana_converter: {
      name: '마나 변환기',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'gain_mana', value: 1 } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'heal_unit', target: 'ally_front', value: 1 } }
      ]
    },
    supply_recycle_protocol: {
      name: '재순환 프로토콜',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'spell' }, count: 1, label: 'theme' } }
      ]
    },
    supply_quartermaster: {
      name: '보급관',
      type: 'monster',
      cost: 2,
      atk: 2,
      hp: 3,
      effects: [
        { timing: 'on_deploy', action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'spell' }, count: 1, label: 'theme' } },
        { timing: 'on_deploy', mode: 'optional', cost: { mana: 1 }, action: { kind: 'heal_unit', target: 'ally_front', value: 1 } }
      ]
    },
    supply_emergency_ration: {
      name: '비상 식량',
      type: 'spell',
      spellKind: 'equip',
      cost: 1,
      effects: [
        { timing: 'on_play', action: { kind: 'attach_equipment', target: 'ally_front', bonus: { atk: 0, hp: 2 } } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'spell' }, count: 1, label: 'theme' } }
      ]
    },

    ritual_spark: {
      name: '의식 불꽃',
      type: 'spell',
      spellKind: 'normal',
      cost: 1,
      effects: [
        { timing: 'on_play', action: { kind: 'enqueue_stack', effectKey: 'ritual_spark', stackAction: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } } }
      ]
    },
    ritual_echo_chant: {
      name: '메아리 영창',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'enqueue_stack', effectKey: 'ritual_echo_chant', stackAction: { kind: 'deal_damage_to_agent', target: 'opponent', value: 2 } } },
        { timing: 'on_play', mode: 'optional', condition: { actorBoardHas: { theme: '심연', min: 1 } }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    ritual_null_seal: {
      name: '공허 봉인',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 1 } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 1 }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } }
      ]
    },
    ritual_adept: {
      name: '의식 집행자',
      type: 'monster',
      cost: 3,
      atk: 3,
      hp: 2,
      effects: [
        { timing: 'on_deploy', action: { kind: 'enqueue_stack', effectKey: 'ritual_adept', stackAction: { kind: 'deal_damage_to_agent', target: 'opponent', value: 1 } } },
        { timing: 'on_deploy', mode: 'optional', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 1 } }
      ]
    },
    ritual_cataclysm_count: {
      name: '파국 카운트',
      type: 'spell',
      spellKind: 'normal',
      cost: 3,
      effects: [
        { timing: 'on_play', condition: { actorBoardHas: { theme: '심연', min: 2 } }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 3 } },
        { timing: 'on_play', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 2 } }
      ]
    },

    gear_r_reverse: {
      name: '기어 R-리버스',
      type: 'monster',
      cost: 2,
      atk: 1,
      hp: 3,
      effects: [
        { timing: 'on_deploy', mode: 'optional', action: { kind: 'search_deck_to_hand', filter: { theme: '기어', type: 'monster' }, count: 1, label: 'theme' } }
      ]
    },
    gear_1_clutch: {
      name: '기어 1-클러치',
      type: 'monster',
      cost: 1,
      atk: 1,
      hp: 1,
      effects: [
        { timing: 'active', mode: 'optional', action: { kind: 'self_destroy_unit', target: 'self_unit' } },
        { timing: 'active', mode: 'optional', condition: { actorBoardHas: { theme: '기어', min: 1 } }, action: { kind: 'search_deck_to_hand', filter: { key: 'gear_2_syncro' }, count: 1, label: 'card' } }
      ]
    },
    gear_2_syncro: {
      name: '기어 2-싱크로',
      type: 'monster',
      cost: 1,
      atk: 2,
      hp: 1,
      effects: [
        { timing: 'active', mode: 'optional', action: { kind: 'release_unit', target: 'ally_front' } },
        { timing: 'active', mode: 'optional', condition: { actorBoardHas: { theme: '기어', min: 1 } }, action: { kind: 'deploy_from_deck', filter: { key: 'gear_3_downshift' }, count: 1 } }
      ]
    },
    gear_3_downshift: {
      name: '기어 3-다운시프트',
      type: 'monster',
      cost: 2,
      atk: 2,
      hp: 2,
      effects: [
        { timing: 'on_deploy', action: { kind: 'deal_damage_to_unit', target: 'enemy_front', value: 1 } },
        { timing: 'active', mode: 'optional', action: { kind: 'banish_unit', target: 'enemy_front' } }
      ]
    },
    gear_4_overdrive: {
      name: '기어 4-오버드라이브',
      type: 'monster',
      cost: 4,
      atk: 3,
      hp: 3,
      effects: [
        { timing: 'on_deploy', mode: 'optional', condition: { actorBoardHas: { theme: '기어', min: 1 } }, action: { kind: 'deploy_from_deck', filter: { theme: '기어', type: 'monster' }, count: 1 } }
      ]
    },
    gear_5_chronomesh: {
      name: '기어 5-크로노메시',
      type: 'monster',
      cost: 4,
      atk: 4,
      hp: 4,
      guard: true,
      effects: [
        { timing: 'on_deploy', mode: 'optional', action: { kind: 'search_deck_to_hand', filter: { key: 'gear_guardian' }, count: 1, label: 'card' } }
      ]
    },
    gear_6_antikythera_core: {
      name: '기어 6-안티키테라 코어',
      type: 'monster',
      cost: 5,
      atk: 6,
      hp: 6,
      cannotAttackOnSummonTurn: true,
      effects: [
        { timing: 'on_deploy', mode: 'optional', condition: { actorBoardHas: { key: 'gear_guardian', min: 1 } }, action: { kind: 'deal_damage_to_agent', target: 'opponent', value: 2 } }
      ]
    },
    gear_guardian: {
      name: '기어 가디언',
      type: 'monster',
      cost: 4,
      atk: 0,
      hp: 8,
      guard: true,
      effects: [
        { timing: 'on_deploy', action: { kind: 'lock_attack_this_turn' } }
      ]
    },
    gear_phase_signal: {
      name: '기어 페이즈 시그널',
      type: 'spell',
      spellKind: 'normal',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'search_deck_to_hand', filter: { theme: '기어', type: 'monster' }, count: 1, label: 'theme' } }
      ]
    },
    gear_train_assembly: {
      name: '기어 트레인 어셈블리',
      type: 'spell',
      spellKind: 'continuous',
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'deploy_from_deck', filter: { theme: '기어', type: 'monster' }, count: 1 } },
        { timing: 'on_play', mode: 'optional', condition: { actorBoardHas: { key: 'gear_guardian', min: 1 } }, action: { kind: 'summon_gear5_route', key: 'gear_6_antikythera_core' } }
      ]
    }

  };

  const TEMPO_PATCH_OVERRIDES = {
    alchemista_tank_rabbit: { cost: 5, atk: 6, hp: 6 },
    abyss_direct_hit: {
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'enqueue_stack', effectKey: 'abyss_direct_hit', stackAction: { kind: 'deal_damage_to_agent', target: 'opponent', value: 3 } } }
      ]
    },
    abyss_chain_burst: { cost: 3 },
    abyss_doomsday_count: { cost: 3 },
    abyss_dark_ritual_field: { cost: 2 },
    abyss_mark: { cost: 2 },
    abyss_rift_stalker: { cost: 3, atk: 3, hp: 2 },

    balance_observer: { cost: 2, atk: 2, hp: 2 },
    balance_guard_researcher: { cost: 4, atk: 3, hp: 5 },
    balance_reserve_call: {
      cost: 2,
      effects: [
        { timing: 'on_play', action: { kind: 'search_deck_to_hand', filter: { theme: '균형', type: 'monster' }, count: 1, label: 'theme' } },
        { timing: 'on_play', mode: 'optional', cost: { mana: 2 }, action: { kind: 'deploy_from_deck', filter: { theme: '균형', type: 'monster' }, count: 1 } }
      ]
    },
    balance_reinforced_blade: { cost: 2 },
    balance_guardian_plating: { cost: 2 },
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

  const LEGACY_KEY_ALIASES = {
    gear_recycler: 'gear_r_reverse',
    gear_seed: 'gear_1_clutch',
    gear_link: 'gear_2_syncro',
    gear_breaker: 'gear_3_downshift',
    gear_forge: 'gear_4_overdrive',
    gear_frame: 'gear_5_chronomesh',
    gear_overcore: 'gear_6_antikythera_core',
    gear_bulk_guardian: 'gear_guardian',
    gear_signal: 'gear_phase_signal',
    gear_assembly: 'gear_train_assembly'
  };

  function normalizeCardKey(key) {
    const raw = extractCardKey(key);
    if (!raw) return '';
    return LEGACY_KEY_ALIASES[raw] || raw;
  }

  function toUnitLabel(type) {
    if (type === 'spell') return '마법';
    if (type === 'monster') return '유닛';
    return '카드';
  }

  function cardDisplayNameByKey(key) {
    const norm = normalizeCardKey(key);
    if (!norm) return '카드';
    return CARD_BLUEPRINTS[norm]?.name || norm;
  }

  function timingIntro(def, eff) {
    const mana = Number(eff?.cost?.mana || 0);
    const modeLabel = eff?.mode === 'optional' ? TERMS.optional : TERMS.forced;
    const mode = mana > 0 ? `${modeLabel}·마나 ${mana}` : modeLabel;
    if (eff?.timing === 'on_deploy') return `${TERMS.deploy} 시 <${mode}>`;
    if (eff?.timing === 'active') return `${TERMS.active} 시 <${mode}>`;
    if (eff?.timing === 'on_play') return `${TERMS.active} 해결 시 <${mode}>`;
    return `<${mode}>`;
  }

  function conditionPhrase(condition = {}) {
    const board = condition?.actorBoardHas;
    if (board) {
      const chunks = [];
      if (board.key) chunks.push(`"${cardDisplayNameByKey(board.key)}"`);
      if (board.race) chunks.push(board.race);
      if (board.theme) chunks.push(board.theme);
      if (board.element) chunks.push(board.element);
      const n = Number(board.min || 1);
      if (chunks.length) return `${chunks.join('·')} ${n}+일 때`;
    }
    return '';
  }

  function actionSentence(def, eff) {
    const action = eff?.action || {};
    const count = Math.max(1, Number(action.count || 1));
    const value = Number(action.value || 0);

    switch (action.kind) {
      case 'heal_self':
        return `${TERMS.heal}: 체력+${value || 1}`;
      case 'search_deck_to_hand': {
        const f = action?.filter || {};
        const chunks = [];
        if (f.key) chunks.push(`"${cardDisplayNameByKey(f.key)}"`);
        if (f.race) chunks.push(`${f.race}`);
        if (f.theme) chunks.push(`${f.theme}`);
        if (f.element) chunks.push(`${f.element}`);
        if (f.type) chunks.push(`${toUnitLabel(f.type)}`);
        const label = chunks.length ? chunks.join(' · ') : '카드';
        return `${TERMS.search}: ${label} ${count}장 탐색`;
      }
      case 'deploy_from_deck': {
        const f = action?.filter || {};
        const target = f.key ? `"${cardDisplayNameByKey(f.key)}" ` : '';
        return `${TERMS.recruit}: ${target}유닛 ${count}장 즉시 전개`;
      }
      case 'gain_mana':
        return `${TERMS.overcharge}: 마나+${value || 0}`;
      case 'enqueue_stack': {
        const stackAction = action?.stackAction || STACK_EFFECT_DEFAULTS[action?.effectKey] || null;
        if (stackAction?.kind === 'deal_damage_to_agent') {
          return `${TERMS.chain}: 피해 ${Number(stackAction.value || 0)}(상대 본체)`;
        }
        return `${TERMS.chain}: 스택에 올려 해결`;
      }
      case 'deal_damage_to_unit':
        return `${TERMS.pressure}: 피해 ${value || 0}(대상 유닛)`;
      case 'heal_unit':
        return `${TERMS.heal}: 체력+${value || 0}(아군 1기)`;
      case 'deal_damage_to_agent':
        return `${TERMS.pressure}: 피해 ${value || 0}(상대 본체)`;
      case 'self_destroy_unit':
        return `${TERMS.selfDestruct}: 아군 1기 파괴`;
      case 'release_unit':
        return `${TERMS.release}: 아군 1기 ${TERMS.release}`;
      case 'banish_unit':
        return `${TERMS.banish}: 대상 유닛 제외`;
      case 'summon_gear5_route': {
        const targetKey = normalizeCardKey(action?.key || '');
        const targetName = CARD_BLUEPRINTS[targetKey]?.name || targetKey || '대상 유닛';
        const requiredKey = normalizeCardKey(eff?.condition?.actorBoardHas?.key || '');
        const requiredName = requiredKey ? cardDisplayNameByKey(requiredKey) : null;
        const reqText = requiredName ? `"${requiredName}" 있으면 ` : '';
        return `${TERMS.recruit}: ${reqText}"${targetName}" 특수 전개`;
      }
      case 'lock_attack_this_turn':
        return `해당 턴에는 공격할 수 없다`;
      case 'attach_equipment': {
        const atk = Number(action?.bonus?.atk || 0);
        const hp = Number(action?.bonus?.hp || 0);
        const isOptional = (eff?.mode || 'forced') === 'optional';
        const mana = Number(eff?.cost?.mana || 0);
        const prefix = isOptional
          ? `${TERMS.equip} 추가`
          : `${TERMS.equip}`;
        return `${prefix}: ${atk >= 0 ? '+' : ''}${atk}/${hp >= 0 ? '+' : ''}${hp}(아군 1기)`;
      }
      default:
        return '효과 적용';
    }
  }

  function buildCardEffect(key, def) {
    const effects = Array.isArray(def.effects) ? def.effects : [];

    if (def.type === 'monster') {
      const guardText = def.guard ? ` <${TERMS.guard}>.` : '';
      const head = `<${TERMS.deploy}: {${def.cost}}> ${def.atk}/${def.hp}.${guardText}`;
      if (!effects.length) return `${head} 기본 유닛이다.`;
      const tails = effects.map((e) => `${timingIntro(def, e)} ${conditionPhrase(e?.condition)} ${actionSentence(def, e)}.`.replace(/\s+/g, ' ').trim());
      return `${head} ${tails.join(' ')}`.trim();
    }

    const spellHead = def.spellKind === 'continuous'
      ? `<${TERMS.continuous}: {${def.cost}}>`
      : (def.spellKind === 'equip'
        ? `<${TERMS.equip}: {${def.cost}}>`
        : `<${TERMS.active}: {${def.cost}}>`);
    if (!effects.length) return `${spellHead} 효과 없음.`;

    const sentences = effects.map((e) => `${timingIntro(def, e)} ${conditionPhrase(e?.condition)} ${actionSentence(def, e)}.`.replace(/\s+/g, ' ').trim());
    return `${spellHead} ${sentences.join(' ')}`.trim();
  }

  const TEMPO_BLUEPRINTS = applyTempoPatch(CARD_BLUEPRINTS);

  const CARD_DEFS = (() => {
    const out = {};
    for (const [cardKey, v] of Object.entries(TEMPO_BLUEPRINTS)) {
      const effect = buildCardEffect(cardKey, v);
      const baseMeta = META_DEFAULTS[v.type] || META_DEFAULTS.spell;
      const meta = { ...baseMeta, ...(CARD_META_OVERRIDES[cardKey] || {}) };
      const def = { ...v, ...meta, key: cardKey, effect };
      out[cardKey] = def;
    }
    return out;
  })();

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
