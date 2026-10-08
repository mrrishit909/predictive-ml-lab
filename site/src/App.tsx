import { useEffect, useRef, useState } from 'react'
import TerrainStack from './visualizations/TerrainStack'
import IntroScene from './components/IntroScene'
import InstrumentRail from './components/InstrumentRail'
import MobileBeatPanel from './components/MobileBeatPanel'
import MiniThresholdRail from './components/MiniThresholdRail'
import InferenceLedger from './components/InferenceLedger'
import EvaluationSection from './components/EvaluationSection'
import HeroWorkspace from './experiences/HeroWorkspace'
import BeatData from './experiences/BeatData'
import BeatFeatures from './experiences/BeatFeatures'
import BeatBoundary from './experiences/BeatBoundary'
import BeatPrediction from './experiences/BeatPrediction'
import BeatExplanation from './experiences/BeatExplanation'
import { loadFixtures, joinCustomerPrediction, topFactorsFor, DEFAULT_FOCAL_ID, type Fixtures } from './data/fixtures'
import { useMetadata } from './hooks/useMetadata'
import { useBreakpoint } from './hooks/useBreakpoint'
import { useScrollBeats, TOTAL_SCROLL_TRACK_VH } from './motion/scroll-scenes'
import { useInferenceWorker } from './inference/useInferenceWorker'
import { useAppState, setFocalCustomer, readIntroSeen } from './state/store'
import { GRID_RESOLUTION } from './motion/config'
import { formatProbability } from './lib/format'
import type { CustomerFeatures } from './inference/churnModel'

/**
 * Always-rendered probability readout (responsive-spec.md: "num-hero
 * top-left... fixed" on mobile; desktop/tablet also duplicate this number
 * inside the rail/dock once expanded). Kept unconditional, unlike the
 * rail's copy, so the live probability is never gated behind a
 * hover/expand interaction.
 */
function FocalProbabilityTag({ breakpoint }: { breakpoint: 'desktop' | 'tablet' | 'mobile' }) {
  const focalP = useAppState((s) => s.focalP)
  const edited = useAppState((s) => s.edited)
  return (
    <div
      style={{
        position: 'absolute',
        top: breakpoint === 'mobile' ? 28 : 16,
        left: breakpoint === 'mobile' ? 12 : 16,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <span
        className={breakpoint === 'mobile' ? 't-num-hero' : 't-num'}
        data-testid="focal-probability"
        data-edited={edited}
        style={{ color: 'var(--ivory)' }}
      >
        {focalP != null ? formatProbability(focalP) : '...'}
      </span>
    </div>
  )
}

function Tooltip({ fixtures, hoveredId }: { fixtures: Fixtures; hoveredId: number | null }) {
  if (hoveredId == null) return null
  const joined = joinCustomerPrediction(fixtures, hoveredId)
  if (!joined) return null
  const { customer, prediction } = joined
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        padding: 10,
      }}
      role="status"
    >
      <p className="t-num" style={{ color: 'var(--ivory)' }}>
        #{customer.id} · {customer.tenure} mo · ${customer.MonthlyCharges.toFixed(2)} · {customer.Contract} ·{' '}
        {customer.InternetService}
      </p>
      <p className="t-num">
        p {formatProbability(prediction.churn_probability)} · actual: {customer.actual_churn ? 'churned' : 'stayed'}
      </p>
    </div>
  )
}

