import fs from 'node:fs';
import path from 'node:path';
import { TriggerTiming } from './types';

export interface TriggerRule {
  id: string;
  timing: TriggerTiming;
  sourceCardKey?: string;
  effectKey: string;
  speed?: 'normal' | 'instant';
}

export interface EffectsConfig {
  triggers: Record<TriggerTiming, TriggerRule[]>;
  effects: Record<string, Record<string, unknown>>;
}

const EMPTY: EffectsConfig = {
  triggers: {
    on_summon: [],
    on_attack_declared: [],
    on_turn_start: [],
    on_turn_end: [],
  },
  effects: {},
};

export function loadEffectsConfig(): EffectsConfig {
  const p = path.resolve(process.cwd(), 'tcg/spec/effects_v0_1.json');
  if (!fs.existsSync(p)) return EMPTY;
  const raw = fs.readFileSync(p, 'utf-8');
  const data = JSON.parse(raw) as Partial<EffectsConfig>;

  return {
    triggers: {
      on_summon: data.triggers?.on_summon ?? [],
      on_attack_declared: data.triggers?.on_attack_declared ?? [],
      on_turn_start: data.triggers?.on_turn_start ?? [],
      on_turn_end: data.triggers?.on_turn_end ?? [],
    },
    effects: data.effects ?? {},
  };
}
