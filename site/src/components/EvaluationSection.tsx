/**
 * Beat 6 Model Evaluation (scroll-storyboard.md). Un-sticks from the
 * terrain - this is normal document flow, not a sticky canvas. Held-out
 * numbers come only from model.metrics.json; the confusion grid, ROC and
 * reliability diagram are DERIVED from the 400-row sample and labeled as
 * such throughout.
 *
 * Simplification (documented): the spec's "400 points fly from the terrain
 * into a 2x2 grid" hand-off animation isn't implemented - this section
 * renders the confusion grid directly. The sticky TerrainStack still
 * fades its own terrain to 0 on beat 5->6 via the normal alpha target.
 */
import { useMemo, useState } from 'react'
import type { Fixtures } from '../data/fixtures'
import { confusionAt, rocFromSample, reliabilityBins } from '../lib/stats'
import { logit, clamp } from '../lib/math'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { formatProbability } from '../lib/format'

function ConfusionGrid({ counts, predictions, threshold }: { counts: ReturnType<typeof confusionAt>; predictions: Fixtures['predictions']; threshold: number }) {
  const cells: { key: keyof typeof counts; label: string; predicted: 'coral' | 'mint' }[] = [
    { key: 'tp', label: 'TP', predicted: 'coral' },
    { key: 'fp', label: 'FP', predicted: 'coral' },
    { key: 'fn', label: 'FN', predicted: 'mint' },
    { key: 'tn', label: 'TN', predicted: 'mint' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, width: 260 }}>
      {cells.map((cell) => (
        <div key={cell.key} style={{ background: 'var(--surface-1)', padding: 8, minHeight: 100 }}>
          <p className="t-label">
            {cell.label} <span className="t-num">{counts[cell.key]}</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginTop: 4 }}>
            {Array.from({ length: counts[cell.key] }).map((_, i) => (
              <span key={i} style={{ width: 4, height: 4, background: `var(--${cell.predicted})`, display: 'inline-block' }} />
            ))}
          </div>
        </div>
      ))}
      <p className="t-micro" style={{ gridColumn: '1 / 3' }}>
        sample n=400 &middot; @{threshold.toFixed(2)}
      </p>
      <p className="t-micro" style={{ gridColumn: '1 / 3' }}>{predictions.length} customers total</p>
    </div>
  )
}

const COMPARISON_METRICS: { key: 'roc_auc' | 'pr_auc' | 'brier_score' | 'f1'; label: string }[] = [
  { key: 'roc_auc', label: 'ROC-AUC' },
  { key: 'pr_auc', label: 'PR-AUC' },
  { key: 'brier_score', label: 'Brier' },
  { key: 'f1', label: 'F1 @0.50' },
]

