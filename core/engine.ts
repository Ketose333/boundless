import {
  ApplyResult,
  EngineAction,
  EngineConfig,
  GameState,
  AgentState,
  RuleEngine,
  UnitCardState,
} from './types';
import { loadCardPool } from './cards';
import { buildStarterDeck, validateDeck } from './deck';
import { loadEffectsConfig } from './effects';

const defaultConfig: Required<EngineConfig> = {
  startingHp: 20,
  startingHand: 5,
  maxMana: 12,
};

export class BasicRuleEngine implements RuleEngine {
  private readonly cfg: Required<EngineConfig>;
  private readonly cardPool = loadCardPool();
  private readonly effectsConfig = loadEffectsConfig();

  constructor(config: EngineConfig = {}) {
    this.cfg = { ...defaultConfig, ...config };
  }

  init(gameId: string, agentIds: [string, string]): GameState {
    const [p1, p2] = agentIds;

    const mkDeck = () => this.makeDeck();

    const mkAgent = (id: string): AgentState => {
      const deck = mkDeck();
      return {
        id,
        hp: this.cfg.startingHp,
        mana: 0,
        manaMax: 0,
        deck,
        hand: [],
        monsterZone: [null, null, null],
        spellZone: [null, null, null, null],
        graveyard: [],
      };
    };

    const state: GameState = {
      gameId,
      turn: 1,
      phase: 'draw',
      activeAgentId: p1,
      firstAgentId: p1,
      winnerId: null,
      agents: {
        [p1]: mkAgent(p1),
        [p2]: mkAgent(p2),
      },
      units: {},
      stack: [],
      log: ['game initialized'],
    };

    // 시작 핸드 5장 + 선공 드로우 1장, 시작 마나 2
    for (const pid of agentIds) {
      for (let i = 0; i < this.cfg.startingHand; i += 1) {
        this.drawOne(state, pid);
      }
    }
    state.agents[p1].manaMax = 2;
    state.agents[p1].mana = 2;
    this.drawOne(state, p1);

    return state;
  }

  getLegalActions(state: GameState, actorId: string): EngineAction[] {
    if (state.winnerId) return [];
    if (state.activeAgentId !== actorId) return [{ type: 'concede', actorId }];

    const actions: EngineAction[] = [{ type: 'end_phase', actorId }, { type: 'concede', actorId }];
    if (state.stack.length > 0) actions.push({ type: 'resolve_stack', actorId });
    if (state.phase === 'main') actions.push({ type: 'play_card', actorId });
    if (state.phase === 'battle' && this.canEnterBattle(state)) actions.push({ type: 'attack', actorId });
    return actions;
  }

  applyAction(state: GameState, action: EngineAction): ApplyResult {
    const next = structuredClone(state) as GameState;

    if (next.winnerId) return this.fail(next, 'game already ended');
    if (!next.agents[action.actorId]) return this.fail(next, 'unknown actor');

    if (action.type === 'concede') {
      next.winnerId = this.getOpponentAgentId(next, action.actorId);
      next.log.push(`${action.actorId} conceded`);
      return { ok: true, state: next };
    }

    if (next.activeAgentId !== action.actorId) return this.fail(next, 'not your turn');

    switch (action.type) {
      case 'end_phase':
        if (next.stack.length > 0) return this.fail(next, 'cannot end phase while stack is not empty');
        this.advancePhase(next);
        return { ok: true, state: next };
      case 'play_card':
        return this.playCard(next, action);
      case 'attack':
        return this.attack(next, action);
      case 'resolve_stack':
        return this.resolveStack(next, action.actorId);
      default:
        return this.fail(next, 'unsupported action');
    }
  }

