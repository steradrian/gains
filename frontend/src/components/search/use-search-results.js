import { useEffect, useMemo } from 'react'
import { listAll, scopedSections, scopedSummary, searchLocal, summaryOf } from '../../lib/search/results.js'
import { exerciseMiss, noneActions, noneHeading } from '../../lib/search/none.js'
import { markSearched } from '../../lib/search/recents.js'
import { onlineRowState, useOnlineResults } from './use-online-results.js'

/**
 * Everything the search shows once something is typed (boards Sh0Results, Sh0Scoped, Sh0None,
 * Sh0TurnOn, Sh0NoExercise), worked out from the overlay's data (use-search-data.js).
 *   query     what the lists are worked out for (the field's text, deferred); `live` the field's
 *             text as typed (nothing matches is said only once they agree); `settled` the text
 *             once typing has paused (Online asks for that one)
 *   group     the kind the search is scoped to, or null; `tab` the tab it was opened on
 * Returns:
 *   local      searchLocal's { groups, best, order, words, date }
 *   online     useOnlineResults's { status, rows, seconds, ask, retry }; `onlineRow` the stage
 *              row's state (onlineRowState)
 *   rowsOf(g)  a group's rows, Online's included
 *   counts     [{ group, count, text, emphasized }]: the count chips, the best match counted in
 *   total      every result, Online's included
 *   pending    a slow source is still out (Online, the diary index on its first sync)
 *   noResults  something typed and settled, and nothing found locally (the diary's days in) nor
 *              online: Open Food Facts still out, failed or paused does not hold it back
 *   none       { mode: 'exercise' | 'any', heading: { title, body }, actions } (lib/search/none.js)
 *              when nothing matches, or when an exercise search found no exercise (`exerciseMiss`,
 *              mode 'exercise'); else null
 *   scoped     { rows, sections, summary } for the scoped group, or null
 * A query that settles is a search run: it ends the first use (recents.js markSearched).
 */
export function useSearchResults({ query, live = query, settled, group, tab, data }) {
  const local = useMemo(() => searchLocal(query, data, tab), [query, data, tab])
  const hasQuery = query.trim().length > 0
  const ownCount = local.groups.foods.length + (local.best?.group === 'foods' ? 1 : 0)
  const online = useOnlineResults({ query: settled, words: local.words, tab, group, ownCount, nutrition: data.nutrition, open: true })

  useEffect(() => { if (settled.trim()) markSearched() }, [settled])

  const rowsOf = g => (g === 'online' ? online.rows : local.groups[g] || [])
  const counts = summaryOf(local.groups, local.order, { online: online.rows.length, ...(local.best ? { [local.best.group]: 1 } : {}) })
  const total = counts.reduce((n, e) => n + e.count, 0)
  const idx = data.index
  const daysPending = data.nutrition && !local.groups.days.length && !idx.complete && !data.days.length
  const pending = online.status === 'loading' || online.status === 'waiting' || daysPending
  // Nothing matches is the local search's verdict once the field has settled: Open Food Facts
  // never holds it back. Its state (searching, failed, paused, ask on a tap) is a row among the
  // ways on (SearchPanel); only rows it has found turn it into results.
  const localTotal = total - online.rows.length
  const noResults = hasQuery && query === live && settled.trim() === live.trim() && localTotal === 0 && !daysPending && !online.rows.length
  const miss = exerciseMiss({ query, tab, group, local })

  const none = useMemo(() => {
    if (!noResults && !miss) return null
    const mode = miss ? 'exercise' : 'any'
    return { mode, heading: noneHeading(query, mode), actions: noneActions({ query, data, mode, onlineStatus: online.status }) }
  }, [noResults, miss, query, data, online.status])

  const scoped = useMemo(() => {
    if (!group) return null
    const rows = !hasQuery ? listAll(group, data)
      : local.best?.group === group ? [local.best.result, ...rowsOf(group)] : rowsOf(group)
    return { rows, sections: scopedSections(group, rows, data.today), summary: scopedSummary(group, rows.length, query) }
  }, [group, hasQuery, data, local, online.rows, query]) // eslint-disable-line react-hooks/exhaustive-deps

  return { local, online, onlineRow: onlineRowState(online.status), rowsOf, counts, total, pending, noResults, none, scoped }
}
