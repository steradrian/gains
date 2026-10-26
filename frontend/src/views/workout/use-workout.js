// The running workout's controller: every handler the workout screen runs (the completion flow,
// sets, pairing, order, holds, navigation, the exercise's own rest and progression sheets) and the
// effects that belong to a running session (hardware keys, the live-presence heartbeat, the
// progress high-water marks, a hold back from a reload), plus the screen's view model
// (workout-view.js).
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exOr } from '../../lib/exercises.js'
import { setsDoneActive, setUnitsTotal, supersetUnits, modeOf, isPerSide, removeLastSet, pairAdjacent, bestWeightForEntry, workoutVolume } from '../../lib/history.js'
import { exerciseNameText, fmtNum } from '../../lib/format.js'
import { inclineFrom } from '../../lib/incline.js'
import { DEFAULT_EFFORT, effortLevel, isEffortSport } from '../../lib/sports.js'
import { beep, vibrate, unlock } from '../../lib/sound.js'
import { t, tn } from '../../lib/i18n.js'
import { api, beacon } from '../../lib/api.js'
import { pyramidRestFor } from '../../lib/pyramid.js'
import { nextUnfinishedUnit, setProgressHighWater, supersetFlowStep, restAfterSet, restOnRecheck, restSecFor, warmupRestSecFor } from '../../lib/supersetFlow.js'
import { swapActiveWorkoutExercise } from '../../sheets.jsx'
import { sessionNoProg, setSessionNoProg } from '../../lib/session-noprog.js'
import { markAllSetsDone } from '../../lib/backfill.js'
import { isWarmupRow, isSideSet, makeSideSet, toggleSide } from '../../lib/workout-model.js'
import { canMoveActiveWorkoutUnit, moveActiveWorkoutUnit, canMoveActiveWorkoutEntry, moveActiveWorkoutEntry } from '../../lib/active-workout-order.js'
import { nextOpenSet, workoutKeyAction } from '../../lib/workout-keys.js'
import { partOf, partsOf } from '../../lib/workout-parts.js'
import { beatsBest } from '../../lib/workout-finish.js'
import { holdRow, setHoldRow, setFieldAt, deleteActiveSet, copyActiveSet, unpairAt as unpairEntryAt } from './workout-actions.js'
import { onEntriesReordered, addWarmupAt, setNoProgAt, routineKeepsOut as keepsOut, routineUpdateAt } from './workout-actions.js'
import { addExerciseSheet, exerciseRestSheet } from './drawers.js'
import { finishSheet } from './finish-drawers.js'
import { exerciseSettingsSheet } from './exercise-drawers.jsx'
import { buildWorkoutView, extendWorkoutView, supersetLabels } from './workout-view.js'

// A key that finishes a hold early only once the hold has run past its first moments.
export const HOLD_KEY_GRACE_MS = 1500
// The pause between the two sides of a timed per-side set.
export const SWITCH_SIDES_SEC = 10

const setUI = patch => useUI.setState?.(patch)

// One new best per exercise per session (owner question 14). Memory only, keyed by the session,
// so leaving the screen and coming back does not raise the same best twice.
let bested = { id: null, ids: new Set() }
const bestedIn = id => {
  if (bested.id !== id) bested = { id, ids: new Set() }
  return bested.ids
}
/** Test hook: forget the bests raised so far. */
export const resetBested = () => { bested = { id: null, ids: new Set() } }

/**
 * After an exercise's last set the next one takes over when S.autoNext is on (the default), and
 * the hero stays on the finished exercise when it is off.
 */