/** Mobile (responsive-spec.md): one metric at a time via a 4-option segmented switch, not the full wide table. */
function ComparisonStripMobile({ results }: { results: Fixtures['metrics']['results'] }) {
  const [active, setActive] = useState<(typeof COMPARISON_METRICS)[number]>(COMPARISON_METRICS[0])
  return (
    <div style={{ maxWidth: '100%' }}>
      <div role="radiogroup" aria-label="comparison metric" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {COMPARISON_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={m.key === active.key}
            className="t-label"
            onClick={() => setActive(m)}
            style={{
              background: m.key === active.key ? 'var(--surface-2)' : 'var(--surface-1)',
              color: m.key === active.key ? 'var(--ivory)' : 'var(--gray)',
              border: '1px solid var(--line)',
              padding: '6px 8px',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {results.map((r) => {
          const shipped = r.model === 'hist_gradient_boosting_calibrated'
          return (
            <li
              key={r.model}
              className="t-num"
              style={{ display: 'flex', justifyContent: 'space-between', color: shipped ? 'var(--ivory)' : 'var(--gray)' }}
            >
              <span>{r.model}</span>
              <span>{r[active.key].toFixed(3)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ComparisonStrip({ results }: { results: Fixtures['metrics']['results'] }) {
  const metrics = COMPARISON_METRICS
  return (
    <table className="t-num" style={{ borderCollapse: 'collapse', color: 'var(--gray)' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }} className="t-label">
            model
          </th>
          {metrics.map((m) => (
            <th key={m.key} className="t-label" style={{ textAlign: 'right', paddingLeft: 12 }}>
              {m.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => {
          const shipped = r.model === 'hist_gradient_boosting_calibrated'
          return (
            <tr key={r.model} style={{ color: shipped ? 'var(--ivory)' : 'var(--gray)' }}>
              <td>{r.model}</td>
              {metrics.map((m) => (
                <td key={m.key} style={{ textAlign: 'right', paddingLeft: 12 }}>
                  {r[m.key].toFixed(3)}
                  {m.key === 'roc_auc' && r.cv_roc_auc_std != null && (
                    <span className="t-micro"> &plusmn;{r.cv_roc_auc_std.toFixed(3)}</span>
                  )}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// Captions render as HTML below the SVG, not as an in-SVG <text> element:
// at 180px wide these caption strings (e.g. "sample n=400 · calibrated
// model only · AUC 0.854") run well past the chart's own width and an
// SVG clips content outside its viewport by default, which silently cut
// the caption off on every breakpoint (confirmed in a real screenshot at
// both 1440 and 390). HTML text just wraps instead.
function RocChart({ points, auc }: { points: { fpr: number; tpr: number }[]; auc: number }) {
  const W = 180
  const H = 180
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.fpr * W} ${H - p.tpr * H}`).join(' ')
  return (
    <figure style={{ margin: 0, maxWidth: W }}>
      <svg width={W} height={H} role="img" aria-label={`ROC curve, sample n=400, calibrated model only, AUC ${auc.toFixed(3)}`}>
        <line x1={0} y1={H} x2={W} y2={0} stroke="var(--line)" strokeDasharray="2,3" />
        <path d={path} fill="none" stroke="var(--gray)" strokeWidth={1.5} />
      </svg>
      <figcaption className="t-micro" style={{ marginTop: 4 }}>
        sample n=400 &middot; calibrated model only &middot; AUC {auc.toFixed(3)}
      </figcaption>
    </figure>
  )
}

function ReliabilityChart({ bins }: { bins: { meanPredicted: number; observedRate: number; n: number }[] }) {
  const W = 180
  const H = 180
  return (
    <figure style={{ margin: 0, maxWidth: W }}>
      <svg width={W} height={H} role="img" aria-label="Reliability diagram, quantile bins, sample n=400">
        <line x1={0} y1={H} x2={W} y2={0} stroke="var(--line)" strokeDasharray="2,3" />
        {bins.map((b, i) => (
          <circle key={i} cx={b.meanPredicted * W} cy={H - b.observedRate * H} r={3} fill="var(--mint)" />
        ))}
      </svg>
      <figcaption className="t-micro" style={{ marginTop: 4 }}>
        quantile bins &middot; sample n=400
      </figcaption>
    </figure>
  )
}

export default function EvaluationSection({ fixtures }: { fixtures: Fixtures }) {
  const breakpoint = useBreakpoint()
  const [threshold, setThreshold] = useState(0.1)
  const counts = useMemo(() => confusionAt(fixtures.predictions, threshold), [fixtures.predictions, threshold])
  const { points: rocPoints, auc } = useMemo(() => rocFromSample(fixtures.predictions), [fixtures.predictions])
  const bins = useMemo(() => reliabilityBins(fixtures.predictions), [fixtures.predictions])

  const calibrated = fixtures.metrics.results.find((r) => r.model === 'hist_gradient_boosting_calibrated')!
  const cost = fixtures.metrics.cost_threshold_metrics

  const lo = logit(0.01)
  const hi = logit(0.9)
  const railX = clamp((logit(threshold) - lo) / (hi - lo), 0, 1)

  return (
    <section
      aria-label="Model evaluation"
      style={{
        padding: breakpoint === 'mobile' ? 16 : 48,
        display: 'flex',
        flexDirection: breakpoint === 'desktop' ? 'row' : 'column',
        gap: 32,
        flexWrap: 'wrap',
        maxWidth: '100vw',
        overflowX: breakpoint === 'mobile' ? 'hidden' : 'visible',
      }}
    >
      <div>
        <h2 className="t-h1">How often is it right?</h2>
        <div style={{ marginTop: 16 }}>
          <p className="t-label">Held-out test set &middot; n=1,409</p>
          <p className="t-num-lg">ROC-AUC {calibrated.roc_auc.toFixed(3)}</p>
          <p className="t-num-lg">PR-AUC {calibrated.pr_auc.toFixed(3)}</p>
          <p className="t-num-lg">Brier {calibrated.brier_score.toFixed(3)}</p>
          <p className="t-body" style={{ marginTop: 12, color: 'var(--gray)' }}>
            @0.10: TN {cost.confusion_matrix.tn} &middot; FP {cost.confusion_matrix.fp} &middot; FN{' '}
            {cost.confusion_matrix.fn} &middot; TP {cost.confusion_matrix.tp} &middot; recall{' '}
            {cost.recall.toFixed(3)} &middot; precision {cost.precision.toFixed(3)}
          </p>
          <p className="t-body" style={{ color: 'var(--gray)' }}>
            @0.50: TN {calibrated.confusion_matrix.tn} &middot; FP {calibrated.confusion_matrix.fp} &middot; FN{' '}
            {calibrated.confusion_matrix.fn} &middot; TP {calibrated.confusion_matrix.tp} &middot; precision{' '}
            {calibrated.precision.toFixed(3)} &middot; recall {calibrated.recall.toFixed(3)} &middot; F1{' '}
            {calibrated.f1.toFixed(3)}
          </p>
          <p className="t-body" style={{ marginTop: 8, maxWidth: '44ch' }}>
            At 0.10 it catches 96% of churners and pays for it in false alarms. That trade was chosen by cost: a
            missed churner costs $500, a false alarm costs $50.
          </p>
        </div>
      </div>

      <div>
        <ConfusionGrid counts={counts} predictions={fixtures.predictions} threshold={threshold} />
        <div style={{ marginTop: 16, width: 260 }}>
          <label className="t-label" htmlFor="eval-threshold-rail">
            threshold (sample only, live p {formatProbability(threshold)})
          </label>
          <input
            id="eval-threshold-rail"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={railX}
            onChange={(e) => {
              const x = Number(e.target.value)
              const t = Math.exp(lo + x * (hi - lo))
              setThreshold(t / (1 + t))
            }}
            style={{ width: '100%' }}
          />
          <p className="t-micro">marks: 0.10 shipped, 0.50 default</p>
        </div>
      </div>

      <div>
        <p className="t-label" style={{ marginBottom: 8 }}>
          model comparison
        </p>
        {breakpoint === 'mobile' ? (
          <ComparisonStripMobile results={fixtures.metrics.results} />
        ) : (
          <ComparisonStrip results={fixtures.metrics.results} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: breakpoint === 'mobile' ? 'column' : 'row', gap: 16 }}>
        <RocChart points={rocPoints} auc={auc} />
        <ReliabilityChart bins={bins} />
      </div>
    </section>
  )
}
