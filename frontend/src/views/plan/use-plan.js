import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { t, tn } from '../../lib/i18n.js'
import { DAYN, fmtDate, fmtNum, isoOf, startOfWeek, weekOrder, weekStartOf } from '../../lib/format.js'
import { glyphOf } from '../../lib/glyphs.js'
import { effectiveRoutineIds, workoutDay } from '../../lib/history.js'
import { firstWorkoutDay, plusDays } from '../../lib/missed-day.js'
import { loadOfWeeklyPlan, MUSCLE_NAME, rankOf } from '../../lib/muscles.js'
import { queueOf, queueView } from '../../lib/queue.js'
import {
  chooseFixedWeek, chooseRotation, queueRecovery, rotationIds, saveRotation, scheduleModeOf, startNewPass, startPass, stopPass,
} from '../../lib/rotation.js'
import { deriveSessionName } from '../../lib/session-merge.js'
import { moved } from '../../lib/use-list-reorder.js'
import { workoutControls } from '../../lib/workout-controls.js'
import { confirmSheet, dayOverrideSheet, menuSheet, planToolsSheet, starterPlanSheet } from '../../sheets.jsx'
import { useTodayDate } from '../today/use-today.js'
import { railDay } from '../train/use-train.js'
import { workoutsSheet } from '../train/workouts-sheet.js'
import { takeOutOfLoop } from './plan-actions.js'

// The weekly volume's target band, in planned sets a muscle (board Tr3Plan's footnote).
export const VOLUME_TARGET = [10, 12]

const routineOf = (S, id) => S.routines.find(r => r.id === id)
const dayRoutines = (S, d) => [].concat(S.week?.[d] || []).map(id => routineOf(S, id)).filter(Boolean)
const uniq = list => [...new Set(list)]

/**
 * Who owns the live pass, as Schedule derived it: `managed` when the queue is the saved rotation's
 * own pass, `external` when someone else wrote it (a coach, a planner), `recovery` when what is
 * stored cannot be read. `seq` is what the loop shows: the live pass, or the saved sequence.
 */
export function loopState(S, today) {
  const liveQ = queueOf(S)
  const managed = !!liveQ && !!S.rotation && liveQ.rotationId === S.rotation.id
  return {
    liveQ,
    seq: liveQ?.ids ?? rotationIds(S),
    // A loop the app makes has no name of its own; stored as text it would keep its language.
    seqLabel: liveQ?.label || S.rotation?.label || '',
    managed,
    external: !!liveQ && !managed,
    recovery: queueRecovery(S),
    qv: liveQ ? queueView(S, today) : null,
  }
}

const STATE_WORD = { done: () => t('Done'), next: () => t('Up next'), later: () => t('Later') }

/**
 * The loop card: `{ ids, label, line, items }`. Each item is `{ id, n, name, state, on, sub,
 * label }`, `state` the queue's ('done', 'next', 'later', 'pinned' with its date `on`) or null with
 * no pass running. `sub` is the state in words, `label` what a screen reader says for the chip.
 */
export function loopOf(S, { seq, seqLabel, qv }) {
  const items = seq.map((id, i) => {
    const r = routineOf(S, id)
    const q = qv?.items[i]
    const state = q?.state ?? null
    const sub = !q ? null : q.state === 'pinned' ? fmtDate(q.on, true) : STATE_WORD[q.state]()
    const name = r?.name ?? q?.name ?? id
    return { id, n: i + 1, name, glyph: glyphOf(r?.emoji), state, ...(q?.on ? { on: q.on } : {}), sub, label: [`${i + 1}. ${name}`, sub].filter(Boolean).join(', ') }
  })
  return {
    ids: seq,
    label: seqLabel,
    line: items.length ? tn('{0} workout, then repeat', '{0} workouts, then repeat', items.length) : null,
    items,
  }
}

/** A fixed week's routines as the card shows them: each one once, in the order the week runs. */
export function weekRoutinesOf(S) {
  const ids = uniq(weekOrder(weekStartOf(S)).flatMap(d => dayRoutines(S, d).map(r => r.id)))
  return ids.map((id, i) => {
    const r = routineOf(S, id)
    return { id, n: i + 1, name: r.name, glyph: glyphOf(r.emoji), state: null, sub: null, label: r.name }
  })
}

// The cell's state from the rail's (railDay): the rail calls today 'today' and a day before the
// first workout 'plain'; the grid draws what the day holds either way.
const cellState = day => {
  if (day.state === 'today') return day.mark === 'done' ? 'done' : day.name ? 'planned' : day.mark === 'noted' ? 'noted' : 'rest'
  if (day.state === 'plain') return 'rest'
  return day.state
}
const CELL_WORD = {
  done: () => t('Done'), missed: () => t('Planned, not logged'), noted: () => t('Day note'), planned: () => null, rest: () => t('Rest day'),
}

