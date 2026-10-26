// A workout left open (board W1.27, owner question 8): at launch, and when the app comes back to
// the front, a session whose last set is hours old is put to the user once, over Today. Not over
// the workout itself (it is on screen there), nor for an edit or a past workout (no clock runs:
// lib/stale-workout.js). Renders nothing.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { nav } from '../lib/nav.js'
import { isWorkoutPath } from '../lib/tab-route.js'
import { isSwitching } from '../lib/use-tab-nav.js'
import { staleFacts } from '../lib/stale-workout.js'
import { staleWorkoutSheet } from '../views/workout/finish-drawers.js'

const TODAY = '/home'
// Once per launch: a module flag, so a remount (the shell rebuilding) does not ask again.
let asked = false
/** A new launch, as far as the check knows (tests mount it more than once per module). */
export const resetStaleCheck = () => { asked = false }
// A tab switch to Today walks the history; the drawer pushes an entry of its own, so it waits
// for the walk to end (a few tries, then it gives up rather than open over a moving history).
const SETTLE_MS = 50
const SETTLE_TRIES = 40

function openWhenSettled(tries = SETTLE_TRIES) {
  if (!isSwitching()) { staleWorkoutSheet(); return }
  if (tries > 0) setTimeout(() => openWhenSettled(tries - 1), SETTLE_MS)
}

export default function StaleWorkoutCheck() {
  const { pathname } = useLocation()
  const path = useRef(pathname)
  path.current = pathname
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    // A stale session launches onto Today (App's fallback), but a link straight to the workout
    // still lands there, so the launch check runs there too and takes it to Today. On a return to the front, the workout
    // on screen says it all and is left alone; the summary never asks.
    const check = (launch = false) => {
      const onRun = path.current === '/train/workout'
      if (asked || (isWorkoutPath(path.current) && !(launch && onRun))) return
      if (!staleFacts(useStore.getState().S.active)) return
      asked = true
      if (path.current === TODAY) openWhenSettled()
      else { setWaiting(true); nav(TODAY) }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    check(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Over Today once the navigation has landed there.
  useEffect(() => {
    if (!waiting || pathname !== TODAY) return
    setWaiting(false)
    openWhenSettled()
  }, [waiting, pathname])

  return null
}
