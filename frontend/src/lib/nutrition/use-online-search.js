import { useEffect, useState } from 'react'
import { useNutrition } from './store.js'

const DEBOUNCE_MS = 500
export const MIN_QUERY = 2

// Open Food Facts results for what is typed, once typing pauses. The hub lets 30 searches a
// minute by, so nothing is asked for a query under MIN_QUERY characters or while the search is
// off. A newer query aborts the one in flight; an aborted search is not an error.
// status: 'idle' | 'loading' | 'ready' | 'error'
export function useOnlineSearch(query, { active, lang }) {
  const q = query.trim()
  const [state, setState] = useState({ status: 'idle', query: '', results: [], error: null })

  useEffect(() => {
    if (!active || q.length < MIN_QUERY) {
      setState({ status: 'idle', query: '', results: [], error: null })
      return undefined
    }
    const ctl = new AbortController()
    setState(s => ({ ...s, status: 'loading', query: q, error: null }))
    const timer = setTimeout(async () => {
      try {
        const results = await useNutrition.getState().searchOnline(q, lang, { signal: ctl.signal })
        if (!ctl.signal.aborted) setState({ status: 'ready', query: q, results, error: null })
      } catch (e) {
        if (e?.code !== 'aborted' && !ctl.signal.aborted) setState({ status: 'error', query: q, results: [], error: e })
      }
    }, DEBOUNCE_MS)
    return () => { clearTimeout(timer); ctl.abort() }
  }, [active, q, lang])

  return state
}
