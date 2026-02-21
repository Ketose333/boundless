export type Phase = 'draw' | 'main' | 'battle' | 'end';

export type ZoneType = 'deck' | 'hand' | 'monster' | 'spell' | 'graveyard';

export type CardType = 'monster' | 'spell';

export type SpellKind = 'normal' | 'continuous' | 'equip';

export type TriggerTiming = 'on_summon' | 'on_attack_declared' | 'on_turn_start' | 'on_turn_end';

export interface CardDef {
  key: string;
  name: string;
  type: CardType;
  cost: number;
  atk?: number;
  hp?: number;
  spellKind?: SpellKind;
  effect?: string;
  race?: string;
  theme?: string;
  element?: string;
  tags?: string[];
  triggerTimings?: TriggerTiming[];
}

export interface UnitCardState {
  id: string;
  key: string;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  maxHp: number;
  ownerId: string;
  exhausted?: boolean;
}

export interface AgentState {
  id: string;
  hp: number;
  mana: number;
  manaMax: number;
  deck: string[];
  hand: string[];
  monsterZone: Array<string | null>;
  spellZone: Array<string | null>;
  graveyard: string[];
}

export interface StackItem {
  id: string;
  actorId: string;
  sourceCardKey: string;
  effectKey: string;
  speed?: 'normal' | 'instant';
  payload?: Record<string, unknown>;
}

export interface GameState {
  gameId: string;
  turn: number;
  phase: Phase;
  activeAgentId: string;
  firstAgentId: string;
  winnerId: string | null;
  agents: Record<string, AgentState>;
  units: Record<string, UnitCardState>;
  stack: StackItem[];
  log: string[];
}

export interface EngineConfig {
  startingHp?: number;
  startingHand?: number;
  maxMana?: number;
}

export type ActionType = 'play_card' | 'attack' | 'end_phase' | 'resolve_stack' | 'concede';

export interface EngineAction {
  type: ActionType;
  actorId: string;
  payload?: {
    handIndex?: number;
    zoneIndex?: number;
    attackerId?: string;
    targetAgentId?: string;
    targetUnitId?: string;
  };
}

export interface ApplyResult {
  ok: boolean;
  reason?: string;
  state: GameState;
}

export interface RuleEngine {
  init(gameId: string, agentIds: [string, string]): GameState;
  getLegalActions(state: GameState, actorId: string): EngineAction[];
  applyAction(state: GameState, action: EngineAction): ApplyResult;
}
