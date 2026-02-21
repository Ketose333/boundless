const sharedCards = require('../public/js/shared-cards.js');
const { CARD_DEFS, extractCardKey, normalizeCardKey, getCardDef, getCardCost, getCardType, isNormalSpell, getStackDefaultAction } = sharedCards;
const { RULES_CONST } = require('./rules-const');

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mkDeck() {
  const pool = Object.keys(CARD_DEFS);
  const deck = pool.flatMap((k) => Array(3).fill(k));
  return shuffleDeck(deck);
}

function drawOne(state, agentId) {
  const a = state.agents[agentId];
  const top = a.deck.shift();
  if (!top) {
    state.winnerId = Object.keys(state.agents).find((id) => id !== agentId) || null;
    state.log.push(`${agentId} deck out`);
    return;
  }
  a.hand.push(top);
}

function canUseEffectThisTurn(state, agentId, usageKey) {
  if (!usageKey) return true;
  const usedTurn = state.effectUsage?.[agentId]?.[usageKey];
  return usedTurn !== state.turn;
}

function markEffectUsed(state, agentId, usageKey) {
  if (!usageKey) return;
  state.effectUsage = state.effectUsage || {};
  state.effectUsage[agentId] = state.effectUsage[agentId] || {};
  state.effectUsage[agentId][usageKey] = state.turn;
}

function spellSlotKey(slot) {
  return normalizeCardKey(extractCardKey(slot));
}

function cardLabel(key) {
  const k = normalizeCardKey(extractCardKey(key));
  const def = getCardDef(k);
  return def?.name || k;
}

function searchOneToHand(state, agentId, predicate, label = 'card') {
  const a = state.agents[agentId];
  if (!a?.deck?.length) {
    state.log.push(`${agentId} search failed (deck empty)`);
    return false;
  }
  const idx = a.deck.findIndex((k) => predicate(k));
  if (idx < 0) {
    state.log.push(`${agentId} search failed (no ${label})`);
    return false;
  }
  const [picked] = a.deck.splice(idx, 1);
  if (!picked) return false;
  a.hand.push(picked);
  a.deck = shuffleDeck(a.deck);
  state.log.push(`${agentId} searched ${cardLabel(picked)} to hand`);
  return true;
}

