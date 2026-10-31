import { useCallback, useEffect, useState } from 'react'
import {
  fetchCurrentForAll,
  fetchForecastByModel,
  fetchIndexSources,
  type CurrentConditions,
  type IndexSeries,
  type ModelSeries,
} from '../api/openMeteo'
import type { Location } from '../data/locations'

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  updatedAt: Date | null
}

/**
 * Ejecuta `load` al montar, cuando cambian sus dependencias, cada `refreshMs`
 * y cuando se llama a `reload()`. Mantiene los datos anteriores mientras carga.
 */
function useAutoRefresh<T>(load: (signal: AbortSignal) => Promise<T>, refreshMs: number) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
    updatedAt: null,
  })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    load(controller.signal)
      .then((data) => setState({ data, error: null, loading: false, updatedAt: new Date() }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setState((s) => ({ ...s, error: message, loading: false }))
      })
    const timer = window.setTimeout(reload, refreshMs)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [load, refreshMs, tick, reload])

  return { ...state, reload }
}

const TEN_MINUTES = 10 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000

export function useCurrentForAll(locations: Location[], modelId: string) {
  const load = useCallback(
    (signal: AbortSignal) => fetchCurrentForAll(locations, modelId, signal),
    [locations, modelId],
  )
  return useAutoRefresh<Record<string, CurrentConditions>>(load, TEN_MINUTES)
}

export function useForecast(location: Location, modelIds: string[]) {
  const key = modelIds.join(',')
  const load = useCallback(
    (signal: AbortSignal) => fetchForecastByModel(location, key.split(','), signal),
    [location, key],
  )
  return useAutoRefresh<Record<string, ModelSeries>>(load, THIRTY_MINUTES)
}

export function useIndexSources(location: Location, modelIds: string[], enabled: boolean) {
  const key = modelIds.join(',')
  const load = useCallback(
    (signal: AbortSignal) =>
      enabled ? fetchIndexSources(location, key.split(','), signal) : Promise.resolve(null),
    [location, key, enabled],
  )
  return useAutoRefresh<Record<string, IndexSeries> | null>(load, THIRTY_MINUTES)
}
