import { useEffect, useState } from 'react'
import { loadModel, predictChurnProbability, getThreshold, type CustomerFeatures } from './inference/churnModel'

const SAMPLE: CustomerFeatures = {
  gender: 'Female', SeniorCitizen: '0', Partner: 'Yes', Dependents: 'No',
  tenure: 12, PhoneService: 'Yes', MultipleLines: 'No', InternetService: 'DSL',
  OnlineSecurity: 'No', OnlineBackup: 'Yes', DeviceProtection: 'No', TechSupport: 'No',
  StreamingTV: 'No', StreamingMovies: 'No', Contract: 'Month-to-month',
  PaperlessBilling: 'Yes', PaymentMethod: 'Electronic check',
  MonthlyCharges: 70.5, TotalCharges: 840.0,
}

export default function App() {
  const [status, setStatus] = useState('loading model...')
  const [proba, setProba] = useState<number | null>(null)

  useEffect(() => {
    loadModel()
      .then(() => {
        setStatus('model loaded, running inference...')
        return predictChurnProbability(SAMPLE)
      })
      .then((p) => {
        setProba(p)
        setStatus('done')
      })
      .catch((e) => setStatus('ERROR: ' + e.message))
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', background: '#0B1110', color: '#F0F3EB', minHeight: '100vh' }}>
      <h1>ONNX smoke test</h1>
      <p>status: {status}</p>
      {proba !== null && (
        <>
          <p>churn probability: {(proba * 100).toFixed(2)}%</p>
          <p>expected (Python): 30.29%</p>
          <p>threshold: {getThreshold()}</p>
        </>
      )}
    </div>
  )
}
