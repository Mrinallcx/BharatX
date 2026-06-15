import { COMPUTE_FNS, type ComputeFn } from './compute';
import { INDICATOR_DEFS, type IndicatorDefMeta } from './indicators-meta';

export type { IndicatorDefMeta, IndicatorParamSpec } from './indicators-meta';
export { CATEGORY_LABELS, CATEGORY_ORDER, MAX_INDICATORS, getIndicatorMeta, INDICATOR_DEFS } from './indicators-meta';

export interface IndicatorDef extends IndicatorDefMeta {
  compute: ComputeFn;
}

export const INDICATORS: IndicatorDef[] = INDICATOR_DEFS.map((def) => {
  const compute = COMPUTE_FNS[def.id];
  if (!compute) throw new Error(`Missing compute fn for indicator '${def.id}'`);
  return { ...def, compute };
});

export const INDICATOR_MAP: Record<string, IndicatorDef> = Object.fromEntries(INDICATORS.map((i) => [i.id, i]));

export function getIndicator(id: string): IndicatorDef | undefined {
  return INDICATOR_MAP[id];
}

export function defaultParams(def: IndicatorDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params ?? []) out[p.key] = p.default;
  return out;
}
