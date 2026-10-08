import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ModelComparison } from './App'

describe('ModelComparison', () => {
  let container: HTMLDivElement

  afterEach(() => {
    vi.restoreAllMocks()
    container?.remove()
  })

  it('renders without crashing given mock /models/current data', async () => {
    const mockMetrics = {
      model_name: 'hist_gradient_boosting',
      metrics: {
        results: [
          { model: 'dummy', roc_auc: 0.5, pr_auc: 0.3, precision: 0.3, recall: 0.3, f1: 0.3, brier_score: 0.25 },
          { model: 'hist_gradient_boosting', roc_auc: 0.85, pr_auc: 0.6, precision: 0.7, recall: 0.65, f1: 0.67, brier_score: 0.12 },
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockMetrics }))

    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<ModelComparison />)
    })
    // flush the useEffect's api.currentModel().then(setMetrics) microtask + re-render
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('hist_gradient_boosting')
    expect(container.querySelectorAll('tbody tr').length).toBe(2)

    act(() => root.unmount())
  })
})
