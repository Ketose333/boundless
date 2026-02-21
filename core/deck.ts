import { CardDef } from './types';

export function validateDeck(deck: string[], cardPool: CardDef[]): { ok: boolean; reason?: string } {
  if (deck.length < 30) return { ok: false, reason: 'deck must contain at least 30 cards' };

  const keySet = new Set(cardPool.map((c) => c.key));
  const count: Record<string, number> = {};

  for (const key of deck) {
    if (!keySet.has(key)) return { ok: false, reason: `unknown card key: ${key}` };
    count[key] = (count[key] || 0) + 1;
    if (count[key] > 3) return { ok: false, reason: `max 3 copies exceeded: ${key}` };
  }

  return { ok: true };
}

export function buildStarterDeck(): string[] {
  const keys = ['vanguard','sharpshooter','heavy_cavalry','guard_corps','war_engine','direct_hit','tactical_order','overload','suppression_fire','emergency_repair'];
  return keys.flatMap((k) => [k, k, k]);
}
