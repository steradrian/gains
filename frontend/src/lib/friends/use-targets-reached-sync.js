import { useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { useFoodHistory } from '../../views/eat/use-food-history.js'
import { plusDays } from '../missed-day.js'
import { useToday } from '../nutrition/use-freshness.js'
import { friendsAvailable } from './api.js'
import { TARGETS_DAYS, computeTargetsReached } from './targets-reached.js'
import { useFriendsMe } from './use-friends.js'

// Keeps S.targetsReached (lib/friends/targets-reached.js) true to the diary, and only while the
// person has Friends on and the food-targets switch on: that is the only reason the server may
// ever read it. Two parts, because reading the diary is itself work that Friends off must not do:
// `useTargetsReachedActive` decides (and clears the map when the answer is no), and the writer
// below it is mounted only while the answer is yes (views/friends/TargetsReachedSync.jsx).

export const DEBOUNCE_MS = 2000

const same = (a, b) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

// One write through the store, and only when the value is not already the stored one.
function store(next) {
  if (same(useStore.getState().S.targetsReached, next)) return
  useStore.getState().update(s => { s.targetsReached = next })
}

/**
 * Whether the map should be kept now: Friends exists here, is on, and the targets switch is on.
 * When Friends or the switch is known to be off, a map left over is cleared. While the answer is not
 * known yet (the first load, a server that cannot be reached) nothing is read and nothing changes.
 */
export function useTargetsReachedActive() {
  const { me, on } = useFriendsMe()
  const available = friendsAvailable()
  const wanted = available && on && !!me?.share?.targets
  const known = available && !!me
  useEffect(() => {
    if (known && !wanted) store({})
  }, [known, wanted])
  return wanted
}

/** The writer: recomputes when the diary changes and writes after DEBOUNCE_MS, only a changed value. */
export function useTargetsReachedSync() {
  const today = useToday()
  const { status, days, settings, goalInputs, activity, tried } = useFoodHistory({ from: plusDays(today, -TARGETS_DAYS), to: plusDays(today, -1) })
  const next = useMemo(
    () => (status === 'ready' ? computeTargetsReached({ days, settings, goalInputs, activity, tried, today }) : status === 'off' ? {} : null),
    [status, days, settings, goalInputs, activity, tried, today],
  )
  const key = next ? JSON.stringify(next) : null
  useEffect(() => {
    if (key == null) return undefined
    const timer = setTimeout(() => store(JSON.parse(key)), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [key])
}