/**
 * The grid's two weeks, this one and the next, from the person's first weekday: `[{ title, start,
 * days }]`, each day `{ iso, dow, date, today, past, state, short, label }`. The day is the rail's
 * (railDay), so a cell holds what Train's rail shows for the same date. `label` is the cell's
 * spoken name, "Thu 22 Oct, Push A", "Tue 20 Oct, Rest day"; a combined day counts its routines.
 */
export function planWeeks(S, today) {
  const first = firstWorkoutDay(S)
  const start = isoOf(startOfWeek(today, weekStartOf(S)))
  return [t('This week'), t('Next week')].map((title, w) => {
    const from = plusDays(start, w * 7)
    return {
      title, start: from,
      days: Array.from({ length: 7 }, (_, k) => {
        const iso = plusDays(from, k)
        const day = railDay(S, iso, today, first)
        const state = cellState(day)
        const count = state === 'planned' || state === 'missed' ? effectiveRoutineIds(S, iso, today).filter(id => routineOf(S, id)).length : 0
        const what = [day.name, count > 1 && tn('{0} routine', '{0} routines', count), CELL_WORD[state](), iso === today && t('Today')]
        return {
          iso, dow: day.dow, date: day.date, today: iso === today, past: iso < today, state,
          short: day.name || t('Rest'),
          label: [fmtDate(iso, true), ...what].filter(Boolean).join(', '),
        }
      }),
    }
  })
}

/**
 * "Also on fixed days" beside a loop: the weekdays whose routines add something the loop does not
 * hold (effectiveRoutineIds' rule), `{ dow, title, sub, iso }`, `iso` the next such day from today.
 */
export function alsoFixedOf(S, today, seq) {
  const todayDow = new Date(today + 'T12:00:00').getDay()
  return weekOrder(weekStartOf(S)).flatMap(d => {
    const extra = dayRoutines(S, d).filter(r => !seq.includes(r.id))
    if (!extra.length) return []
    return [{ dow: d, title: t(DAYN[d]), sub: deriveSessionName(extra.map(r => r.name)), iso: plusDays(today, (d - todayDow + 7) % 7) }]
  })
}

/** Weekly muscle volume: `{ rows, target }`, rows `{ key, name, sets, value }` hardest-worked first, or null with nothing planned. */
export function volumeOf(S) {
  const load = loadOfWeeklyPlan(S)
  const rows = rankOf(load).worked.map(m => {
    const sets = Math.round(load[m] * 10) / 10
    return { key: m, name: t(MUSCLE_NAME[m]), sets, value: t('{0} sets', fmtNum(sets)) }
  })
  return rows.length ? { rows, target: VOLUME_TARGET } : null
}

/** Nothing to train on any day: no loop and no weekday routines (T3.3). */
export const isEmpty = (S, seq) => !seq.length && !Object.keys(S.week || {}).some(d => dayRoutines(S, d).length)

/**
 * The large title's line: the loop's routines (in Fixed week, the week's), then "· 4 days a week"
 * only where a number of days is known: in Fixed week the weekdays that hold a routine. A loop
 * has no stored days a week (weekTally counts sessions, not a target), so it says none.
 */
export function subOf(S, { mode, seq, empty }) {
  if (empty) return t('Nothing planned this week')
  if (mode === 'rotation') return seq.length ? seq.map(id => routineOf(S, id)?.name ?? id).join(', ') : null
  const days = Object.keys(S.week || {}).filter(d => dayRoutines(S, d).length).length
  return [weekRoutinesOf(S).map(r => r.name).join(', '), tn('1 day a week', '{0} days a week', days)].join(' · ')
}

/**
 * Everything the Plan page (PR02 T3.0, T3.2, T3.3) shows, as data:
 *
 *   { title, sub, mode, external, managed, recovery, qv, running, loop, weekRoutines, footer, round, editable,
 *     swipe, canAdd, weeks, alsoFixed, volume, coach, empty, today,
 *     setMode(v), setSeq(ids), reorder(from, to), takeOut(id), addToLoop(), adopt(), startPass(),
 *     startNewPass(), discardBroken(), openDay(iso), openMenu(), openVolume(), addRoutines(), pickPlan() }
 *
 * `coach` is always null for now: a Coach proposal is held by the server (or the phone's device
 * file) and read only by the chat's status poll (views/CoachChat.jsx useCoachStatus); the store
 * keeps no pending proposal for this page to show (owner question 5, slice 6).
 */