export default function App() {
  const [fixtures, setFixtures] = useState<Fixtures | null>(null)
  const [introActive, setIntroActive] = useState(() => !readIntroSeen())
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const metadata = useMetadata()
  const breakpoint = useBreakpoint()
  const worker = useInferenceWorker()

  const model = useAppState((s) => s.model)
  const focalId = useAppState((s) => s.focalId)
  const features = useAppState((s) => s.features)
  const beatIndex = useAppState((s) => s.beatIndex)
  const grid = useAppState((s) => s.grid)
  const gridMeta = useAppState((s) => s.gridMeta)

  useScrollBeats(trackRef)

  useEffect(() => {
    loadFixtures().then(setFixtures)
  }, [])

  useEffect(() => {
    if (!fixtures) return
    const row = fixtures.customers.find((c) => c.id === DEFAULT_FOCAL_ID)
    if (row) setFocalCustomer(row)
  }, [fixtures])

  // live single-row inference whenever features change and the model is ready
  useEffect(() => {
    if (model !== 'ready' || !features) return
    worker.requestPredict(features)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, features])

  // real grid recompute whenever the focal customer's features change
  useEffect(() => {
    if (model !== 'ready' || !features) return
    const res = GRID_RESOLUTION[breakpoint]
    const id = setTimeout(() => worker.requestGrid(features, res.cols, res.rows, false), 60)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, features, breakpoint])

  if (!fixtures || !metadata) {
    return (
      <div style={{ padding: 40, color: 'var(--ivory)' }}>
        <p className="t-body">Loading real customer data...</p>
      </div>
    )
  }

  if (introActive) {
    return <IntroScene fixtures={fixtures} onDone={() => setIntroActive(false)} />
  }

  const focalJoined = joinCustomerPrediction(fixtures, focalId)
  const topFactors = topFactorsFor(fixtures, focalId)

  const requestSensitivity = (customer: CustomerFeatures) => worker.requestSensitivity(customer)

  // Mobile only (responsive-spec.md beat 5 row): the terrain window shrinks
  // to 34svh so the full-width explanation ledger below it has room.
  const mobileTerrainSvh = beatIndex === 5 ? 34 : 58

  return (
    <main>
      <h1 className="visually-hidden">PREDICTIVE: a churn model you can stand on</h1>
      <div ref={trackRef} style={{ position: 'relative', height: `${TOTAL_SCROLL_TRACK_VH}vh` }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: breakpoint === 'mobile' ? `${mobileTerrainSvh}svh` : '100svh',
            overflow: 'hidden',
          }}
        >
          <TerrainStack customers={fixtures.customers} predictions={fixtures.predictions} onHoverPoint={setHoveredId} />
          <FocalProbabilityTag breakpoint={breakpoint} />

          <HeroWorkspace focal={focalJoined?.customer} />
          <BeatData customers={fixtures.customers} />
          <BeatFeatures customers={fixtures.customers} globalImportance={fixtures.explanations.global} />
          <BeatBoundary
            customers={fixtures.customers}
            predictions={fixtures.predictions}
            grid={grid}
            gridMeta={gridMeta}
          />
          <BeatPrediction focal={focalJoined?.customer} />
          <BeatExplanation focal={focalJoined?.customer} topFactors={topFactors} requestSensitivity={requestSensitivity} metadata={metadata} />

          <Tooltip fixtures={fixtures} hoveredId={hoveredId} />

          {breakpoint === 'desktop' && (
            <InstrumentRail metadata={metadata} customers={fixtures.customers} layout="rail" pinned={beatIndex === 4} />
          )}
          {breakpoint === 'tablet' && (
            <InstrumentRail metadata={metadata} customers={fixtures.customers} layout="dock" pinned={beatIndex === 4} />
          )}

          {breakpoint !== 'mobile' && (
            <div style={{ position: 'absolute', left: 48, bottom: 8, right: breakpoint === 'desktop' ? 340 : 8 }}>
              <MiniThresholdRail customers={fixtures.customers} predictions={fixtures.predictions} />
            </div>
          )}
          {breakpoint === 'desktop' && (
            <div style={{ position: 'absolute', left: 16, top: 44 }}>
              <InferenceLedger />
            </div>
          )}
        </div>

        {breakpoint === 'mobile' && (
          // Sticky, pinned directly below the terrain window for the whole
          // scroll track (not normal flow) - normal flow was the bug: a
          // short static block that scrolled out of view after the first
          // screen, leaving the rest of the six-beat scroll with a blank
          // lower panel. See responsive-spec.md: "the lower 42svh is DOM
          // content scrolling under it" - the terrain is what's sticky and
          // fixed; this panel's *content* changes with beatIndex instead.
          <div
            style={{
              position: 'sticky',
              top: `${mobileTerrainSvh}svh`,
              background: 'var(--bg)',
              minHeight: `${100 - mobileTerrainSvh}svh`,
              maxHeight: `${100 - mobileTerrainSvh}svh`,
              overflowY: 'auto',
              borderTop: '1px solid var(--line)',
              zIndex: 2,
            }}
          >
            <MobileBeatPanel
              metadata={metadata}
              customers={fixtures.customers}
              predictions={fixtures.predictions}
              globalImportance={fixtures.explanations.global}
              grid={grid}
              focal={focalJoined?.customer}
              topFactors={topFactors}
            />
            <div style={{ padding: '0 16px 16px' }}>
              <MiniThresholdRail customers={fixtures.customers} predictions={fixtures.predictions} />
              <InferenceLedger compact />
            </div>
          </div>
        )}
      </div>

      <EvaluationSection fixtures={fixtures} />

      <footer style={{ padding: 24, textAlign: 'center' }}>
        <button
          type="button"
          className="t-micro"
          onClick={() => {
            try {
              sessionStorage.removeItem('predictive.introSeen')
            } catch {
              /* storage blocked */
            }
            setIntroActive(true)
          }}
          style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}
        >
          Replay intro
        </button>
      </footer>
    </main>
  )
}
