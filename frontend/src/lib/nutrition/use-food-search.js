import { useEffect, useMemo } from 'react'
import { ownFoodWith } from './barcode.js'
import { matchesFood, recentFoods } from './diary.js'
import { useNutrition } from './store.js'
import { MIN_QUERY, useOnlineSearch } from './use-online-search.js'

export const OWN_MAX = 20

const byName = (a, b) => String(a.name).localeCompare(String(b.name))

/**
 * What the food pickers show for what is typed: the one search every place that picks a food uses.
 *   recents  your foods by last use (no query only)
 *   own      your foods: matching the query, or (no query) the rest of them A to Z
 *   online   Open Food Facts, Romanian products first (off.js): { status, results, error }, where
 *            status is 'idle' (nothing asked: the query is under two characters) | 'loading' |
 *            'ready' | 'error'. A product you already saved (same barcode) is left out.
 *   foods    the store's foods ({ status, list, error }), for the loading and error notes
 * Loads your foods once. Results come back as the unsaved foods they are: save one before using
 * it anywhere that needs an id (its `client_key` makes a retried save one food, not two).
 */
export function useFoodSearch(query) {
  const foods = useNutrition(s => s.foods)
  const lang = useNutrition(s => s.settings.data?.offSearchLanguage)
  const q = query.trim()
  const online = useOnlineSearch(query, { active: true, lang: typeof lang === 'string' ? lang : 'en' })

  useEffect(() => { useNutrition.getState().loadFoods() }, [])

  const recents = useMemo(() => (q ? [] : recentFoods(foods.list)), [foods.list, q])
  const own = useMemo(() => {
    if (q) return foods.list.filter(f => matchesFood(f, q)).slice(0, OWN_MAX)
    const recent = new Set(recents.map(f => f.id))
    return foods.list.filter(f => !recent.has(f.id)).sort(byName).slice(0, OWN_MAX)
  }, [foods.list, recents, q])

  // The render after typing still holds the answer to the previous query: not an answer yet.
  const status = q.length < MIN_QUERY ? 'idle' : online.query !== q ? 'loading' : online.status
  const results = useMemo(
    () => (status === 'ready' ? online.results.filter(r => !r.barcode || !ownFoodWith(foods.list, r.barcode)) : []),
    [status, online.results, foods.list],
  )

  return { query: q, recents, own, online: { status, results, error: online.error }, foods }
}