export function useWorkout() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const sync = useStore(s => s.sync)
  const ui = useUI()
  const { startRest: liveRest, stopRest } = ui
  const A = S.active
  const editing = !!A?.editingWorkoutId
  // A past workout has no rest to time; the work timer for timed sets stays.
  const startRest = (A?.backfill || editing) ? () => {} : liveRest
  const entries = A?.entries || []
  // The event toasts (takeover, new best), each shown once and then taken.
  const [events, setEvents] = useState({ takeover: null, newBest: null })
  // A counter, not a clock: two events raised in one tick keep the order they were raised in.
  const eventSeq = useRef(0)
  const raise = (kind, ev) => {
    const id = ++eventSeq.current
    setEvents(prev => ({ ...prev, [kind]: { ...ev, id } }))
  }
  const take = kind => setEvents(prev => (prev[kind] ? { ...prev, [kind]: null } : prev))
  // Workout core-M3: the last exercise on screen that still had a set to do, so a finished one
  // looked back at offers "Back to Cable fly · set 2" (W1.36, the view's review.back).
  const [origin, setOrigin] = useState(null)
  const heroIdx = entries.length ? Math.min(Math.max(Number.isInteger(A?.cur) ? A.cur : 0, 0), entries.length - 1) : -1
  const heroOpen = heroIdx >= 0 && entries[heroIdx].sets.some(s => !s.done)
  const heroId = heroIdx >= 0 ? entries[heroIdx].id : null
  useEffect(() => {
    if (heroOpen) setOrigin(o => (o?.idx === heroIdx && o?.id === heroId ? o : { idx: heroIdx, id: heroId }))
  }, [heroIdx, heroId, heroOpen])

  const progressHighWater = useRef(entries.map(e => e.sets.filter(s => s.done).length))
  // The marks are index-keyed: re-baseline whenever the list length changes.
  useEffect(() => {
    progressHighWater.current = (useStore.getState().S.active?.entries || []).map(e => e.sets.filter(s => s.done).length)
  }, [entries.length])
  // A reorder from the map brings the marks along with their exercises.
  useEffect(() => onEntriesReordered(indices => {
    progressHighWater.current = indices.map(index => progressHighWater.current[index])
  }), [])
  // A removed set takes its tick with it: the mark comes down to what is ticked now.
  const setCounts = entries.map(e => e.sets.length)
  const lastCounts = useRef(setCounts)
  useEffect(() => {
    const was = lastCounts.current
    lastCounts.current = setCounts
    if (was.length !== setCounts.length) return
    setCounts.forEach((n, k) => {
      if (n < was[k]) progressHighWater.current[k] = Math.min(progressHighWater.current[k] || 0, entries[k].sets.filter(s => s.done).length)
    })
  }, [setCounts.join(',')])

  useEffect(() => () => { setUI({ setFlash: null }) }, [])

  const mutEntry = (idx, fn) => update(s => { fn(s.active.entries[idx]) }, true)
  const modeAt = idx => modeOf({ ...(entries[idx].target || {}), id: entries[idx].id })

  const addSet = idx => mutEntry(idx, e => {
    const l = e.sets[e.sets.length - 1]
    const m = modeOf({ ...(e.target || {}), id: e.id })
    // A team or racket sport has no speed: its second number is the effort, carried from the last set.
    if (m === 'cardio' && isEffortSport(e.id)) e.sets.push({ min: l ? l.min : (e.target.min || 60), eff: effortLevel(l?.eff ?? e.target.eff ?? DEFAULT_EFFORT), done: false })
    else if (m === 'cardio') e.sets.push({ min: l ? l.min : (e.target.min || 20), speed: l ? l.speed : (e.target.speed || 8), ...inclineFrom(l), done: false })
    else if (m === 'time') {
      const sec = l ? l.sec : (e.target.sec || 45)
      const w = l ? (l.w || 0) : (e.target.weight || 0)
      // A timed per-side exercise is planned in pairs: one more "set" is one more hold on each side.
      if (isPerSide({ ...(e.target || {}), id: e.id })) e.sets.push({ sec, w, done: false, side: 'L' }, { sec, w, done: false, side: 'R' })
      else e.sets.push({ sec, w, done: false })
    }
    else {
      // An extra set past a pyramid copies the last one's target, Max included.
      const row = { w: l ? l.w : 0, r: l ? l.r : e.target.reps, done: false, ...(l && l.max ? { max: true } : {}) }
      // A unilateral exercise keeps adding per-side rows (issue #60).
      e.sets.push(isPerSide({ ...(e.target || {}), id: e.id })
        ? (l && isSideSet(l)
          ? makeSideSet({ w: l.sides.L.w, r: (l.sides.L.r || 0) * 2 })
          : makeSideSet(row))
        : row)
    }
  })
  const removeSet = idx => mutEntry(idx, e => { e.sets = removeLastSet(e.sets) })
  // Workout drawers-M2: the warm-up row, progression, Update routine and Exercise settings live in
  // workout-actions.js and exercise-drawers.jsx, where How to calls them too.
  const addWarmup = idx => addWarmupAt(idx)
  // The set-number menu's Remove and the swipe both go through deleteActiveSet, Undo and all.
  const removeSetAt = (idx, i) => deleteActiveSet(idx, i, { editing })
  const copySetAt = (idx, i) => copyActiveSet(idx, i)
  const pairAt = (first, second) => update(s => {
    s.active.entries = pairAdjacent(s.active.entries, first, second)
  })
  const unpairAt = idx => unpairEntryAt(idx)
  // `member`: the exercise ⋯ menu's move, which reorders a superset member inside its superset.
  const moveUnitAt = (at, direction, member = false) => {
    const u = useUI.getState()
    const active = useStore.getState().S.active
    const canMove = member ? canMoveActiveWorkoutEntry : canMoveActiveWorkoutUnit
    if (u.work || !canMove(active, at, direction)) return
    // Invalidate an old timed callback before indexes shift. A running rest belongs to an
    // exercise (timer.forIdx), and that exercise only changes position.
    u.stopWork()
    update(s => {
      const moved = (member ? moveActiveWorkoutEntry : moveActiveWorkoutUnit)(s.active, at, direction)
      if (!moved) return
      progressHighWater.current = moved.indices.map(index => progressHighWater.current[index])
      const rest = useUI.getState().timer
      if (rest && rest.forIdx != null) {
        const forIdx = moved.indices.indexOf(rest.forIdx)
        if (forIdx >= 0) useUI.setState({ timer: { ...rest, forIdx } })
      }
    }, true)
  }

  // "Don't count for progression" for one exercise, this session.
  const setNoProg = (idx, on) => setNoProgAt(idx, on)
  // A deload or rehab routine keeps its own exercises out: its entries get the marker but no switch.
  const routineKeepsOut = e => keepsOut(S, e)
  const noProgSwitchable = !entries.length || entries.some(e => !routineKeepsOut(e))
  const toggleSessionNoProg = () => update(s => setSessionNoProg(s.active, !sessionNoProg(s.active), routineKeepsOut))

  // The exercise's ⋯ "Update routine": copy what the session changed back into the routine.
  const routineUpdateFor = idx => routineUpdateAt(idx)

  const swapExercise = idx => swapActiveWorkoutExercise(idx)
  const selectEntry = idx => update(s => { if (s.active) s.active.cur = idx })
  const advanceUnit = () => update(s => {
    if (!s.active) return
    const next = nextUnfinishedUnit(s.active.entries, supersetUnits(s.active.entries), s.active.cur)
    if (next) s.active.cur = next[0]
  })
  const navigateUnit = direction => {
    const targetFor = active => {
      if (!active || !Array.isArray(active.entries) || !Number.isInteger(active.cur)) return null
      if (active.cur < 0 || active.cur >= active.entries.length) return null
      const freshUnits = supersetUnits(active.entries)
      const freshUnitIdx = freshUnits.findIndex(candidate => candidate.includes(active.cur))
      return freshUnitIdx < 0 ? null : freshUnits[freshUnitIdx + direction]?.[0] ?? null
    }
    if (targetFor(useStore.getState().S.active) == null) return
    update(s => {
      const target = targetFor(s.active)
      if (target != null) s.active.cur = target
    })
  }
  // Logging a past workout (#284): one tap ticks every set and offers the finish.
  const markAllDone = () => {
    update(s => { if (s.active) s.active.entries = markAllSetsDone(s.active.entries) }, true)
    const fresh = useStore.getState().S.active
    // Ticked here rather than row by row, so a re-tick is not read as new progress.
    if (fresh) progressHighWater.current = fresh.entries.map(e => e.sets.filter(s => s.done).length)
    finishSheet()
  }
  // Adds an exercise after the current unit (or `afterIdx`), into `part` when given
  // (drawers.js addExerciseSheet).
  const addExercise = ({ afterIdx = null, part = null } = {}) => addExerciseSheet(afterIdx, part)
  // An exercise's own rest (drawers.js exerciseRestSheet).
  const openExerciseRest = idx => exerciseRestSheet(idx)
  const openProgressionSettings = idx => exerciseSettingsSheet(idx)

  // A timed set is held, not typed: the work timer records what was held, then ticks the set
  // through the normal path.
  const startTimed = (idx, i, onFocusProgress) => {
    if (editing) return
    const e = entries[idx]
    // Get the audio context running while this tap still counts as a gesture (iOS, #152).
    unlock(S.sound)
    // planSec keeps the plan of a hold displaced before it finished.
    const plan = (!e.sets[i].done && e.sets[i].planSec) || e.sets[i].sec || 45
    const owner = { idx, i }
    useUI.getState().startWork(plan, exerciseNameText(exOr(e.id)), holdDone(owner, plan, onFocusProgress), { idx, i, id: e.id })
    // After startWork: a hold it displaced has already written its seconds to its own row.
    setHoldRow({ owner, idx, i })
  }
  // What a hold hands back to its row: on its end, its Done, or a rest displacing it.
  const holdDone = (owner, plan, onFocusProgress) => (elapsed, { abandoned = false, chimed = false } = {}) => {
    // The row may have moved while the hold ran (a set copied or removed above it, its exercise
    // reordered): holdRow() is where it is now.
    const held = holdRow()
    const mine = held?.owner === owner
    const idx = mine ? held.idx : owner.idx
    const i = mine ? held.i : owner.i
    if (mine) setHoldRow(null)
    // A hold a rest displaced keeps its seconds and nothing else, and its plan is put aside.
    if (abandoned) {
      mutEntry(idx, en => { if (en.sets[i].planSec == null && !en.sets[i].done) en.sets[i].planSec = plan; en.sets[i].sec = elapsed })
      return
    }
    mutEntry(idx, en => { en.sets[i].sec = elapsed; delete en.sets[i].planSec })
    if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i, undefined, { quiet: chimed, onFocusProgress })
  }
  // A hold that came back from a reload has no handler yet: this screen gives it its own.
  const holdDoneRef = useRef(holdDone)
  holdDoneRef.current = holdDone
  useEffect(() => {
    useUI.getState().bindWork?.(wk => {
      const owner = { idx: wk.owner.idx, i: wk.owner.i }
      setHoldRow({ owner, idx: owner.idx, i: owner.i })
      return (...a) => holdDoneRef.current(owner, wk.total)(...a)
    })
  }, [])

  // The new screen's bar toasts: what just finished, and a best beaten live.
  const nameOf = e => exerciseNameText(exOr(e.id))
  const takeoverAfter = (fresh, idx, unitIdxs) => {
    const e = fresh.entries[idx]
    const part = partOf(e)
    const run = partsOf(fresh.entries).find(p => p.part === part && idx >= p.from && idx <= p.to)
    const partDone = run && fresh.entries.slice(run.from, run.to + 1).every(x => x.sets.length && x.sets.every(s => s.done))
    if (part === 'warmup' && partDone) {
      const n = run.to - run.from + 1
      const sets = fresh.entries.slice(run.from, run.to + 1).reduce((a, x) => a + x.sets.filter(s => s.done).length, 0)
      return { kind: 'part', idx, text: t('Warm-up done · {0} · {1}', tn('{0} exercise', '{0} exercises', n), tn('{0} set', '{0} sets', sets)) }
    }
    const sets = unitIdxs.reduce((a, k) => a + fresh.entries[k].sets.filter(s => s.done).length, 0)
    const vol = workoutVolume({ entries: unitIdxs.map(k => fresh.entries[k]) })
    const what = unitIdxs.length > 1 ? unitIdxs.map(k => nameOf(fresh.entries[k])).join(' + ') : nameOf(e)
    const parts = [t('{0} done', what), tn('{0} set', '{0} sets', sets)]
    if (vol > 0) parts.push(fmtNum(vol) + ' ' + S.unit)
    return { kind: 'exercise', idx, text: parts.join(' · ') }
  }
  const raiseNewBest = (idx, i) => {
    if (editing || A?.backfill) return
    const st = useStore.getState().S
    const fresh = st.active
    const e = fresh?.entries?.[idx]
    const set = e?.sets?.[i]
    if (!e || !set?.done) return
    const ids = bestedIn(fresh.id)
    if (ids.has(e.id) || !beatsBest(st, e, set)) return
    ids.add(e.id)
    raise('newBest', { exId: e.id, idx, text: t('New best · {0} {1}', nameOf(e), fmtNum(set.w || 0) + ' ' + st.unit + ' × ' + (set.r || 0)) })
  }

  // `quiet`: the hold that ticks this set has just ended with the chime; the tick's own beep and
  // buzz would clip it.
  const toggle = (idx, i, side, { quiet = false, onFocusProgress } = {}) => {
    // Ticking a set ends the typing in that row: drop the keyboard first (lib/viewport-guard.js).
    if (typeof document !== 'undefined') { const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur?.() }
    const m = modeAt(idx)
    const cardioEntry = m === 'cardio'
    let exJustDone = false, checked = false
    update(s => {
      const e = s.active.entries[idx]
      // A per-side tick flips just that side; toggleSide recomputes the row's own `done`.
      if (side) e.sets[i] = toggleSide(e.sets[i], side)
      else e.sets[i].done = !e.sets[i].done
      checked = e.sets[i].done
      // When the work happened, for the session's end (lib/finish-workout.js sessionEnd).
      if (!editing && (side ? e.sets[i].sides[side].done : checked)) e.sets[i].at = Date.now()
      if (checked && e.sets[i].planSec != null) delete e.sets[i].planSec
      if (e.sets[i].done && !editing) {
        if (!quiet) { beep(S.sound, 1040, 0.12); vibrate(30) }
        if (e.sets.every(x => x.done)) {
          exJustDone = true
          // topW now; exWeights only at the finish, so a typo never becomes the remembered best.
          e.topW = bestWeightForEntry(e) || null
        }
      }
    }, true)
    if (editing) return
    // Every set done shows on the screen itself (W1.9), so there is no sheet for it.
    if (exJustDone && cardioEntry) useUI.getState().toast(t('Cardio logged'))
    else if (exJustDone && m === 'time') useUI.getState().toast(t('Hold logged'))

    // Only progress beyond this exercise's high-water mark may navigate or change rest.
    const fresh = useStore.getState().S.active
    if (fresh && checked && fresh.entries[idx]) {
      const progress = setProgressHighWater(fresh.entries[idx], progressHighWater.current[idx] || 0)
      progressHighWater.current[idx] = progress.highWater

      const freshUnits = supersetUnits(fresh.entries)
      const freshUnit = freshUnits.find(u => u.includes(idx))
      const freshUnitDone = freshUnit?.every(ui2 => fresh.entries[ui2].sets.every(x => x.done))
      const nextUnit = freshUnitDone ? nextUnfinishedUnit(fresh.entries, freshUnits, idx) : null
      const freshWorkoutDone = freshUnitDone && !nextUnit
      const restBeforeWarmup = nextUnit?.some(ui2 =>
        fresh.entries[ui2].sets.some(set => isWarmupRow(set) && !set.done),
      )
      // The rest this set has earned, resolved once so every branch times the same break.
      const setRest = { idx, sec: pyramidRestFor(fresh.entries[idx].target, fresh.entries[idx].sets, i) }
      const restSec = restSecFor(fresh.entries, freshUnit || [idx], S.restSec, setRest)
      const restAfter = warmupRestSecFor(fresh.entries[idx], i, restSec)

      // A re-check of finished work must not navigate, but may still owe you a rest.
      if (!progress.isNew) {
        const rest = useUI.getState().timer
        if (!restBeforeWarmup && restOnRecheck({ timerRunning: !!(rest && !rest.ready), unitDone: freshUnitDone, lastUnit: freshWorkoutDone })) startRest(restAfter, idx, { forSet: i })
        return
      }

      // A per-side set is done only once both sides are; raiseNewBest looks at the row itself.
      raiseNewBest(idx, i)

      if (freshUnitDone && freshUnit?.includes(fresh.cur)) {
        // The next exercise takes over (S.autoNext, default on), with a bar toast
        // whose Back returns here; off, the hero stays on the finished exercise (W1.36).
        const ev = takeoverAfter(fresh, idx, freshUnit)
        if (nextUnit && S.autoNext !== false) {
          update(s => { if (s.active) s.active.cur = nextUnit[0] })
          raise('takeover', { ...ev, backTo: idx })
        } else if (ev.kind === 'part') raise('takeover', { ...ev, backTo: null })
      }

      // Between the two sides of one timed per-side set: a short "Switch sides" pause.
      const rows = fresh.entries[idx].sets
      const sideOf = r => r && !isWarmupRow(r) ? r.side : null
      const partner = sideOf(rows[i]) === 'L' && sideOf(rows[i + 1]) === 'R' ? rows[i + 1]
        : sideOf(rows[i]) === 'R' && sideOf(rows[i - 1]) === 'L' ? rows[i - 1] : null
      if (m === 'time' && partner && !partner.done && restAfter > 0) {
        startRest(Math.min(SWITCH_SIDES_SEC, restAfter), idx, { kind: 'switch', forSet: i })
        if (sideOf(rows[i]) === 'L') raise('takeover', { kind: 'side', idx, backTo: null, text: t('Left side done · right side started') })
        return
      }

      // stopRest() first so a rest that belongs after this set replaces the one that was running.
      if (freshUnitDone) stopRest()
      if (!freshUnit || freshUnit.length <= 1) {
        if (!restBeforeWarmup && restAfterSet({ unitDone: freshUnitDone, lastUnit: freshWorkoutDone })) startRest(restAfter, idx, { forSet: i })
        onFocusProgress?.({ unitDone: freshUnitDone })
        return
      }

      const step = supersetFlowStep(fresh.entries, freshUnit, idx)
      if (!step) { onFocusProgress?.({ unitDone: freshUnitDone }); return }
      if (step.unitDone) {
        if (nextUnit?.length && !restBeforeWarmup) startRest(restAfter, idx, { forSet: i })
      } else {
        if (step.nextIdx != null) update(s => { if (s.active) s.active.cur = step.nextIdx })
        if (step.roundDone) {
          startRest(restAfter, idx, { forSet: i })
          const labels = supersetLabels(fresh.entries)
          const round = Math.min(...freshUnit.map(k => fresh.entries[k].sets.filter(x => x.done).length))
          const names = freshUnit.map(k => labels[k])
          const both = t('{0} and {1}', names.slice(0, -1).join(', '), names[names.length - 1])
          raise('takeover', { kind: 'round', idx, backTo: null, text: t('Round {0} done · {1}', round, both) })
        }
      }
      onFocusProgress?.({ unitDone: freshUnitDone })
    }
  }

  // Hardware keys (issue #133): Space or Enter ticks the next set, ← and → switch exercise. The
  // listener is added once and calls the handler of the latest render.
  const tabbed = useRef(false)
  const onKey = useRef(null)
  onKey.current = event => {
    // A sheet on top owns the keyboard.
    if (useUI.getState().sheets.length) return false
    const action = workoutKeyAction(event, { tabbed: tabbed.current, rtl: document.documentElement.dir === 'rtl' })
    if (!action) return false
    event.preventDefault()
    if (action !== 'tick') { navigateUnit(action === 'next' ? 1 : -1); return true }
    // A hold being timed: the key is its "Done", once past its first moments.
    const work = useUI.getState().work
    if (work) {
      if (Date.now() - (work.endsAt - work.total * 1000) >= HOLD_KEY_GRACE_MS) useUI.getState().finishWorkEarly()
      return true
    }
    const fresh = useStore.getState().S.active
    const next = nextOpenSet(fresh?.entries, fresh?.cur)
    if (!next) return true
    // The exercise on screen is finished: this press brings up the next one.
    if (!next.current) { selectEntry(next.idx); return true }
    // A timed set is started rather than ticked; the timer ticks it.
    if (!next.side && modeAt(next.idx) === 'time') startTimed(next.idx, next.i)
    else toggle(next.idx, next.i, next.side)
    return true
  }
  useEffect(() => {
    // A Space that ticked must not also press the focused button (Firefox presses on keyup).
    let spaceTaken = false
    const down = event => {
      if (event.key === 'Tab') { tabbed.current = true; return }
      const taken = onKey.current?.(event) === true
      if (event.key === ' ') spaceTaken = taken
    }
    const up = event => { if (event.key === ' ' && spaceTaken) { spaceTaken = false; event.preventDefault() } }
    const pointer = () => { tabbed.current = false }
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    document.addEventListener('pointerdown', pointer, true)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
      document.removeEventListener('pointerdown', pointer, true)
    }
  }, [])

  // Live-presence heartbeat for the admin dashboard. Signed-in only. The page going away sends
  // the "left" signal itself: `closed` on pagehide, `hidden` on visibilitychange (iOS kills a
  // hidden home-screen app without a pagehide); a heartbeat re-arms it.
  useEffect(() => {
    if (!useStore.getState().user || editing) return
    let stopped = false
    const ping = active => {
      const A2 = useStore.getState().S.active
      if (!A2) return
      const u = supersetUnits(A2.entries)
      const c = Math.min(A2.cur, Math.max(0, A2.entries.length - 1))
      const ui2 = u.findIndex(x => x.includes(c))
      const tot = setUnitsTotal(A2.entries)
      api('/api/activity', { method: 'POST', body: JSON.stringify({
        active, name: A2.name, exIdx: ui2 + 1, exTotal: u.length,
        setsDone: setsDoneActive(A2), setsTotal: tot, startedAt: A2.start,
      }) }).catch(() => {})
    }
    let sent = null
    const live = () => { sent = null; ping(true) }
    const leave = reason => {
      if (sent === 'closed' || sent === reason) return
      sent = reason; beacon('/api/activity', { active: false, reason })
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') leave('hidden'); else if (sent && !stopped) live() }
    const onHide = () => leave('closed')
    const onShow = e => { if (e.persisted && sent && !stopped) live() }
    live()
    const iv = setInterval(() => { if (!stopped) live() }, 20000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      stopped = true; clearInterval(iv)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
      // best-effort "left" signal: the beacon survives a tab close, fetch covers in-app nav
      beacon('/api/activity', { active: false, reason: 'navigated' })
      api('/api/activity', { method: 'POST', body: JSON.stringify({ active: false, reason: 'navigated' }) }).catch(() => {})
    }
  }, [])

  const actions = {
    toggle, addSet, removeSet, addWarmup, removeSetAt, copySetAt, setField: setFieldAt, mutEntry,
    pairAt, unpairAt, moveUnitAt, setNoProg, toggleSessionNoProg, routineKeepsOut, noProgSwitchable,
    swapExercise, addExercise, markAllDone, startTimed, holdDone, navigateUnit, selectEntry, advanceUnit,
    routineUpdateFor, openExerciseRest, openProgressionSettings,
    takeEvent: take,
    // The takeover toast's Back: the exercise you were on.
    backTo: idx => { if (idx != null) selectEntry(idx); take('takeover') },
  }
  // Offline: how many changes wait for the server (null when the device cannot say).
  const offline = sync?.offline ? { offline: true, waiting: useStore.getState().unsyncedChanges?.()?.count ?? null } : null
  const view = A ? extendWorkoutView(buildWorkoutView({
    S, A, timer: ui.timer, work: ui.work, sync: offline,
    events: { ...events, bests: bestedIn(A.id).size }, now: Date.now(),
  }), { S, A, work: ui.work, origin }) : null
  return { actions, view }
}
