import { useMemo } from 'react'
import Captions from '../components/Captions'
import AccessibleFallback from '../components/AccessibleFallback'
import { useAppState } from '../state/store'
import type { CustomerRow } from '../data/fixtures'

export default function BeatData({ customers }: { customers: CustomerRow[] }) {
  const beatIndex = useAppState((s) => s.beatIndex)
  const stats = useMemo(() => {
    const churned = customers.filter((c) => c.actual_churn === 1).length
    return { n: customers.length, churned, pct: ((churned / customers.length) * 100).toFixed(1) }
  }, [customers])

  return (
    <>
      {beatIndex === 1 && (
        <Captions
          claim="Four hundred customers from the held-out test set."
          evidence={`n=${stats.n} of 1,409 · ${stats.churned} churned (${stats.pct}%) · full test set 26.5%`}
          body="Each point is a real person. Rings mark the ones who actually left."
        />
      )}
      <AccessibleFallback heading="Beat 1: Data">
        {`Four hundred real customers from the held-out test set, ${stats.pct}% churned. Each point is shown uncolored; a ring marks those who actually churned.`}
      </AccessibleFallback>
    </>
  )
}
