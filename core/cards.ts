import fs from 'node:fs';
import path from 'node:path';
import { CardDef } from './types';

export function loadCardPool(): CardDef[] {
  const p = path.resolve(process.cwd(), 'tcg/spec/cards_v0_1.json');
  const raw = fs.readFileSync(p, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('cards_v0_1.json must be an array');
  return data as CardDef[];
}
