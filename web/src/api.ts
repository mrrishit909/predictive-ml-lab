export interface CustomerFeatures {
  gender: string
  SeniorCitizen: string
  Partner: string
  Dependents: string
  tenure: number
  PhoneService: string
  MultipleLines: string
  InternetService: string
  OnlineSecurity: string
  OnlineBackup: string
  DeviceProtection: string
  TechSupport: string
  StreamingTV: string
  StreamingMovies: string
  Contract: string
  PaperlessBilling: string
  PaymentMethod: string
  MonthlyCharges: number
  TotalCharges: number
}

export const DEFAULT_CUSTOMER: CustomerFeatures = {
  gender: 'Female', SeniorCitizen: '0', Partner: 'Yes', Dependents: 'No',
  tenure: 12, PhoneService: 'Yes', MultipleLines: 'No', InternetService: 'DSL',
  OnlineSecurity: 'No', OnlineBackup: 'Yes', DeviceProtection: 'No', TechSupport: 'No',
  StreamingTV: 'No', StreamingMovies: 'No', Contract: 'Month-to-month',
  PaperlessBilling: 'Yes', PaymentMethod: 'Electronic check',
  MonthlyCharges: 70.5, TotalCharges: 840.0,
}

const BASE = '/api'

// POST /predict and /predict/batch now require X-API-Key (see api/main.py's
// predict_guard). VITE_API_KEY lets each deployment inject its own real key
// at build time; the fallback matches docker-compose.yml's documented local
// dev default so `npm run dev` + `docker compose up` work together out of
// the box without any manual config.
const API_KEY = import.meta.env.VITE_API_KEY ?? 'local-dev-placeholder-key'

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${JSON.stringify(body.detail ?? body)}`)
  }
  return res.json()
}

function authedPost(path: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(body),
  })
}

export const api = {
  health: () => fetch(`${BASE}/health`).then((r) => j<{ status: string; model_loaded: boolean }>(r)),
  currentModel: () => fetch(`${BASE}/models/current`).then((r) => j<any>(r)),
  predict: (customer: CustomerFeatures) => authedPost('/predict', customer).then((r) => j<any>(r)),
  explainLocal: (customer: CustomerFeatures) => authedPost('/explain/local', customer).then((r) => j<any>(r)),
  explainGlobal: () => fetch(`${BASE}/explain/global`).then((r) => j<any[]>(r)),
  drift: (days = 30) => fetch(`${BASE}/drift?days=${days}`).then((r) => j<any[]>(r)),
}
