import { useEffect, useState } from 'react'
import { api, DEFAULT_CUSTOMER, type CustomerFeatures } from './api'
import Intro from './Intro'

type Tab = 'predict' | 'explain' | 'compare' | 'drift'

const ENUM_OPTIONS: Record<string, string[]> = {
  gender: ['Female', 'Male'],
  SeniorCitizen: ['0', '1'],
  Partner: ['Yes', 'No'],
  Dependents: ['Yes', 'No'],
  PhoneService: ['Yes', 'No'],
  MultipleLines: ['Yes', 'No', 'No phone service'],
  InternetService: ['DSL', 'Fiber optic', 'No'],
  OnlineSecurity: ['Yes', 'No', 'No internet service'],
  OnlineBackup: ['Yes', 'No', 'No internet service'],
  DeviceProtection: ['Yes', 'No', 'No internet service'],
  TechSupport: ['Yes', 'No', 'No internet service'],
  StreamingTV: ['Yes', 'No', 'No internet service'],
  StreamingMovies: ['Yes', 'No', 'No internet service'],
  Contract: ['Month-to-month', 'One year', 'Two year'],
  PaperlessBilling: ['Yes', 'No'],
  PaymentMethod: ['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)'],
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[#F0F3EB]/70">{label}</span>
      {children}
    </label>
  )
}

const selectClass = "bg-[#0B1110] border border-[#B5FFCE]/30 rounded px-2 py-1.5 text-[#F0F3EB] focus:border-[#B5FFCE] outline-none"
const inputClass = selectClass

