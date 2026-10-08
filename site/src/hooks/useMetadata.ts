import { useEffect, useState } from 'react'
import { loadMetadata, type ModelMetadata } from '../data/fixtures'

export function useMetadata(): ModelMetadata | null {
  const [meta, setMeta] = useState<ModelMetadata | null>(null)
  useEffect(() => {
    loadMetadata().then(setMeta)
  }, [])
  return meta
}