  private playCard(state: GameState, action: EngineAction): ApplyResult {
    if (state.phase !== 'main') return this.fail(state, 'play_card only in main phase');
    const p = state.agents[action.actorId];
    const handIndex = action.payload?.handIndex;
    if (typeof handIndex !== 'number') return this.fail(state, 'handIndex required');
    if (handIndex < 0 || handIndex >= p.hand.length) return this.fail(state, 'invalid handIndex');

    const cardKey = p.hand[handIndex];
    const def = this.cardPool.find((c) => c.key === cardKey);
    if (!def) return this.fail(state, 'unknown card key');
    if (p.mana < def.cost) return this.fail(state, 'not enough mana');

    if (def.type === 'monster') {
      const zoneIndex = this.resolveZoneIndex(action.payload?.zoneIndex, p.monsterZone);
      if (zoneIndex < 0) return this.fail(state, 'monster zone full or invalid');

      const unitId = `${cardKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const unit: UnitCardState = {
        id: unitId,
        key: def.key,
        name: def.name,
        cost: def.cost,
        atk: def.atk ?? 0,
        hp: def.hp ?? 1,
        maxHp: def.hp ?? 1,
        ownerId: action.actorId,
        exhausted: true, // 소환 턴 공격 불가
      };
      state.units[unitId] = unit;
      p.monsterZone[zoneIndex] = unitId;
      p.mana -= def.cost;
      p.hand.splice(handIndex, 1);
      state.log.push(`${action.actorId} played monster ${def.name}`);
      this.emitTrigger(state, 'on_summon', {
        actorId: action.actorId,
        sourceCardKey: def.key,
        sourceUnitId: unitId,
      });
      return { ok: true, state };
    }

    // 마법: 스펠존에 올리고 효과는 스택에 적재
    const zoneIndex = this.resolveZoneIndex(action.payload?.zoneIndex, p.spellZone);
    if (zoneIndex < 0) return this.fail(state, 'spell zone full or invalid');
    p.spellZone[zoneIndex] = def.key;
    p.mana -= def.cost;
    p.hand.splice(handIndex, 1);
    state.stack.push({
      id: `stk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      actorId: action.actorId,
      sourceCardKey: def.key,
      effectKey: def.key,
      payload: action.payload,
    });
    state.log.push(`${action.actorId} played spell ${def.name} (stacked)`);
    return { ok: true, state };
  }

  private attack(state: GameState, action: EngineAction): ApplyResult {
    if (state.phase !== 'battle') return this.fail(state, 'attack only in battle phase');
    if (!this.canEnterBattle(state)) return this.fail(state, 'battle blocked for first player first turn');

    const actor = state.agents[action.actorId];
    const opponentAgentId = this.getOpponentAgentId(state, action.actorId);
    const opponent = state.agents[opponentAgentId];

    const attackerId = action.payload?.attackerId;
    if (!attackerId) return this.fail(state, 'attackerId required');
    const attacker = state.units[attackerId];
    if (!attacker) return this.fail(state, 'attacker not found');
    if (attacker.ownerId !== action.actorId) return this.fail(state, 'attacker owner mismatch');
    if (attacker.exhausted) return this.fail(state, 'attacker exhausted');

    const attackerAtk = this.getEffectiveAtk(state, attacker.id);

    this.emitTrigger(state, 'on_attack_declared', {
      actorId: action.actorId,
      attackerId,
      targetUnitId: action.payload?.targetUnitId,
    });

    const targetUnitId = action.payload?.targetUnitId;
    if (targetUnitId) {
      const target = state.units[targetUnitId];
      if (!target || target.ownerId !== opponentAgentId) return this.fail(state, 'invalid target unit');
      const targetAtk = this.getEffectiveAtk(state, target.id);
      target.hp -= attackerAtk;
      attacker.hp -= targetAtk;
      state.log.push(`${attacker.name} attacked ${target.name} (${attackerAtk} vs ${targetAtk})`);
      this.cleanupDeadUnits(state, actor.id);
      this.cleanupDeadUnits(state, opponent.id);
    } else {
      opponent.hp -= attackerAtk;
      state.log.push(`${attacker.name} attacked player ${opponentAgentId} for ${attackerAtk}`);
      if (opponent.hp <= 0) {
        state.winnerId = action.actorId;
        state.log.push(`winner: ${action.actorId}`);
      }
    }

    attacker.exhausted = true;
    return { ok: true, state };
  }

  private resolveStack(state: GameState, actorId: string): ApplyResult {
    if (state.stack.length === 0) return this.fail(state, 'stack is empty');

    const item = state.stack.pop()!; // LIFO
    const opponentAgentId = this.getOpponentAgentId(state, item.actorId);

    // 코어 내장 최소 효과(룰 동작 검증용)
    if (item.effectKey === 'direct_hit') {
      const targetUnitId = (item.payload?.targetUnitId as string | undefined) || '';
      if (targetUnitId && state.units[targetUnitId]) {
        state.units[targetUnitId].hp -= 3;
        state.log.push(`stack resolved: direct_hit dealt 3 to unit ${targetUnitId}`);
        this.cleanupDeadUnits(state, state.units[targetUnitId].ownerId);
      } else {
        state.agents[opponentAgentId].hp -= 3;
        state.log.push(`stack resolved: direct_hit dealt 3 to player ${opponentAgentId}`);
        if (state.agents[opponentAgentId].hp <= 0) {
          state.winnerId = item.actorId;
          state.log.push(`winner: ${item.actorId}`);
        }
      }
      return { ok: true, state };
    }

    // 이후 효과는 외부 룰 데이터/핸들러에서 매핑 예정
    state.log.push(`stack resolved: ${item.effectKey} (unmapped)`);
    return { ok: true, state };
  }

  private advancePhase(state: GameState): void {
    const phases: Array<GameState['phase']> = ['draw', 'main', 'battle', 'end'];
    const idx = phases.indexOf(state.phase);

    if (idx < phases.length - 1) {
      state.phase = phases[idx + 1];
      if (state.phase === 'draw') this.onDrawPhaseStart(state);
      if (state.phase === 'end') this.onEndPhase(state);
      return;
    }

    state.turn += 1;
    state.activeAgentId = this.getOpponentAgentId(state, state.activeAgentId);
    state.phase = 'draw';
    this.onDrawPhaseStart(state);
  }

  private onDrawPhaseStart(state: GameState): void {
    const p = state.agents[state.activeAgentId];

    p.manaMax = Math.min(this.cfg.maxMana, p.manaMax + 2);
    p.mana = p.manaMax;

    // 몬스터 소환멀미 해제
    for (const unitId of p.monsterZone) {
      if (!unitId) continue;
      const u = state.units[unitId];
      if (u) u.exhausted = false;
    }

    this.emitTrigger(state, 'on_turn_start', { actorId: state.activeAgentId });

this.drawOne(state, state.activeAgentId);
  }

  private onEndPhase(state: GameState): void {
    this.emitTrigger(state, 'on_turn_end', { actorId: state.activeAgentId });

    const p = state.agents[state.activeAgentId];
    for (let i = 0; i < p.spellZone.length; i += 1) {
      const spell = p.spellZone[i];
      if (!spell) continue;
      const def = this.cardPool.find((c) => c.key === spell);
      if (def?.type === 'spell' && def?.spellKind === 'normal') {
        p.graveyard.push(spell);
        p.spellZone[i] = null;
      }
    }
  }

  private cleanupDeadUnits(state: GameState, agentId: string): void {
    const p = state.agents[agentId];
    for (let i = 0; i < p.monsterZone.length; i += 1) {
      const unitId = p.monsterZone[i];
      if (!unitId) continue;
      const u = state.units[unitId];
      if (!u || u.hp > 0) continue;
      p.graveyard.push(u.key);
      p.monsterZone[i] = null;
      delete state.units[unitId];
    }
  }

  private drawOne(state: GameState, agentId: string): void {
    const p = state.agents[agentId];
    const top = p.deck.shift();
    if (!top) {
      state.winnerId = this.getOpponentAgentId(state, agentId);
      state.log.push(`${agentId} deck out`);
      return;
    }
    p.hand.push(top);
    state.log.push(`${agentId} drew 1 card`);
  }

  private resolveZoneIndex(idx: number | undefined, zone: Array<string | null>): number {
    if (typeof idx === 'number') {
      if (idx >= 0 && idx < zone.length && zone[idx] === null) return idx;
      return -1;
    }
    return zone.findIndex((x) => x === null);
  }

  private makeDeck(): string[] {
    const deck = buildStarterDeck();
    const v = validateDeck(deck, this.cardPool);
    if (!v.ok) {
      throw new Error(v.reason || 'invalid starter deck');
    }
    return this.shuffle(deck);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private emitTrigger(
    state: GameState,
    timing: 'on_summon' | 'on_attack_declared' | 'on_turn_start' | 'on_turn_end',
    payload: Record<string, unknown>,
  ): void {
    const triggerRules = this.effectsConfig.triggers[timing] ?? [];
    if (triggerRules.length === 0) {
      state.log.push(`trigger emitted: ${timing} (no mapped rules)`);
      return;
    }

    const sourceCardKey = (payload.sourceCardKey as string | undefined) || undefined;

    for (const r of triggerRules) {
      if (r.sourceCardKey && sourceCardKey && r.sourceCardKey !== sourceCardKey) continue;
      if (r.sourceCardKey && !sourceCardKey) continue;

      state.stack.push({
        id: `stk_${r.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        actorId: (payload.actorId as string) || state.activeAgentId,
        sourceCardKey: r.sourceCardKey || sourceCardKey || 'system',
        effectKey: r.effectKey,
        speed: r.speed || 'normal',
        payload,
      });
    }

    state.log.push(`trigger emitted: ${timing} -> ${triggerRules.length} mapped`);
  }

  private getEffectiveAtk(state: GameState, unitId: string): number {
    const unit = state.units[unitId];
    if (!unit) return 0;

    let bonus = 0;
    const owner = state.agents[unit.ownerId];
    // 지속 마법 'banner': 자신 몬스터 공격력 +1
    if (owner.spellZone.some((k) => k === 'banner')) bonus += 1;

    return Math.max(0, unit.atk + bonus);
  }

  private canEnterBattle(state: GameState): boolean {
    return !this.isFirstPlayerFirstTurn(state, state.activeAgentId);
  }

  private isFirstPlayerFirstTurn(state: GameState, agentId: string): boolean {
    return state.turn === 1 && state.firstAgentId === agentId;
  }

  private getOpponentAgentId(state: GameState, actorId: string): string {
    const ids = Object.keys(state.agents);
    return ids.find((id) => id !== actorId) ?? actorId;
  }

  private fail(state: GameState, reason: string): ApplyResult {
    state.log.push(`invalid: ${reason}`);
    return { ok: false, reason, state };
  }
}
