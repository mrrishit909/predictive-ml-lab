import { useMemo } from 'react'
import Captions from '../components/Captions'
import AccessibleFallback from '../components/AccessibleFallback'
import { useAppState, setFocalCustomer } from '../state/store'
import { subStep } from '../motion/scroll-scenes'
import { hasThresholdContour } from '../visualizations/FieldLayer'
import { formatProbability } from '../lib/format'
import type { CustomerRow, PredictionRow } from '../data/fixtures'

/**
 * Beat 3's accessible customer picker (interaction-map.md: "a visually
 * hidden listbox lists all 400 customers... arrow keys move the
 * selection, mirrored on the canvas"). A native <select> gives that same
 * keyboard-driven selection with far less code than a custom ARIA listbox.
 */
function CustomerProxyList({ customers, predictions, focalId }: { customers: CustomerRow[]; predictions: PredictionRow[]; focalId: number }) {
  const predById = new Map(predictions.map((p) => [p.id, p]))
  return (
    <label className="visually-hidden">
      Select a customer to stand on their ground
      <select
        value={focalId}
        onChange={(e) => {
          const row = customers.find((c) => c.id === Number(e.target.value))
          if (row) setFocalCustomer(row)
        }}
      >
        {customers.map((c) => {
          const pred = predById.get(c.id)
          return (
            <option key={c.id} value={c.id}>
              #{c.id} · {c.tenure} mo · ${c.MonthlyCharges.toFixed(2)} · p {pred ? formatProbability(pred.churn_probability) : '...'} ·{' '}
              {c.actual_churn ? 'churned' : 'stayed'}
            </option>
          )
        })}
      </select>
    </label>
  )
}

export default function BeatBoundary({ customers, predictions, grid, gridMeta }: {
  customers: CustomerRow[]
  predictions: PredictionRow[]
  grid: Float32Array | null
  gridMeta: { cols: number; rows: number } | null
}) {
  const beatIndex = useAppState((s) => s.beatIndex)
  const beatProgress = useAppState((s) => s.beatProgress)
  const focalId = useAppState((s) => s.focalId)
  const flaggedCount = useMemo(() => predictions.filter((p) => p.churn_probability >= 0.1).length, [predictions])
  const noContour = grid ? !hasThresholdContour(grid) : false

  if (beatIndex !== 3) {
    return (
      <AccessibleFallback heading="Beat 3: Decision boundary">
        The model draws its decision at calibrated probability 0.10; the terrain shows where that boundary falls for
        the focal customer&rsquo;s profile across tenure and monthly charge.
      </AccessibleFallback>
    )
  }

  const sub = subStep(beatProgress)

  return (
    <>
      {sub === 0 && (
        <Captions
          claim="One number decides: the calibrated probability."
          evidence={`${flaggedCount} of ${predictions.length} flagged · threshold chosen to minimize cost: a missed churner costs $500, a false alarm $50.`}
        />
      )}
      {sub === 1 && (
        <Captions
          claim="The background is the model's answer for every customer like her."
          evidence={`${gridMeta ? gridMeta.cols * gridMeta.rows : '…'} live predictions, computed in your browser.`}
          body="Differing only in tenure and monthly charge. TotalCharges = tenure × charge."
        />
      )}
      {sub === 2 && (
        <Captions
          claim="Some dots disagree with the ground beneath them."
          body={
            noContour
              ? 'No 0.10 boundary in this slice: the model flags this profile at every tenure and price shown.'
              : 'Each dot has its own 17 other attributes. The ground only shows this customer’s. Click any customer to stand on their ground.'
          }
        />
      )}
      <CustomerProxyList customers={customers} predictions={predictions} focalId={focalId} />
      <AccessibleFallback heading="Beat 3: Decision boundary">
        {`${flaggedCount} of ${predictions.length} customers are flagged at threshold 0.10. ${noContour ? 'This profile has no 0.10 boundary in the shown range.' : 'The 0.10 contour runs through the plane.'} Use the customer picker to change whose ground you stand on.`}
      </AccessibleFallback>
    </>
  )
}