function PredictionStudio() {
  const [customer, setCustomer] = useState<CustomerFeatures>(DEFAULT_CUSTOMER)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      setResult(await api.predict(customer))
    } catch (e: any) {
      setError(e.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function set<K extends keyof CustomerFeatures>(key: K, value: CustomerFeatures[K]) {
    setCustomer((c) => ({ ...c, [key]: value }))
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(ENUM_OPTIONS) as (keyof CustomerFeatures)[]).map((key) => (
          <Field key={key} label={key}>
            <select className={selectClass} value={customer[key] as string} onChange={(e) => set(key, e.target.value as any)}>
              {ENUM_OPTIONS[key].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </Field>
        ))}
        <Field label="tenure (months)">
          <input className={inputClass} type="number" min={0} max={100} value={customer.tenure}
            onChange={(e) => set('tenure', Number(e.target.value))} />
        </Field>
        <Field label="MonthlyCharges">
          <input className={inputClass} type="number" min={0} max={500} step={0.1} value={customer.MonthlyCharges}
            onChange={(e) => set('MonthlyCharges', Number(e.target.value))} />
        </Field>
        <Field label="TotalCharges">
          <input className={inputClass} type="number" min={0} max={20000} step={0.1} value={customer.TotalCharges}
            onChange={(e) => set('TotalCharges', Number(e.target.value))} />
        </Field>
        <button onClick={run} disabled={loading}
          className="col-span-2 mt-2 bg-[#B5FFCE] text-[#0B1110] font-semibold rounded py-2 hover:bg-[#FF866D] transition-colors disabled:opacity-50">
          {loading ? 'Scoring…' : 'Predict churn'}
        </button>
      </div>

      <div className="rounded-lg border border-[#B5FFCE]/20 p-6 flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Result</h3>
        {error && <p className="text-[#FF866D]">Error: {error}</p>}
        {!result && !error && <p className="text-[#F0F3EB]/50">Fill the form and click Predict.</p>}
        {result && (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold" style={{ color: result.churn_prediction === 'Yes' ? '#FF866D' : '#B5FFCE' }}>
                {(result.churn_probability * 100).toFixed(1)}%
              </span>
              <span className="text-[#F0F3EB]/70">probability of churn</span>
            </div>
            <p>Prediction: <strong>{result.churn_prediction}</strong></p>
            <p className="text-sm text-[#F0F3EB]/50">model: {result.model_name} · version {result.model_version}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Explainability() {
  const [customer] = useState<CustomerFeatures>(DEFAULT_CUSTOMER)
  const [global, setGlobal] = useState<any[]>([])
  const [local, setLocal] = useState<any>(null)

  useEffect(() => {
    api.explainGlobal().then(setGlobal)
    api.explainLocal(customer).then(setLocal)
  }, [])

  const maxGlobal = Math.max(...global.map((g) => g.mean_abs_impact), 0.0001)

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Global feature importance (SHAP, from training)</h3>
        <div className="flex flex-col gap-2">
          {global.slice(0, 12).map((g) => (
            <div key={g.feature} className="flex items-center gap-2 text-sm">
              <span className="w-40 truncate text-[#F0F3EB]/70">{g.feature}</span>
              <div className="flex-1 bg-[#B5FFCE]/10 rounded h-3">
                <div className="bg-[#B5FFCE] h-3 rounded" style={{ width: `${(g.mean_abs_impact / maxGlobal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Local explanation (default customer, perturbation-based)</h3>
        {local && (
          <div className="flex flex-col gap-2">
            {local.top_factors.map((f: any) => (
              <div key={f.feature} className="flex items-center gap-2 text-sm">
                <span className="w-40 truncate text-[#F0F3EB]/70">{f.feature}</span>
                <div className="flex-1 bg-[#F0F3EB]/10 rounded h-3 relative">
                  <div
                    className="h-3 rounded absolute"
                    style={{
                      background: f.impact >= 0 ? '#FF866D' : '#B5FFCE',
                      width: `${Math.min(100, Math.abs(f.impact) * 400)}%`,
                      left: f.impact >= 0 ? '50%' : undefined,
                      right: f.impact < 0 ? '50%' : undefined,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[#F0F3EB]/40 mt-4">
          Local view is a perturbation approximation (feature set to its mean/mode, probability delta measured), not
          exact SHAP, to keep inference latency low. Global panel on the left uses exact training-time SHAP values.
        </p>
      </div>
    </div>
  )
}

export function ModelComparison() {
  const [metrics, setMetrics] = useState<any>(null)
  useEffect(() => { api.currentModel().then(setMetrics) }, [])
  if (!metrics) return <p>Loading…</p>
  const rows = metrics.metrics.results
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm text-[#F0F3EB]/60">Selected model: <strong>{metrics.model_name}</strong> (best non-dummy ROC-AUC, then isotonic-calibrated)</p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#B5FFCE]/30 text-left">
            {['model', 'roc_auc', 'pr_auc', 'precision', 'recall', 'f1', 'brier_score'].map((h) => (
              <th key={h} className="py-2 pr-4 text-[#F0F3EB]/70">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.model} className="border-b border-[#B5FFCE]/10">
              <td className="py-2 pr-4 font-mono">{r.model}</td>
              <td className="py-2 pr-4">{r.roc_auc.toFixed(3)}</td>
              <td className="py-2 pr-4">{r.pr_auc.toFixed(3)}</td>
              <td className="py-2 pr-4">{r.precision.toFixed(3)}</td>
              <td className="py-2 pr-4">{r.recall.toFixed(3)}</td>
              <td className="py-2 pr-4">{r.f1.toFixed(3)}</td>
              <td className="py-2 pr-4">{r.brier_score.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DriftDashboard() {
  const [points, setPoints] = useState<any[]>([])
  useEffect(() => { api.drift(30).then(setPoints) }, [])
  const maxRate = Math.max(...points.map((p) => p.predicted_churn_rate), 0.01)
  return (
    <div>
      <p className="mb-4 text-sm text-[#F0F3EB]/60 bg-[#FF866D]/10 border border-[#FF866D]/30 rounded px-3 py-2">
        Synthetic drift simulation, a deterministic generator shifts a fake customer population's tenure/charges over
        30 simulated days. This is NOT live production telemetry; no real traffic flows through this chart.
      </p>
      <svg viewBox="0 0 600 200" className="w-full h-48">
        <polyline
          fill="none"
          stroke="#B5FFCE"
          strokeWidth="2"
          points={points.map((p, i) => `${(i / Math.max(points.length - 1, 1)) * 600},${200 - (p.predicted_churn_rate / maxRate) * 180}`).join(' ')}
        />
        {points.filter((p) => p.drift_flag).map((p, i) => (
          <circle key={i} cx={(p.day / Math.max(points.length - 1, 1)) * 600} cy={200 - (p.predicted_churn_rate / maxRate) * 180} r={4} fill="#FF866D" />
        ))}
      </svg>
      <p className="text-xs text-[#F0F3EB]/40 mt-2">Coral dots mark days where predicted churn rate moved &gt;15% relative to day 0.</p>
    </div>
  )
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [tab, setTab] = useState<Tab>('predict')

  return (
    <div className="min-h-screen">
      {showIntro && <Intro onDone={() => setShowIntro(false)} />}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">PREDICTIVE</h1>
          <p className="text-[#F0F3EB]/60">Telecom churn prediction lab, real scikit-learn model, real evaluation, no fabricated metrics.</p>
        </header>
        <nav className="flex gap-4 border-b border-[#B5FFCE]/20 mb-8">
          {(['predict', 'explain', 'compare', 'drift'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 px-1 capitalize border-b-2 transition-colors ${tab === t ? 'border-[#B5FFCE] text-[#B5FFCE]' : 'border-transparent text-[#F0F3EB]/50 hover:text-[#F0F3EB]'}`}>
              {t === 'predict' ? 'Prediction studio' : t === 'explain' ? 'Explainability' : t === 'compare' ? 'Model comparison' : 'Drift monitor'}
            </button>
          ))}
        </nav>
        {tab === 'predict' && <PredictionStudio />}
        {tab === 'explain' && <Explainability />}
        {tab === 'compare' && <ModelComparison />}
        {tab === 'drift' && <DriftDashboard />}
      </div>
    </div>
  )
}
