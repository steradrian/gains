import { useEffect, useState } from 'react'
import { useNutrition } from './store.js'
import { noteAnswer, noteSearch, pausedFor, useOffBudget } from './off-budget.js'

const DEBOUNCE_MS = 500
export const MIN_QUERY = 2

// What Open Food Facts answered, by language and query, for the session: going to My foods and
// back, or typing a query again, shows it without spending one of the hub's 30 searches a minute.
// One cache for the food pickers and the global search.
const cache = new Map()
const keyOf = (q, lang, country) => `${lang}|${country || ''}|${q.trim().toLowerCase()}`

/** Forgets the answers (tests). */
export const clearOnlineSearchCache = () => cache.clear()

/** The answer this session already has for the query, or undefined. */
export const cachedOnline = (q, { lang = 'en', country = null } = {}) => cache.get(keyOf(q, lang, country))

/** One Open Food Facts search, counted against the budget (off-budget.js) and kept in the cache.
 *  `kind` is 'auto' for a search nobody asked for by name (typing), 'tap' for one they did.
 *  Throws an NtError ('aborted' once `signal` aborts). */
export async function fetchOnline(q, { lang = 'en', country = null, signal, kind = 'auto' } = {}) {
  const key = keyOf(q, lang, country)
  if (cache.has(key)) return cache.get(key)
  noteSearch(kind)
  const results = await useNutrition.getState().searchOnline(q.trim(), lang, { signal, country, onResponse: res => noteAnswer(res) })
  cache.set(key, results)
  return results
}

// Open Food Facts results for what is typed, once typing pauses. Nothing is asked for a query
// under MIN_QUERY characters, while the search is off, or for one already answered this session.
// A newer query aborts the one in flight; an aborted search is not an error, and an answer to a
// query no longer typed never shows. While the hub has paused every search (a 429, off-budget.js,
// whoever ran into it) nothing is asked: the status is 'paused' with the `seconds` left, and the
// query is asked once the pause is over.
// status: 'idle' | 'loading' | 'ready' | 'error' | 'paused'
export function useOnlineSearch(query, { active, lang, country = null }) {
  const q = query.trim()
  const [state, setState] = useState({ status: 'idle', query: '', results: [], error: null })
  const pausedUntil = useOffBudget(s => s.pausedUntil)
  const [now, setNow] = useState(() => Date.now())
  const paused = pausedUntil > now

  // The countdown ticks while a pause lasts, and its end asks again.
  useEffect(() => {
    setNow(Date.now())
    const left = pausedUntil - Date.now()
    if (left <= 0) return undefined
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const end = setTimeout(() => { clearInterval(tick); setNow(Date.now()) }, left)
    return () => { clearInterval(tick); clearTimeout(end) }
  }, [pausedUntil])

  useEffect(() => {
    if (!active || q.length < MIN_QUERY) {
      setState({ status: 'idle', query: '', results: [], error: null })
      return undefined
    }
    const hit = cachedOnline(q, { lang, country })
    if (hit) {
      setState({ status: 'ready', query: q, results: hit, error: null })
      return undefined
    }
    if (paused) {
      setState({ status: 'paused', query: q, results: [], error: null })
      return undefined
    }
    const ctl = new AbortController()
    setState(s => ({ ...s, status: 'loading', query: q, error: null }))
    const timer = setTimeout(async () => {
      try {
        const results = await fetchOnline(q, { lang, country, signal: ctl.signal })
        if (!ctl.signal.aborted) setState({ status: 'ready', query: q, results, error: null })
      } catch (e) {
        if (e?.code === 'aborted' || ctl.signal.aborted) return
        setState({ status: Date.now() < useOffBudget.getState().pausedUntil ? 'paused' : 'error', query: q, results: [], error: e })
      }
    }, DEBOUNCE_MS)
    return () => { clearTimeout(timer); ctl.abort() }
  }, [active, q, lang, country, paused])

  return { ...state, seconds: pausedFor(now) }
}