function recruitOneFromDeck(state, agentId) {
  const a = state.agents[agentId];
  const z = a.monsterZone.findIndex((x) => x === null);
  if (z < 0) {
    state.log.push(`${agentId} recruit failed (monster zone full)`);
    return false;
  }
  const idx = a.deck.findIndex((k) => getCardType(k) === 'monster');
  if (idx < 0) {
    state.log.push(`${agentId} recruit failed (no monster in deck)`);
    return false;
  }
  const [key] = a.deck.splice(idx, 1);
  const def = getCardDef(key) || {};
  const atk = Number(def.atk || 1);
  const hp = Number(def.hp || 1);
  const unitId = `${key}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  state.units[unitId] = { id: unitId, key, name: key, cost: getCardCost(key), atk, hp, maxHp: hp, ownerId: agentId, exhausted: true };
  a.monsterZone[z] = unitId;
  a.deck = shuffleDeck(a.deck);
  state.log.push(`${agentId} recruited ${cardLabel(key)}`);
  return true;
}

function tryPayCost(state, agentId, cost = {}) {
  const mana = Number(cost?.mana || 0);
  if (mana <= 0) return true;
  const a = state.agents[agentId];
  if (a.mana < mana) {
    state.log.push(`${agentId} effect skipped (not enough mana)`);
    return false;
  }
  a.mana -= mana;
  return true;
}

function matchesCardFilter(cardKey, filter = {}) {
  const k = normalizeCardKey(extractCardKey(cardKey));
  const def = getCardDef(k) || {};
  if (filter.type && getCardType(k) !== filter.type) return false;
  if (filter.race && def.race !== filter.race) return false;
  if (filter.theme && def.theme !== filter.theme) return false;
  if (filter.element && def.element !== filter.element) return false;
  return true;
}

function isConditionMet(state, actorId, condition = {}, context = {}) {
  if (!condition || typeof condition !== 'object' || !Object.keys(condition).length) return true;

  const board = condition.actorBoardHas;
  if (board) {
    const min = Number(board.min || 1);
    const zone = state.agents[actorId]?.monsterZone || [];
    const count = zone
      .map((uid) => uid && state.units[uid])
      .filter(Boolean)
      .filter((u) => matchesCardFilter(u.key, board))
      .length;
    if (count < min) return false;
  }

  const targetIs = condition.targetUnitIs;
  if (targetIs) {
    const unitId = context?.targetUnitId || context?.unitId;
    if (!unitId || !state.units[unitId]) return false;
    if (!matchesCardFilter(state.units[unitId].key, targetIs)) return false;
  }

  if (condition.actorManaAtLeast != null) {
    if ((state.agents[actorId]?.mana || 0) < Number(condition.actorManaAtLeast)) return false;
  }

  return true;
}

function resolveUnitTarget(state, actorId, action = {}, context = {}) {
  const oppId = Object.keys(state.agents).find((id) => id !== actorId);
  const explicit = action.targetUnitId || context.targetUnitId;
  if (explicit && state.units[explicit]) return explicit;

  if (action.target === 'self_unit' && context.unitId && state.units[context.unitId]) return context.unitId;

  if (action.target === 'ally_front') {
    const zone = state.agents[actorId]?.monsterZone || [];
    const uid = zone.find((id) => id && state.units[id]);
    if (uid) return uid;
  }

  if (action.target === 'enemy_front') {
    const zone = state.agents[oppId]?.monsterZone || [];
    const uid = zone.find((id) => id && state.units[id]);
    if (uid) return uid;
  }

  return null;
}

function runEffectAction(state, actorId, cardKey, action, context = {}) {
  if (!action || !action.kind) return;
  const actor = state.agents[actorId];
  const oppId = Object.keys(state.agents).find((id) => id !== actorId);

  switch (action.kind) {
    case 'heal_self_unit':
    case 'heal_unit': {
      const unitId = action.kind === 'heal_self_unit'
        ? context?.unitId
        : resolveUnitTarget(state, actorId, action, context);
      if (!unitId || !state.units[unitId]) return;
      const v = Number(action.value || 0);
      if (v <= 0) return;
      state.units[unitId].hp = Math.min(state.units[unitId].maxHp, state.units[unitId].hp + v);
      state.log.push(`${actorId} healed ${cardLabel(cardKey)} by ${v}`);
      return;
    }
    case 'search_to_hand': {
      const wanted = action?.filter?.type;
      const label = action?.label || wanted || 'card';
      const count = Math.max(1, Number(action.count || 1));
      for (let i = 0; i < count; i++) {
        const ok = searchOneToHand(state, actorId, (k) => matchesCardFilter(k, action?.filter || {}), label);
        if (!ok) break;
      }
      return;
    }
    case 'recruit_from_deck': {
      const count = Math.max(1, Number(action.count || 1));
      for (let i = 0; i < count; i++) {
        const ok = recruitOneFromDeck(state, actorId);
        if (!ok) break;
      }
      return;
    }
    case 'gain_mana': {
      const v = Number(action.value || 0);
      if (v <= 0) return;
      actor.mana += v;
      state.log.push(`${actorId} gained temporary mana +${v}`);
      return;
    }
    case 'push_stack': {
      const effectKey = action.effectKey || 'unknown';
      const stackAction = action.stackAction || getStackDefaultAction(effectKey);
      if (!stackAction) {
        state.log.push(`${actorId} effect skipped (stack action missing: ${effectKey})`);
        return;
      }
      state.stack.push({ id: `stk_${Date.now()}`, actorId, sourceCardKey: cardKey, effectKey, payload: { action: stackAction } });
      return;
    }
    case 'damage_agent': {
      const target = (action.target === 'self' || action.target === 'self_agent') ? actorId : oppId;
      const v = Number(action.value || 0);
      if (!target || v <= 0) return;
      state.agents[target].hp -= v;
      if (state.agents[target].hp <= 0) state.winnerId = actorId;
      state.log.push(`${actorId} dealt ${v} damage to ${target}`);
      return;
    }
    case 'damage_unit': {
      const unitId = resolveUnitTarget(state, actorId, action, context);
      const v = Number(action.value || 0);
      if (!unitId || !state.units[unitId] || v <= 0) return;
      const owner = state.units[unitId].ownerId;
      state.units[unitId].hp -= v;
      state.log.push(`${actorId} dealt ${v} damage to ${cardLabel(state.units[unitId].key)}`);
      if (state.units[unitId].hp <= 0) {
        const z = state.agents[owner].monsterZone.findIndex((id) => id === unitId);
        if (z >= 0) state.agents[owner].monsterZone[z] = null;
        state.agents[owner].graveyard.push(normalizeCardKey(state.units[unitId].key));
        delete state.units[unitId];
      }
      return;
    }
    case 'attach_equip': {
      const unitId = resolveUnitTarget(state, actorId, action, context);
      if (!unitId || !state.units[unitId]) {
        state.log.push(`${actorId} equip failed (no target unit)`);
        return;
      }
      const zoneIndex = Number(context?.spellZoneIndex);
      const a = state.agents[actorId];
      const key = normalizeCardKey(cardKey);
      const atk = Number(action?.bonus?.atk || 0);
      const hp = Number(action?.bonus?.hp || 0);
      state.units[unitId].atk += atk;
      state.units[unitId].hp += hp;
      state.units[unitId].maxHp += hp;
      if (Number.isInteger(zoneIndex) && zoneIndex >= 0 && zoneIndex < a.spellZone.length) {
        a.spellZone[zoneIndex] = { key, attachedUnitId: unitId, bonus: { atk, hp } };
      }
      state.log.push(`${actorId} equipped ${cardLabel(key)} to ${cardLabel(state.units[unitId].key)}`);
      return;
    }
    default:
      state.log.push(`${actorId} effect skipped (unsupported: ${action.kind})`);
  }
}

function runCardEffects(state, actorId, cardKey, timing, context = {}) {
  const def = getCardDef(cardKey) || {};
  const effects = Array.isArray(def.effects) ? def.effects : [];
  if (!effects.length) return;

  const usageKey = context?.effectUsageKey || null;
  if (!canUseEffectThisTurn(state, actorId, usageKey)) return;

  const targets = effects.filter((e) => e && e.timing === timing);
  if (!targets.length) return;

  const selected = Array.isArray(context?.selectedEffectIndexes) ? context.selectedEffectIndexes : null;
  for (let i = 0; i < targets.length; i++) {
    const e = targets[i];
    const mode = e?.mode || 'forced';
    if (mode === 'optional') {
      if (!selected || !selected.includes(i)) continue;
    }
    if (!isConditionMet(state, actorId, e.condition || {}, context)) continue;
    if (!tryPayCost(state, actorId, e.cost || {})) continue;
    runEffectAction(state, actorId, cardKey, e.action || {}, context);
  }

  markEffectUsed(state, actorId, usageKey);
}


function hasGuardOnBoard(state, agentId) {
  const zone = state.agents?.[agentId]?.monsterZone || [];
  return zone.some((uid) => {
    const u = uid && state.units?.[uid];
    if (!u) return false;
    const def = getCardDef(u.key) || {};
    return !!def.guard;
  });
}

function cleanupOrphanEquips(state) {
  for (const agentId of Object.keys(state.agents || {})) {
    const a = state.agents[agentId];
    for (let i = 0; i < (a.spellZone || []).length; i++) {
      const slot = a.spellZone[i];
      if (!slot || typeof slot !== 'object') continue;
      const key = spellSlotKey(slot);
      if (!key) continue;
      if (slot.attachedUnitId && !state.units[slot.attachedUnitId]) {
        a.graveyard.push(key);
        a.spellZone[i] = null;
        state.log.push(`${agentId} equip ${cardLabel(key)} sent to graveyard`);
      }
    }
  }
}

function initGame(roomId, a1, a2, decksByAgent = {}) {
  const d1 = Array.isArray(decksByAgent[a1]) ? shuffleDeck(decksByAgent[a1]) : mkDeck();
  const d2 = Array.isArray(decksByAgent[a2]) ? shuffleDeck(decksByAgent[a2]) : mkDeck();
  const a1s = { id: a1, hp: 20, mana: 0, manaMax: 0, deck: d1, hand: [], monsterZone: [null, null, null], spellZone: [null, null, null, null], graveyard: [] };
  const a2s = { id: a2, hp: 20, mana: 0, manaMax: 0, deck: d2, hand: [], monsterZone: [null, null, null], spellZone: [null, null, null, null], graveyard: [] };
  const state = {
    gameId: roomId,
    turn: 1,
    phase: 'draw',
    activeAgentId: a1,
    firstAgentId: a1,
    winnerId: null,
    agents: { [a1]: a1s, [a2]: a2s },
    units: {},
    stack: [],
    effectUsage: { [a1]: {}, [a2]: {} },
    log: ['game initialized']
  };
  for (let i = 0; i < 5; i++) { drawOne(state, a1); drawOne(state, a2); }
  state.agents[a1].manaMax = 2;
  state.agents[a1].mana = 2;
  drawOne(state, a1);
  state.log.push('turn 1 draw step resolved (phase: draw)');
  return state;
}

function applyAction(state, action) {
  const s = clone(state);
  const actor = s.agents[action.actorId];
  if (!actor) return { ok: false, reason: 'unknown actor', state: s };
  if (s.winnerId) return { ok: false, reason: 'game ended', state: s };

  if (action.type === 'concede') {
    s.winnerId = Object.keys(s.agents).find((id) => id !== action.actorId) || null;
    cleanupOrphanEquips(s);
    return { ok: true, state: s };
  }

  if (s.activeAgentId !== action.actorId) return { ok: false, reason: 'not your turn', state: s };

  if (action.type === 'end_phase') {
    const phases = ['draw', 'main', 'battle', 'end'];
    const idx = phases.indexOf(s.phase);
    if (idx < 3) {
      const isFirstAgentFirstTurn = s.turn === 1 && s.activeAgentId === s.firstAgentId;
      const nextPhase = phases[idx + 1];
      s.phase = (isFirstAgentFirstTurn && nextPhase === 'battle') ? 'end' : nextPhase;
      if (s.phase === 'end') {
        const a = s.agents[s.activeAgentId];
        for (let i = 0; i < a.spellZone.length; i++) {
          const slot = a.spellZone[i];
          const k = spellSlotKey(slot);
          if (isNormalSpell(k)) { a.graveyard.push(k); a.spellZone[i] = null; }
        }
      }
      cleanupOrphanEquips(s);
      return { ok: true, state: s };
    }

    s.turn += 1;
    s.activeAgentId = Object.keys(s.agents).find((id) => id !== s.activeAgentId);
    const a = s.agents[s.activeAgentId];
    a.manaMax = Math.min(RULES_CONST.MAX_MANA, a.manaMax + 2);
    a.mana = a.manaMax;
    for (const uid of a.monsterZone) {
      if (uid && s.units[uid]) s.units[uid].exhausted = false;
    }
    drawOne(s, s.activeAgentId);
    s.phase = 'draw';
    s.log.push(`turn ${s.turn} draw step resolved (phase: draw)`);
    cleanupOrphanEquips(s);
    return { ok: true, state: s };
  }

  if (action.type === 'play_card') {
    if (s.phase !== 'main') return { ok: false, reason: 'main only', state: s };
    const handIndex = Number(action.payload?.handIndex);
    if (Number.isNaN(handIndex) || handIndex < 0 || handIndex >= actor.hand.length) return { ok: false, reason: 'bad handIndex', state: s };
    const rawKey = actor.hand[handIndex];
    const key = normalizeCardKey(rawKey);
    const cost = getCardCost(key);
    if (actor.mana < cost) return { ok: false, reason: 'not enough mana', state: s };

    if (getCardType(key) === 'monster') {
      const zi = Number(action.payload?.zoneIndex);
      const z = Number.isInteger(zi) && zi >= 0 && zi < actor.monsterZone.length ? zi : actor.monsterZone.findIndex((x) => x === null);
      if (z < 0 || actor.monsterZone[z] !== null) return { ok: false, reason: 'monster zone full', state: s };

      actor.mana -= cost;
      actor.hand.splice(handIndex, 1);
      const unitId = `${key}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const def = getCardDef(key) || {};
      const atk = Number(def.atk || 1);
      const hp = Number(def.hp || 1);
      s.units[unitId] = { id: unitId, key, name: key, cost, atk, hp, maxHp: hp, ownerId: action.actorId, exhausted: true };
      actor.monsterZone[z] = unitId;

      runCardEffects(s, action.actorId, key, 'on_deploy', {
        unitId,
        effectUsageKey: `unit:${unitId}`,
        selectedEffectIndexes: action.payload?.selectedEffectIndexes
      });
      s.log.push(`${action.actorId} deployed ${cardLabel(key)}`);
    } else {
      const zi = Number(action.payload?.zoneIndex);
      const z = Number.isInteger(zi) && zi >= 0 && zi < actor.spellZone.length ? zi : actor.spellZone.findIndex((x) => x === null);
      if (z < 0 || actor.spellZone[z] !== null) return { ok: false, reason: 'spell zone full', state: s };

      actor.mana -= cost;
      actor.hand.splice(handIndex, 1);
      actor.spellZone[z] = key;
      runCardEffects(s, action.actorId, key, 'on_play', {
        targetUnitId: action.payload?.targetUnitId,
        spellZoneIndex: z,
        effectUsageKey: `spell:${action.actorId}:${s.turn}:${z}:${handIndex}:${Date.now()}`,
        selectedEffectIndexes: action.payload?.selectedEffectIndexes
      });
      s.log.push(`${action.actorId} used ${cardLabel(key)}`);
    }
    cleanupOrphanEquips(s);
    return { ok: true, state: s };
  }

  if (action.type === 'resolve_stack') {
    const item = s.stack.pop();
    if (!item) return { ok: false, reason: 'stack empty', state: s };

    if (item?.payload?.action) {
      runEffectAction(s, item.actorId, item.sourceCardKey, item.payload.action, { stack: true });
      cleanupOrphanEquips(s);
      return { ok: true, state: s };
    }

    const fallbackAction = getStackDefaultAction(item.effectKey);
    if (fallbackAction) {
      runEffectAction(s, item.actorId, item.sourceCardKey, fallbackAction, { stack: true });
      cleanupOrphanEquips(s);
      return { ok: true, state: s };
    }

    cleanupOrphanEquips(s);
    return { ok: false, reason: 'stack payload missing', state: s };
  }

  if (action.type === 'attack') {
    if (s.phase !== 'battle') return { ok: false, reason: 'battle only', state: s };
    const isFirstAgentFirstTurn = s.turn === 1 && s.activeAgentId === s.firstAgentId;
    if (isFirstAgentFirstTurn) return { ok: false, reason: 'battle blocked', state: s };

    const attacker = s.units[action.payload?.attackerId];
    if (!attacker || attacker.ownerId !== action.actorId || attacker.exhausted) return { ok: false, reason: 'invalid attacker', state: s };
    const opp = Object.keys(s.agents).find((id) => id !== action.actorId);

    const targetUnitId = action.payload?.targetUnitId;
    if (targetUnitId) {
      const defender = s.units[targetUnitId];
      if (!defender || defender.ownerId !== opp) return { ok: false, reason: 'invalid target', state: s };

      defender.hp -= attacker.atk;
      attacker.hp -= defender.atk;
      attacker.exhausted = true;
      s.log.push(`${action.actorId} ${cardLabel(attacker.key)} attacked ${opp} ${cardLabel(defender.key)}`);

      if (defender.hp <= 0) {
        const dz = s.agents[opp].monsterZone.findIndex((id) => id === targetUnitId);
        if (dz >= 0) s.agents[opp].monsterZone[dz] = null;
        s.agents[opp].graveyard.push(normalizeCardKey(defender.key));
        delete s.units[targetUnitId];
      }

      if (attacker.hp <= 0) {
        const az = s.agents[action.actorId].monsterZone.findIndex((id) => id === action.payload?.attackerId);
        if (az >= 0) s.agents[action.actorId].monsterZone[az] = null;
        s.agents[action.actorId].graveyard.push(normalizeCardKey(attacker.key));
        delete s.units[action.payload?.attackerId];
      }
      cleanupOrphanEquips(s);
      return { ok: true, state: s };
    }

    if (hasGuardOnBoard(s, opp)) return { ok: false, reason: 'guard blocks direct attack', state: s };
    s.agents[opp].hp -= attacker.atk;
    attacker.exhausted = true;
    s.log.push(`${action.actorId} ${cardLabel(attacker.key)} attacked agent`);
    if (s.agents[opp].hp <= 0) s.winnerId = action.actorId;
    cleanupOrphanEquips(s);
    return { ok: true, state: s };
  }

  return { ok: false, reason: 'unsupported action', state: s };
}

module.exports = { initGame, applyAction };
