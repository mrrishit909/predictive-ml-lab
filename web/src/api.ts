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

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${JSON.stringify(body.detail ?? body)}`)
  }
  return res.json()
}

export const api = {
  health: () => fetch(`${BASE}/health`).then((r) => j<{ status: string; model_loaded: boolean }>(r)),
  currentModel: () => fetch(`${BASE}/models/current`).then((r) => j<any>(r)),
  predict: (customer: CustomerFeatures) =>
    fetch(`${BASE}/predict`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(customer) }).then((r) => j<any>(r)),
  explainLocal: (customer: CustomerFeatures) =>
    fetch(`${BASE}/explain/local`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(customer) }).then((r) => j<any>(r)),
  explainGlobal: () => fetch(`${BASE}/explain/global`).then((r) => j<any[]>(r)),
  drift: (days = 30) => fetch(`${BASE}/drift?days=${days}`).then((r) => j<any[]>(r)),
}
