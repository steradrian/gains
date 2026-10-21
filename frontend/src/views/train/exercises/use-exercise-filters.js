import { useDeferredValue, useMemo, useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { byCategory, equipmentOf, exOr, searchExercises, similarExercises } from '../../../lib/exercises.js'
import { activeProfile } from '../../../lib/equipment.js'
import { workoutAt } from '../../../lib/history.js'
import { isFav, sortFavouritesFirst, sortYoursFirst, usageOf } from '../../../lib/favourites.js'
import { exerciseNameFor, getLang, useLang } from '../../../lib/i18n.js'
import { exercisesForMuscle, muscleCatalog } from '../../../lib/muscle-explore.js'
import { useAutoMore } from '../../../lib/use-auto-more.js'

const PAGE = 40
// The equipment choice's two values that are not a kind of equipment: "what you have in the active
// profile" (the default while one is on) and "any equipment".
export const EQUIP_PROFILE = '@profile'
export const EQUIP_ANY = '@any'

// How often and how lately each exercise was logged: id -> { n, last }.
function loggedOf(workouts) {
  const out = {}
  for (const w of workouts || []) {
    const at = workoutAt(w) || 0
    for (const e of w.entries || []) {
      const o = out[e.id] || (out[e.id] = { n: 0, last: 0 })
      o.n++
      if (at > o.last) o.last = at
    }
  }
  return out
}

/**
 * The search and filters of the Exercises page (no `muscle`) and of By muscle (`muscle`, a
 * muscles.js slug): search, body part, equipment, type, favourites, and the equipment profile.
 * The catalogue stays in A to Z; a search ranks by relevance, yours first.
 *
 * Returns the choices (`q`, `bp`, `eq`, `cat`, `favOnly`, `showAll`) with their setters, the
 * options the list left (`eqOpts`, `catOpts`), `favCount`, and the rows: `logged` (exercises you
 * have logged, most-trained first, only while not searching), `visible` (the rest, a page at a
 * time, favourites first) and `similar` (close matches, once a search has run out). `more` shows the
 * next page and `moreRef` loads it by itself as the button nears the screen.
 */
export function useExerciseFilters({ muscle = null } = {}) {
  const S = useStore(s => s.S)
  const lang = useLang()
  const [q, setQState] = useState('')
  const [bp, setBpState] = useState('')
  const [eq, setEqState] = useState('')
  const [cat, setCatState] = useState('')
  const [favOnly, setFavOnlyState] = useState(false)
  const [showAll, setShowAllState] = useState(false)   // ignore the active equipment profile for this session
  const [shown, setShown] = useState(PAGE)
  // Another muscle starts its own list: the equipment choice and the paging do not carry over.
  const [seen, setSeen] = useState(muscle)
  if (seen !== muscle) { setSeen(muscle); setEqState(''); setShown(PAGE) }

  const reset = set => v => { set(v); setShown(PAGE) }
  const setQ = reset(setQState)
  const setCat = reset(setCatState)
  const setEq = reset(setEqState)
  // Changing body part keeps the equipment filter (issue #71): the fallback below drops it only for
  // the current view if the new body part has nothing under it, without forgetting the choice.
  // "All" clears it, since it spans every body part.
  const setBp = v => { setBpState(v); if (!v) setEqState(''); setShown(PAGE) }
  const setFavOnly = v => { setFavOnlyState(v); setShown(PAGE) }
  const setShowAll = v => { setShowAllState(v); setEqState(''); setShown(PAGE) }
  const moreRef = useAutoMore(() => setShown(n => n + PAGE))

  const profile = activeProfile(S)
  const sorted = useMemo(() => {
    const collator = new Intl.Collator(getLang())
    const keyed = muscleCatalog(S, showAll).map(e => ({ e, key: exerciseNameFor(e) }))
    return keyed.sort((a, b) => collator.compare(a.key, b.key)).map(k => k.e)
  }, [S.customEx, S.equipFilterOn, S.activeEquipId, S.equipProfiles, showAll, lang])
  const scoped = useMemo(() => (muscle ? exercisesForMuscle(sorted, muscle) : sorted), [sorted, muscle])
  const inPart = useMemo(() => (bp ? scoped.filter(e => e.bp === bp) : scoped), [scoped, bp])
  const matched = useMemo(() => searchExercises(inPart, q), [inPart, q])

  // Kind of exercise (strength, stretching, cardio...), and equipment after it: a choice the search or
  // body part has narrowed away is ignored for now, never a dead end.
  const { opts: catOpts, on: catOn, list: byType } = byCategory(matched, cat)
  const eqOpts = equipmentOf(byType)
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const byEq = eqOn ? byType.filter(e => e.eq === eqOn) : byType
  const favCount = byEq.filter(e => isFav(S, e.id)).length
  const list = favOnly ? byEq.filter(e => isFav(S, e.id)) : byEq

  const searching = !!q.trim()
  const logs = useMemo(() => loggedOf(S.workouts), [S.workouts])
  const loggedCount = useMemo(() => Object.keys(logs).filter(id => !exOr(id).missing).length, [logs])
  const usage = useMemo(() => (searching ? usageOf(S) : null), [searching, S.routines, S.workouts])
  const { logged, rest } = useMemo(() => {
    // Searching ranks by relevance, favourites and what you have logged or planned first.
    if (searching) return { logged: [], rest: sortYoursFirst(list, S, usage) }
    const mine = list.filter(e => logs[e.id])
      .sort((a, b) => logs[b.id].n - logs[a.id].n || logs[b.id].last - logs[a.id].last)
    return { logged: mine, rest: sortFavouritesFirst(list.filter(e => !logs[e.id]), S) }
  }, [list, searching, logs, usage, S.favEx])

  // Close but not exact (a typo too many, most of the words, a similar name), under the results once
  // they are all on screen, so a search almost never ends on "No match". Worked out a beat behind the
  // typing (useDeferredValue): the list itself never waits for it.
  const qLate = useDeferredValue(q)
  const similar = searching && qLate === q && rest.length <= shown
    ? similarExercises(inPart, q, rest, rest.length ? 12 : 30)
    : []

  return {
    q, setQ, bp, setBp, cat: catOn, setCat, eq: eqOn, setEq, favOnly, setFavOnly, showAll, setShowAll,
    profile, eqOpts, catOpts, favCount,
    // What the equipment choice reads as: a kind, the profile (while it filters), or anything.
    equipChoice: eqOn || (profile && !showAll ? EQUIP_PROFILE : EQUIP_ANY),
    chooseEquipment: v => {
      if (v === EQUIP_PROFILE) { setShowAllState(false); setEq('') }
      else if (v === EQUIP_ANY) { setShowAllState(true); setEq('') }
      else setEq(v)
    },
    searching, narrowed: searching || !!(bp || eqOn || catOn || favOnly),
    total: logged.length + rest.length, muscleTotal: scoped.length, loggedCount,
    logged, visible: rest.slice(0, shown), hasMore: rest.length > shown, similar,
    more: () => setShown(n => n + PAGE), moreRef,
  }
}
