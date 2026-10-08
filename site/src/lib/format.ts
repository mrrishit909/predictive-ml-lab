/**
 * Probability/SHAP display rules (interaction-map.md "Probability display
 * rules", typography.md rule 2-3). Isotonic calibration produces exact 0.0
 * and 1.0 on a handful of rows; those must never print as bare "0"/"1".
 */

export function formatProbability(p: number): string {
  if (p <= 0.0005) return '<0.001'
  if (p >= 0.9995) return '>0.999'
  return p.toFixed(3)
}

export function formatPercent(p: number): string {
  if (p <= 0.0005) return '<0.1%'
  if (p >= 0.9995) return '>99.9%'
  return `${(p * 100).toFixed(1)}%`
}

/** SHAP formatting: signed, 2 decimals, "log-odds" unit, never a percent. */
export function formatShap(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)} log-odds`
}

/** Live sensitivity formatting: signed delta-probability, 3 decimals, never log-odds. */
export function formatDeltaProbability(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(3)}`
}
