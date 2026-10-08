/**
 * Mini threshold rail (interaction-map.md): 400 ticks at logit(p), the
 * coral 0.10 rule, the edited customer's live tick. Click a tick to select
 * that customer. Rendered as a lightweight SVG strip, not canvas - 400
 * static ticks don't need a redraw loop.
 */
import type { CustomerRow, PredictionRow } from '../data/fixtures'
import { logit, clamp } from '../lib/math'
import { setFocalCustomer, useAppState } from '../state/store'
import { formatProbability } from '../lib/format'

const LO = logit(0.001)
const HI = logit(0.999)

function nx(p: number): number {
  return clamp((logit(p) - LO) / (HI - LO), 0, 1)
}

export default function MiniThresholdRail({ customers, predictions }: { customers: CustomerRow[]; predictions: PredictionRow[] }) {
  const focalId = useAppState((s) => s.focalId)
  const focalP = useAppState((s) => s.focalP)
  const predById = new Map(predictions.map((p) => [p.id, p]))
  const thresholdX = nx(0.1) * 100

  return (
    <div
      role="group"
      aria-label="Threshold rail: all 400 customers positioned by churn probability, 0.10 threshold marked"
      style={{ position: 'relative', height: 24, width: '100%' }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${thresholdX}%`,
          top: 0,
          bottom: 0,
          width: 1.5,
          background: 'var(--coral)',
          boxShadow: '0 0 6px var(--coral-16)',
        }}
      />
      {customers.map((c) => {
        const pred = predById.get(c.id)
        if (!pred) return null
        const isFocal = c.id === focalId
        const p = isFocal && focalP != null ? focalP : pred.churn_probability
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setFocalCustomer(c)}
            title={`#${c.id} · ${formatProbability(p)}`}
            style={{
              position: 'absolute',
              left: `${nx(p) * 100}%`,
              top: isFocal ? 2 : 8,
              width: isFocal ? 2 : 1,
              height: isFocal ? 20 : 10,
              background: isFocal ? 'var(--ivory)' : p >= 0.1 ? 'var(--coral-60)' : 'var(--mint-40)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          />
        )
      })}
    </div>
  )
}
