import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, DEFAULT_CUSTOMER } from './api'

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('predict() posts JSON to /api/predict with the customer payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ churn_probability: 0.42, churn_prediction: 'No' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.predict(DEFAULT_CUSTOMER)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/predict')
    expect(init.method).toBe('POST')
    expect(init.headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual(DEFAULT_CUSTOMER)
    expect(result).toEqual({ churn_probability: 0.42, churn_prediction: 'No' })
  })

  it('predict() throws a readable error on a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'tenure must be >= 0' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.predict(DEFAULT_CUSTOMER)).rejects.toThrow('422')
    await expect(api.predict(DEFAULT_CUSTOMER)).rejects.toThrow('tenure must be >= 0')
  })

  it('health() GETs /api/health', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', model_loaded: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.health()
    expect(fetchMock).toHaveBeenCalledWith('/api/health')
    expect(result.status).toBe('ok')
  })
})