export function usePlan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const update = mut => useStore.getState().update(mut)

  const mode = scheduleModeOf(S)
  const ls = loopState(S, today)
  const { liveQ, seq, seqLabel, external, managed, recovery, qv } = ls
  const empty = isEmpty(S, seq)
  const weeks = planWeeks(S, today)

  // The same switch as Settings' (lib/rotation.js), on the same keys. Leaving a running loop asks
  // first: its progress goes, the loop itself and the weekdays stay.
  const setMode = v => {
    if (v === mode) return
    if (v === 'rotation') { update(s => { chooseRotation(s) }); return }
    if (!liveQ) { update(s => { chooseFixedWeek(s) }); return }
    confirmSheet({
      title: t('Back to a fixed week?'),
      message: t('The loop stops. Your weekdays stay as they are, and the loop is saved for later.'),
      confirmText: t('Use Fixed Week'),
      onConfirm: () => update(s => { chooseFixedWeek(s) }),
    })
  }
  // Every edit writes straight through saveRotation: an edit is the save. Emptying the loop stops
  // the pass but stays on the loop, so swapping its only routine never lands on the fixed week.
  const setSeq = ids => update(s => {
    if (ids.length) saveRotation(s, ids, seqLabel)
    else {
      stopPass(s)
      if (s.rotation) s.rotation = { ...s.rotation, sequence: [] }
      s.scheduleMode = 'rotation'
    }
  })
  const addable = S.routines.filter(r => !seq.includes(r.id))
  const addToLoop = () => menuSheet({
    title: t('Add to the rotation'),
    items: addable.map(r => ({ icon: glyphOf(r.emoji), label: r.name, onClick: () => setSeq([...seq, r.id]) })),
  })
  // The one way from someone else's queue into a loop of your own, behind a confirm that says what
  // happens. It saves no name: the planner's ("US W1") is that one pass's.
  const ownSeq = S.rotation?.sequence || []
  const replacesOwn = ownSeq.length > 0 && (ownSeq.length !== seq.length || ownSeq.some((id, i) => id !== seq[i]))
  const adopt = () => confirmSheet({
    title: t('Use this rotation?'),
    message: t('Your coach gives up control of this week: Gains owns the queue from here on and repeats these sessions by itself once they are all done. A new week from the coach’s app would replace this rotation.')
      + (replacesOwn ? ' ' + t('Your own loop gets replaced.') : ''),
    confirmText: t('Use this rotation'),
    onConfirm: () => update(s => saveRotation(s, seq, '')),
  })

  // A day to come (and today) opens the plan-day drawer on its own URL (T3.1, ?day=); a past day
  // shows what happened: a logged one its workout, as Train does, any other the day's options.
  const openDay = iso => {
    const day = weeks.flatMap(w => w.days).find(d => d.iso === iso)
    if (iso < today && day?.state === 'done') {
      workoutsSheet(fmtDate(iso, true), S.workouts.filter(w => workoutDay(w) === iso))
      return
    }
    if (iso >= today) nav({ search: '?day=' + iso }, { replace: true })
    dayOverrideSheet(iso)
  }

  const doneCount = qv ? qv.items.filter(i => i.state === 'done').length : 0
  return {
    title: t('Plan'),
    sub: subOf(S, { mode, seq, empty }),
    today,
    mode, external, managed, recovery, qv,
    running: !!liveQ,
    loop: loopOf(S, ls),
    weekRoutines: weekRoutinesOf(S),
    footer: mode === 'rotation' ? t('A missed day moves the loop forward; nothing is lost.') : t('The same routines on the same weekdays, every week.'),
    round: !qv || !seq.length ? null : qv.waiting ? t('Next round starts {0}.', fmtDate(qv.startsOn, true)) : t('{0} of {1} done this round.', doneCount, qv.items.length),
    editable: !external,
    swipe: workoutControls(S).swipeSets && !external,
    canAdd: addable.length > 0,
    weeks,
    alsoFixed: mode === 'rotation' ? alsoFixedOf(S, today, seq) : [],
    volume: empty ? null : volumeOf(S),
    coach: null,
    empty,
    setMode, setSeq,
    reorder: (from, to) => setSeq(moved(seq, from, to)),
    takeOut: id => takeOutOfLoop(id, setSeq, seq, seqLabel),
    addToLoop, adopt,
    startPass: () => update(s => startPass(s)),
    // Throws the current round away and starts the saved loop again today (the strict pass).
    startNewPass: () => update(s => startNewPass(s)),
    // Giving up an unreadable queue also gives up the loop mode, or the loop would sit with no pass.
    discardBroken: () => update(s => { s.queue = null; s.scheduleMode = 'week' }),
    openDay,
    openMenu: () => planToolsSheet(),
    openVolume: () => nav('/progress/load?view=plan'),
    // T3.3's first way in: with routines and a loop to fill, add them to it; otherwise make some.
    addRoutines: () => (mode === 'rotation' && addable.length ? addToLoop() : nav('/train/routines')),
    pickPlan: () => starterPlanSheet(),
  }
}
