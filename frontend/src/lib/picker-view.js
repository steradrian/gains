// The exercise picker's view state and the list it leads to. The state lives in a small store
// rather than in the picker's own useState because the Filters sub-panel is a sibling of the
// picker inside the same drawer (components/sheet-panes.jsx), rendered from the sheet stack: it
// reads and writes the same view and shows the same result count.
import { useSyncExternalStore } from 'react'
import { EXIDX, allExercises, byCategory, equipmentOf, searchExercises } from './exercises.js'
import { activeProfile, exAvailable } from './equipment.js'
import { exerciseNameFor } from './i18n.js'
import { exercisesForMuscle } from './muscle-explore.js'
import { sameMuscleFirst, swapMuscleOf } from './similar-exercises.js'
import { favIds, isFav, sortFavouritesFirst, sortYoursFirst, usageOf } from './favourites.js'

export const SAME = '≈'
export const RECENT_LIMIT = 20

export function createPickerView(initial = {}) {
  let view = { q: '', tab: 'all', bp: '', cat: '', eq: '', muscle: null, chosen: false, showAll: false, ...initial }
  const listeners = new Set()
  return {
    get: () => view,
    set: patch => { view = { ...view, ...patch }; listeners.forEach(l => l()) },
    subscribe: l => { listeners.add(l); return () => listeners.delete(l) },
  }
}

export const usePickerView = store => useSyncExternalStore(store.subscribe, store.get)

/** Exercises logged most recently first, each once: the "recently used" half of Favourites. */
export function recentExerciseIds(S, limit = RECENT_LIMIT) {
  const done = [...(S?.workouts || [])].sort((a, b) => String(b.d || '').localeCompare(String(a.d || '')) || (b.end || 0) - (a.end || 0))
  const seen = new Set()
  for (const w of done) {
    for (const e of w.entries || []) {
      if (seen.size >= limit) return [...seen]
      seen.add(e.id)
    }
  }
  return [...seen]
}

/**
 * What the list is built from. `like` is the exercise a swap is away from: likeTg is the muscle the
 * "same muscle" choice stands for, empty when nothing else trains it (so no choice that lists nothing).
 */
export function pickerContext(S, like) {
  const all = allExercises(S)
  const likeEx = like ? (EXIDX[like] || all.find(e => e.id === like) || null) : null
  const likeTg = swapMuscleOf(likeEx) && sameMuscleFirst(all, likeEx).length ? swapMuscleOf(likeEx) : ''
  return { all, usage: usageOf(S), profile: activeProfile(S), likeEx, likeTg }
}

/** How many of the Filters panel's groups are set: body part, type, equipment. */
export const activeFilterCount = ({ bp, catOn, eqOn }) => (bp ? 1 : 0) + (catOn ? 1 : 0) + (eqOn ? 1 : 0)

/**
 * Everything the picker and its Filters panel show for `view`. `ctx` is `{ all, usage, profile, likeEx }`
 * (the catalogue, how often each exercise is used, the active equipment profile, the swap's source
 * exercise). Body part applies on All and Favourites ("same muscle" on All only); type and equipment
 * on every tab; the Chosen toggle on All.
 */
export function pickerList(S, view, ctx) {
  const { all, usage, profile, likeEx } = ctx
  const { q, tab, cat, eq, muscle, chosen, showAll } = view
  const bp = tab === 'muscle' || (tab === 'fav' && view.bp === SAME) ? '' : view.bp
  let inPart
  if (tab === 'muscle') inPart = muscle ? exercisesForMuscle(all, muscle) : []
  else if (tab === 'fav') {
    const byId = new Map(all.map(e => [e.id, e]))
    const starred = all.filter(e => isFav(S, e.id))
    const favSet = new Set(favIds(S))
    const recent = recentExerciseIds(S).filter(id => !favSet.has(id)).map(id => byId.get(id)).filter(Boolean)
    inPart = [...starred, ...recent].filter(e => !bp || e.bp === bp)
  } else if (bp === SAME) inPart = sameMuscleFirst(all, likeEx)
  else inPart = all.filter(e => !bp || e.bp === bp)
  if (tab === 'all' && chosen) inPart = inPart.filter(e => usage[e.id])
  inPart = searchExercises(inPart, q)
  if (tab === 'all' && chosen) inPart = [...inPart].sort((a, b) => (usage[b.id] - usage[a.id]) || exerciseNameFor(a).localeCompare(exerciseNameFor(b)))
  // The Library's Type row (issue #521), with its fallback: a type the search or muscle group
  // narrowed away is ignored for this view, not forgotten.
  const { opts: catOpts, on: catOn, list: base } = byCategory(inPart, cat)
  const eqFiltered = (profile && !showAll) ? base.filter(e => exAvailable(S, e)) : base
  const eqOpts = equipmentOf(eqFiltered)
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const narrowed = eqOn ? eqFiltered.filter(e => e.eq === eqOn) : eqFiltered
  // Favourites float to the top (issue #6); while searching, what you have logged or planned follows.
  // On Favourites the starred ones lead and the recents keep their recency order after them.
  // On the same-muscle list the equipment order wins: what is on the same kit comes first.
  const ranked = q.trim() ? sortYoursFirst(narrowed, S, usage) : sortFavouritesFirst(narrowed, S)
  const list = bp === SAME ? sameMuscleFirst(ranked, likeEx) : ranked
  return { list, catOpts, catOn, eqOpts, eqOn, bp, special: tab === 'fav' || (tab === 'all' && chosen) }
}
