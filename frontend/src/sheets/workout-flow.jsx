import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { drawerFlow, useUI } from '../store/useUI.js'
import { EXIDX, exOr, beatsWeight, isCustomEx } from '../lib/exercises.js'
import { fmtDate, todayISO, isoOf, uid, exCount } from '../lib/format.js'
import { effectiveRoutineIds, bestWeightForEntry, workoutVolume, setsDoneActive, setUnitsTotal, NOTE_MAX } from '../lib/history.js'
import { beep } from '../lib/sound.js'
import { t, tn, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { nav, closeThenNav, navToWorkout } from '../lib/nav.js'
import { workoutMediaOf } from '../lib/media-refs.js'
import Stepper from '../components/Stepper.jsx'
import { durationSheet } from '../components/DurationWheel.jsx'
import { SG_NAME_MAX } from '../lib/superset-meta.js'
import { REST_MAX, fmtRest } from '../lib/duration.js'
import Icon from '../components/Icon.jsx'
import { Button, Switch, SelectRow, Row } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { exerciseMuscleSnapshot } from '../lib/muscles.js'
import { buildCompletedWorkout, sessionEnd } from '../lib/finish-workout.js'
import { refillAfter } from '../lib/rotation.js'
import { repeatSessionEntries } from '../lib/session-repeat.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { buildSessionEntries } from '../lib/session-start.js'
import { joinSessionNoProg } from '../lib/session-noprog.js'
import { buildCombinedEntries, deriveSessionName } from '../lib/session-merge.js'
import { syncNow } from '../lib/nutrition/sync.js'
import { reportWorkoutKcal } from '../lib/nutrition/workout-kcal.js'
import { workoutsOn, backfillStart, backfillEnd, completeBackfill, historyAsOf, sessionHistory } from '../lib/backfill.js'
import { rebuildPrHistory, MAX_DURATION_MIN, endsInFuture } from '../lib/workout-date.js'
import { editLeftEmpty, editedRecord, editChangesNothing } from '../lib/session-edit.js'
import { stampWorkout } from '../lib/sync-merge.js'
import { S, update, ui, toast, snd } from './shared.js'
import { confirmSheet } from './confirm-menu.jsx'
import { bwSheet } from './body-weight.jsx'
import { mediaGoesToo } from './workout-detail.jsx'
// Workout finish M1
import { onSheetEntry, whenSheetGone } from '../lib/nav.js'
import { sessionBests } from '../lib/workout-finish.js'
import { countsForRecords, normaliseParts, partOf } from '../lib/workout-parts.js'
import { warmupOfferSheet, holdReopen, markLeaving } from '../views/workout/finish-drawers.js'
import { closeThenReplace } from '../lib/nav.js'

/* ============================ workout lifecycle ============================ */
// Start / Resume from anywhere (the + sheet, the Training hub): back to the session that is on,
// else today's planned routines when any of them has exercises, else the Start screen to pick one.
export function startOrResume() {
  const st = S()
  if (st.active) { navToWorkout(); return }
  const ids = effectiveRoutineIds(st, todayISO())
  // A planned day goes through Ready and the warm-up offer like every other Start of a plan.
  if (ids.some(id => st.routines.find(r => r.id === id)?.ex.length)) { readyOrStart(ids); return }
  navToWorkout()
}

// A weigh-in already logged today stands in for the one asked before a workout.
const weighedToday = () => S().bodyweight.find(b => b.d === todayISO())

// `routineIds` accepts `string | string[] | null` — `[r.id]` for one routine,
// `effectiveRoutineIds(...)` for today's planned session, `[]` / null for explicit freestyle.
export function startFlow(routineIds) {
  // The weigh-in is a setting (Settings → During a workout, issue #137): off goes straight
  // into the session with no body weight on it, same as "Start without weighing in".
  if (S().weighIn === false) { beginWorkout(routineIds, null); return }
  const weighed = weighedToday()
  if (weighed) { beginWorkout(routineIds, weighed.w); return }
  bwSheet({ required: true, onDone: bw => beginWorkout(routineIds, bw) })
}
// `skipWarmup`: Skip warm-up on the warm-up offer (W1.31). The session starts at its first
// working exercise and the offer is not made again.
export function beginWorkout(routineIds, bw, { skipWarmup = false } = {}) {
  const st = S()
  const { entries: built, routineIds: rids, routines } = buildCombinedEntries(st, routineIds)
  // Warm-ups first and cool-downs last across combined routines too (lib/workout-parts.js); a
  // session without parts keeps its order.
  const entries = normaliseParts(built)
  const firstWork = skipWarmup ? entries.findIndex(e => partOf(e) !== 'warmup') : 0
  update(s => {
    s.active = {
      id: uid(), d: todayISO(), start: Date.now(),
      // A session tracks its routines as a list; per-entry `rid` carries which one each
      // exercise came from. No top-level `excludeFromProgression` — per-entry `noProg` does it.
      routineIds: rids,
      name: routines.length ? deriveSessionName(routines.map(r => r.name)) : t('Freestyle'),
      bw: bw || null, cur: firstWork > 0 ? firstWork : 0, entries,
      ...(skipWarmup ? { skipped: { warmup: true }, offered: { warmup: true } } : {}),
    }
  })
  useUI.getState().stopRest()
  navToWorkout()
}

/* ============================ Workout finish M1: Ready ============================ */
// Ready (W1.1) for `ids`: the workout route with `?start=`, which shows the session before it
// runs. Already on the workout route (or leaving a sheet), Ready takes that entry, as
// navToWorkout does, so one back leaves it.
export function openReady(ids) {
  const list = [].concat(ids ?? []).filter(Boolean)
  const here = String(globalThis.location?.hash || '').startsWith('#/train/workout')
  nav('/train/workout?start=' + list.map(encodeURIComponent).join(','), here || onSheetEntry() ? { replace: true } : undefined)
}

// The weigh-in exactly as startFlow asks it: off in Settings, or already logged today, it is not asked.
function weighInThen(go) {
  if (S().weighIn === false) { go(null); return }
  const weighed = weighedToday()
  if (weighed) { go(weighed.w); return }
  // The weigh-in drawer's history entry is walked off first, so the start takes Ready's entry
  // and one back from the session leaves it, as the warm-up offer's Start does.
  bwSheet({ required: true, onDone: bw => whenSheetGone(() => go(bw)) })
}

// Ready's Start workout: the weigh-in, then the warm-up offer (W1.31) when the session has
// warm-ups, else the session starts.
export function startFromReady(ids) {
  weighInThen(bw => {
    const { entries } = buildCombinedEntries(S(), ids)
    if (entries.some(e => partOf(e) === 'warmup')) warmupOfferSheet(ids, bw)
    else beginWorkout(ids, bw)
  })
}

/* ============================ Workout finish M2: the way in ============================ */
// Every Start of a plan (Today's ▶, Train, the chooser) goes through Ready first (owner question
// 3); Freestyle has nothing to show there and starts at once, after the weigh-in. Repeat today,
// Resume and a past workout keep starting directly.
export function readyOrStart(ids) {
  const list = [].concat(ids ?? []).filter(Boolean)
  if (list.length) openReady(list)
  else startFlow([])
}

// "Repeat today" (#58): a saved workout's exercises as a new freestyle session dated today, each
// seeded from what that workout logged (lib/session-repeat.js). The weigh-in asks first, the
// way starting any workout does.
export function repeatWorkout(w, close) {
  const st = S()
  if (st.active) { toast(t('Finish the current workout first.')); return }
  const { entries, skipped } = repeatSessionEntries(st, w)
  if (!entries.length) { toast(t('Nothing to repeat. Its exercises no longer exist.')); return }
  const go = bw => {
    if (S().active) { toast(t('Finish the current workout first.')); return }
    update(s => {
      s.active = {
        id: uid(), d: todayISO(), start: Date.now(), routineIds: [],
        name: w.name || t('Freestyle'), bw: bw || null, cur: 0, entries,
      }
    })
    useUI.getState().stopRest()
    if (close) closeThenNav(close, '/train/workout'); else navToWorkout()
    if (skipped) toast(tn('{0} exercise no longer exists and was left out.', '{0} exercises no longer exist and were left out.', skipped))
  }
  if (st.weighIn === false) { go(null); return }
  const weighed = weighedToday()
  if (weighed) { go(weighed.w); return }
  drawerFlow(() => bwSheet({ required: true, onDone: go }))
}

/* ============================ log a past workout ============================ */
// The same screen as a live session, pointed at another day. `backfill` on the active
// session is what tells the workout screen to drop the clock and the rest timers, and tells
// the finish path to file the workout where its date belongs instead of at the end.
// `initial` is a missed day of the plan (#284): its date, and the routines planned for it. A
// combined day is offered as the one session it plans, next to each routine on its own.
const PLANNED_DAY = '__planned-day'
function LogPastWorkout({ initial, close }) {
  const st = useStore(s => s.S)
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const planned = [].concat(initial?.routineIds || []).map(id => st.routines.find(r => r.id === id)).filter(Boolean)
  const [date, setDate] = useState(initial?.iso || isoOf(yesterday))
  const [time, setTime] = useState('18:00')
  const [dur, setDur] = useState(60)
  const [routineId, setRoutineId] = useState(planned.length > 1 ? PLANNED_DAY : planned[0]?.id || '')
  const today = todayISO()
  const options = [
    { value: '', label: t('Freestyle') },
    ...(planned.length > 1 ? [{ value: PLANNED_DAY, label: deriveSessionName(planned.map(r => r.name)) }] : []),
    ...st.routines.map(r => ({ value: r.id, label: r.name })),
  ]

  const submit = () => {
    const routineIds = routineId === PLANNED_DAY ? planned.map(r => r.id) : routineId ? [routineId] : []
    submitPastWorkout({ iso: date, time, durationMin: dur, routineIds }, { before: close })
  }

  return <>
    <h3>{t('Log a past workout')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Logged on the usual workout screen, without timers.')}</div>
    <Row icon="calendar" title={t('Date')}>
      <input type="date" className="timef" value={date} max={today} onChange={e => setDate(e.target.value)} /></Row>
    <Row icon="clock" title={t('Start time')}>
      <input type="time" className="timef" value={time} onChange={e => setTime(e.target.value)} /></Row>
    <Stepper label={t('Duration')} unit={t('min')} value={dur} step={5} min={0} decimal={false} invalid={!(dur >= 1) || dur > MAX_DURATION_MIN} onChange={v => setDur(Math.round(v))} />
    {!(dur >= 1) && <div className="small" style={{ color: 'var(--red-ink)', marginTop: 6 }}>{t('Enter how long it took (at least 1 minute).')}</div>}
    {dur > MAX_DURATION_MIN && <div className="small" style={{ color: 'var(--red-ink)', marginTop: 6 }}>{t('That’s more than a day. Keep it to 24 hours or less.')}</div>}
    <div style={{ height: 8 }} />
    <SelectRow icon="dumbbell" title={t('Routine')} value={routineId} options={options} onChange={setRoutineId} />
    <div style={{ height: 18 }} />
    <Button variant="primary" onClick={submit}>{t('Continue')}</Button>
  </>
}
// Three ways out when the day already has a workout. Replacing with several on that day means
// picking which one; the rest of the day is left alone. A workout with photos or videos says
// they come along.
function SameDayChoice({ iso, existing, onReplace, onAdd, close }) {
  return <div style={{ textAlign: 'center', padding: '4px 0' }}>
    <h3 style={{ marginBottom: 8 }}>{fmtDate(iso, true)}</h3>
    <div className="muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>{t('There is already a workout on that day.')}</div>
    {existing.map(w => {
      // Replacing re-logs the sets; the photos and videos move to the new record (completeBackfill).
      const n = workoutMediaOf(w, Infinity).length
      return <div key={w.id} style={{ marginBottom: 8 }}>
        <button className="btn danger" onClick={() => onReplace(w.id)}>{existing.length > 1 ? t('Replace') + ' · ' + w.name : t('Replace')}</button>
        {n > 0 && <div className="small dim samed-media" style={{ marginTop: 4 }}>{tn('Its photo or video moves to the new workout.', 'Its {0} photos or videos move to the new workout.', n)}</div>}
      </div>
    })}
    <button className="btn primary" onClick={onAdd}>{t('Add as second workout')}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </div>
}
/**
 * Logs a past workout: checks the day, start and length, asks what to do when the day already has
 * a workout, then opens the session for that date on the workout screen. `before` runs just before
 * it opens (the form that asked closes then, so cancelling the same-day question keeps it).
 * Returns false, with a toast saying why, when nothing opens. The Day page's Add past workout
 * drawer (PR07 D1.6) and Log a past workout both come here.
 */
export function submitPastWorkout({ iso, time = '18:00', durationMin, routineIds = [] }, { before } = {}) {
  if (S().active) { toast(t('Finish the current workout first.')); return false }
  if (!iso || iso > todayISO()) { toast(t('Pick a day up to today')); return false }
  if (!(durationMin >= 1)) { toast(t('Enter how long it took (at least 1 minute).')); return false }
  if (durationMin > MAX_DURATION_MIN) { toast(t('That’s more than a day. Keep it to 24 hours or less.')); return false }
  if (endsInFuture(iso, time, durationMin)) { toast(t('That’s still in the future. Try an earlier start.')); return false }
  const go = replaceId => {
    before?.()
    beginBackfill({ iso, time, durationMin: Math.max(1, durationMin), routineIds, replaceId })
  }
  const existing = workoutsOn(S(), iso)
  if (!existing.length) { go(null); return true }
  ui().openSheet(c => <SameDayChoice iso={iso} existing={existing} close={c}
    onReplace={id => { c(); go(id) }} onAdd={() => { c(); go(null) }} />, { kind: 'center' })
  return true
}

// History's button hands this its click event; only a day from the plan counts as `initial`.
export function logPastWorkoutSheet(initial) {
  if (S().active) { toast(t('Finish the current workout first.')); return }
  const from = typeof initial?.iso === 'string' ? initial : null
  ui().openSheet(close => <LogPastWorkout initial={from} close={close} />)
}
// A backfilled session is built the way a live one is (buildCombinedEntries → buildPlannedEntry),
// so its entries carry the same stamps: the routine list, per-entry rid and the plan, no
// top-level routineId. One routine from the picker, or every routine of a missed combined day.
// Only from the history before that day (historyAsOf): a session logged later must not hand its
// progression back to the day it skipped.
function beginBackfill({ iso, time, durationMin, routineIds, replaceId }) {
  const st = S()
  const start = backfillStart(iso, time)
  const past = historyAsOf(st, { d: iso, start, replaceId })
  const { entries, routineIds: rids, routines } = buildCombinedEntries(past, routineIds || [])
  update(s => {
    s.active = {
      id: uid(), d: iso, start,
      routineIds: rids,
      name: routines.length ? deriveSessionName(routines.map(r => r.name)) : t('Freestyle'),
      bw: null, cur: 0, entries,
      backfill: { durationMin, replaceId: replaceId || null },
    }
  })
  useUI.getState().stopRest()
  navToWorkout()
}

/* ============================ add a routine mid-session ============================ */
// The workout header ⋮ → Add routine. Single-pick: a routine already in the session, or one
// with no exercises, is shown disabled and tagged. Picking one appends its entries (each
// stamped with its `rid`), extends `s.active.routineIds`, and re-derives the session name.
// `s.active.cur` is left where it is — the appended block is reached by scrolling / Next.
function AddRoutineToSession({ close }) {
  const st = useStore(s => s.S)
  const active = st.active
  if (!active) return null
  const inSession = new Set([].concat(active.routineIds || []))
  const add = r => {
    const entries = buildSessionEntries(sessionHistory(st), r).map(e => ({ ...e, rid: r.id }))
    update(s => {
      if (!s.active) return
      // A session kept out of progression as a whole (the header ⋮) keeps the routine's
      // exercises out too, the same as an exercise added on its own.
      // Warm-ups stay first and cool-downs last (lib/workout-parts.js); the exercise you are on
      // stays the one you are on.
      const current = s.active.entries[s.active.cur]
      s.active.entries = normaliseParts([...s.active.entries, ...entries.map(e => joinSessionNoProg(s.active, e))])
      if (current) s.active.cur = Math.max(0, s.active.entries.indexOf(current))
      s.active.routineIds = [...[].concat(s.active.routineIds || []), r.id]
      if (!s.active.customName) {
        s.active.name = deriveSessionName(s.active.routineIds.map(id => s.routines.find(x => x.id === id)?.name).filter(Boolean))
      }
    })
    close()
    toast(t('{0} added ({1})', r.name, exCount(r.ex.length)))
  }
  return <>
    <h3>{t('Add routine')}</h3>
    <div className="list">
      {st.routines.map(r => {
        const already = inSession.has(r.id)
        const empty = !(r.ex || []).length
        const disabled = already || empty
        return <div key={r.id} className={'item' + (disabled ? ' disabled' : '')} aria-disabled={disabled || undefined}
          {...tappable(disabled ? null : () => add(r))}>
          <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
          <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
          {already ? <span className="tag">{t('already added')}</span> : empty ? <span className="tag">{t('no exercises')}</span> : <Icon name="chevronRight" className="chev" />}
        </div>
      })}
    </div>
  </>
}
export function addRoutineToSessionSheet() {
  if (!S().active) return
  ui().openSheet(close => <AddRoutineToSession close={close} />)
}

/* ============================ exercise notes ============================
   Two notes, one sheet, because from the user's side it is one question — "what do I want to
   remember about this exercise?" — with two different lifetimes:

     · today's note belongs to this session and is stored on the workout entry. It is history:
       what happened, how it felt. The PIN is the user saying "this one is for next time", which
       only they can know at the moment of writing — see pinnedNoteFor.
     · the standing note belongs to the exercise itself and lives in S.exNotes. Seat height, pin
       position, a form cue. True every session, so it is shown every session and never expires.

   A routine's own `note` (a plan's instruction for this exercise) is edited in the config sheet
   and is deliberately not here: it belongs to the plan, not to the day or to the movement. */
function ExerciseNote({ entryIdx, close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const A = st.active
  const editing = !!A?.editingWorkoutId
  const entry = A ? A.entries[entryIdx] : null
  const ex = entry ? exOr(entry.id) : null
  const [note, setNote] = useState(entry?.note || '')
  const [pin, setPin] = useState(!!entry?.notePin)
  const [standing, setStanding] = useState(entry ? (st.exNotes?.[entry.id] || '') : '')
  useEffect(() => { if (!entry) close() }, [!entry])
  if (!entry) return null

  const save = () => {
    const today = note.trim().slice(0, NOTE_MAX)
    const always = standing.trim().slice(0, NOTE_MAX)
    update(s => {
      const e = s.active?.entries?.[entryIdx]
      if (e) {
        if (today) { e.note = today; if (pin) e.notePin = true; else delete e.notePin }
        else { delete e.note; delete e.notePin }
      }
      if (!editing) {
        s.exNotes = s.exNotes || {}
        if (always) s.exNotes[entry.id] = always
        else delete s.exNotes[entry.id]
      }
    })
    close()
  }

  return <>
    <h3 className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</h3>
    <div className="small muted" style={{ marginBottom: 6 }}>{t('This session')}</div>
    <textarea className="input" rows={3} maxLength={NOTE_MAX} value={note}
      placeholder={t('How it went, what to change. Saved with today’s workout.')}
      onChange={e => setNote(e.target.value)} />
    <div style={{ height: 10 }} />
    <div className="sect-b">
      <Row icon="pin" iconTint="var(--yellow)" title={t('Show this next time')}
        subtitle={t('Brings it up again the next time you train this exercise.')}>
        <Switch checked={pin} onChange={setPin} disabled={!note.trim()} />
      </Row>
    </div>
    {!editing && <>
      <div style={{ height: 18 }} />
      <div className="small muted" style={{ marginBottom: 6 }}>{t('Always for this exercise')}</div>
      <textarea className="input" rows={2} maxLength={NOTE_MAX} value={standing}
        placeholder={t('Seat height, pin position, a form cue. Shown every session.')}
        onChange={e => setStanding(e.target.value)} />
    </>}
    <div style={{ height: 18 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
}
export const exerciseNoteSheet = entryIdx => ui().openSheet(close => <ExerciseNote entryIdx={entryIdx} close={close} />)

/* The session note: how the whole workout went, as opposed to how one exercise went. It lives
   on the active session, so buildCompletedWorkout carries it onto the finished workout and it
   shows up again in history — where it stays editable. Written here rather than only after the
   fact because "notes you can write during a workout" is the point; a note you can only add
   once the session is filed is a different, smaller feature. */
function SessionNote({ close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const A = st.active
  const [note, setNote] = useState(A?.note || '')
  useEffect(() => { if (!A) close() }, [!A])
  if (!A) return null

  const save = () => {
    const text = note.trim().slice(0, NOTE_MAX)
    update(s => { if (!s.active) return; if (text) s.active.note = text; else delete s.active.note })
    close()
  }

  return <>
    <h3>{t('Session note')}</h3>
    <textarea className="input" rows={4} maxLength={NOTE_MAX} value={note}
      placeholder={t('How the session went as a whole.')}
      onChange={e => setNote(e.target.value)} />
    <div style={{ height: 18 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
}
export const sessionNoteSheet = () => ui().openSheet(close => <SessionNote close={close} />)

function RenameWorkout({ close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const A = st.active
  const [name, setName] = useState(A?.name || '')
  useEffect(() => { if (!A) close() }, [!A])
  if (!A) return null

  const trimmed = name.trim().slice(0, 60)
  const canSave = trimmed.length > 0

  const save = () => {
    if (!canSave) return
    update(s => {
      if (!s.active) return
      s.active.name = trimmed
      s.active.customName = true
    })
    close()
  }

  return <>
    <h3>{t('Rename workout')}</h3>
    <input className="input" type="text" autoFocus maxLength={60} value={name}
      placeholder={t('Workout title')}
      onChange={e => setName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && canSave) save() }} />
    <div style={{ height: 18 }} />
    <Button variant="primary" disabled={!canSave} onClick={save}>{t('Save')}</Button>
  </>
}
export const renameWorkoutSheet = () => ui().openSheet(close => <RenameWorkout close={close} />)

// A superset's own name and rest between rounds (#292), from the routine editor.
function SupersetSettings({ meta, onSave, close }) {
  const [name, setName] = useState(meta.name || '')
  const [rest, setRest] = useState(meta.rest || 0)
  const save = () => { onSave({ name: name.trim().slice(0, SG_NAME_MAX), rest }); close() }
  return <>
    <h3>{t('Superset')}</h3>
    <input className="input" type="text" maxLength={SG_NAME_MAX} value={name}
      placeholder={t('Name, e.g. Arm finisher')} onChange={e => setName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') save() }} />
    <div style={{ height: 12 }} />
    <div className="list">
      <Row icon="timer" iconTint="var(--orange)" title={t('Rest after each round')}
        value={rest > 0 ? fmtRest(rest) : t('Longest exercise rest')} accessory="chevron"
        onClick={() => durationSheet({ title: t('Rest after each round'), value: rest, max: REST_MAX, off: t('Longest exercise rest'),
          footer: t('Without one, the superset rests as long as its longest exercise rest.'), onDone: setRest })} />
    </div>
    <div style={{ height: 18 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
}
export const supersetSheet = (meta, onSave) => ui().openSheet(close => <SupersetSettings meta={meta} onSave={onSave} close={close} />)

/* Drop-set drops and rest-pause bursts are edited inline on the set row itself (Workout.jsx) —
   no sheet, no timer. A planned exercise (see the "Intensifier" config below) arrives with them
   already computed via applyIntensifierPlan; an unplanned straight set can still grow one live
   by tapping "+ Drop"/"+ Burst", which appends with the same suggested-next-value math. */

export function saveWorkoutEdits(onExit = () => nav('/train/history')) {
  // A save decision left open after the editor already closed (a second prompt from a route
  // exit that raced the first save) has nothing to save or delete: it only finishes leaving.
  if (!S().active?.editingWorkoutId) { onExit(); return }
  // An edit that unticked or removed every set would save a workout with nothing in it, which
  // the history would still list and count as a training day. Deleting it is what that edit
  // means; Keep editing goes back to the sets.
  if (editLeftEmpty(S().active)) {
    confirmSheet({
      title: t('Delete workout?'),
      message: t('No sets are left in this workout, so there is nothing to save. Delete it from your history?') + mediaGoesToo(editedRecord(S())),
      confirmText: t('Delete workout'), cancelText: t('Keep editing'), danger: true,
      onConfirm: () => {
        useStore.getState().deleteHistoryEdit()
        useUI.getState().stopRest()
        useUI.getState().stopWork()
        useStore.getState().autoBackupNow()
        toast(t('Workout deleted'))
        onExit()
      },
    })
    return
  }
  try {
    useStore.getState().saveHistoryEdit()
    useUI.getState().stopRest()
    useUI.getState().stopWork()
    useStore.getState().autoBackupNow()
    toast(t('Workout updated'))
    onExit()
  } catch (error) { toast(t(error.message)) }
}

// The one save prompt that may be open: { id, onExit }. Closing the editor and a route exit
// can both ask in the same moment (the X, then the route change its tap set off); a second
// prompt stacked under the first came back after Save changes and asked all over again
// (QA 10-06). The second ask now joins the open prompt and only says where to go after it.
let savePrompt = null
const promptOpen = () => !!savePrompt && useUI.getState().sheets.some(x => x.id === savePrompt.id)

export function exitWorkoutEdit(onExit = () => nav('/train/history')) {
  if (!S().active?.editingWorkoutId) { onExit(); return }
  if (promptOpen()) { savePrompt.onExit = onExit; return }
  const prompt = { id: null, onExit }
  const done = () => prompt.onExit()
  const leave = () => {
    // A stale prompt's Don't save must not throw away whatever is in S.active by now.
    if (!S().active?.editingWorkoutId) { done(); return }
    useStore.getState().discardHistoryEdit()
    useUI.getState().stopRest()
    useUI.getState().stopWork()
    done()
  }
  // Nothing to save: closing just closes, as it does for a workout only looked at.
  if (editChangesNothing(S())) { leave(); return }
  prompt.id = ui().openSheet(close => <>
    <h3>{t('Save workout changes?')}</h3>
    <p className="muted">{t('Save your edits to this workout, or keep the original record.')}</p>
    <Button variant="primary" onClick={() => { close(); saveWorkoutEdits(done) }}>{t('Save changes')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={() => { close(); leave() }}>{t("Don't save")}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Keep editing')}</Button>
  </>, { kind: 'center' })?.id
  savePrompt = prompt
}

export function finishWorkout() {
  if (S().active?.editingWorkoutId) { saveWorkoutEdits(); return }
  const A = S().active
  if (!A) return
  const done = setsDoneActive(A)
  const total = setUnitsTotal(A.entries)
  if (!done) { confirmSheet({ title: t('Nothing logged yet'), message: t('You haven’t checked off any sets. Finish the workout anyway?'), confirmText: t('Finish anyway'), haptic: true, onConfirm: doFinishWorkout }); return }
  if (done < total) { confirmSheet({ title: t('Finish early?'), message: tn('{0} set still unchecked. Finish the workout now?', '{0} sets still unchecked. Finish the workout now?', total - done), confirmText: t('Finish workout'), haptic: true, onConfirm: doFinishWorkout }); return }
  doFinishWorkout()
}
function doFinishWorkout() { finishToSummary() }

/* ============================ Workout finish M2: to the summary ============================ */
// Finish and save, then the summary (W2.0, /train/workout/summary/:id) in the workout's place:
// replaced, so Back never returns to a finished session. `close` is the drawer that asked; a
// sheet that closed itself first (confirmSheet, menuSheet) is waited for the same way
// (closeThenReplace), so its history entry goes before the replace. What Reopen needs is held in
// memory for the summary's Done (views/workout/finish-drawers.js). Returns finishAndSave's result.
export function finishToSummary(close) {
  // A saved workout open in the editor is updated in place, never saved again as a new record.
  if (S().active?.editingWorkoutId) { close?.(); saveWorkoutEdits(); return null }
  markLeaving()
  const saved = finishAndSave()
  if (!saved) return null
  holdReopen(saved.snapshot, saved.w.id)
  closeThenReplace(close || (() => {}), '/train/workout/summary/' + encodeURIComponent(saved.w.id))
  return saved
}

/* ============================ Workout finish M1: the save ============================ */
// Clones what Reopen (lib/workout-reopen.js) needs back: plain data, so JSON is enough.
const cloneData = v => (v == null ? v : JSON.parse(JSON.stringify(v)))

// The save of the running session: the workout into history, the confirmed weights, the
// rotation's refill, the backup, the sync and kcal report, the timers off and the chime.
// Returns `{ w, prs, e1prs, snapshot }` (null with nothing running): `w` the saved record,
// `snapshot` what Reopen (W2.1) puts back for 10 s, kept in memory only, never in S; null for a
// workout logged into the past, which has no Reopen. `end` overrides when the session ended (the
// left-open save, lib/stale-workout.js).
export function finishAndSave({ end } = {}) {
  const st = S()
  const A = st.active
  if (!A || A.editingWorkoutId) return null
  const past = !!A.backfill
  // A workout logged into the past is held against the history before it, the way an edit of a
  // saved one is (rebuildPrHistory, below): it gains a badge it leads with, and a later session
  // it outdoes loses its own. It used to report none at all while the editor's Save awarded them
  // (QA 1.3.9). The confirmed weights are left alone either way. The rule is lib/workout-finish.js
  // sessionBests, which the Finish drawer and the live NEW BEST read too.
  const { prs, e1prs } = past ? { prs: [], e1prs: [] } : sessionBests(st, A)
  const w = buildCompletedWorkout(A, {
    end: end ?? (past ? backfillEnd(A) : sessionEnd(A)),
    prs,
    snapshotFor: e => isCustomEx(EXIDX[e.id]) ? exerciseMuscleSnapshot(EXIDX[e.id]) : null,
  })
  w.vol = workoutVolume(w)
  let shown = w
  const snapshot = past ? null : { at: Date.now(), workoutId: w.id, active: cloneData(A), exWeights: {}, rotation: null }
  update(s => {
    if (past) {
      // Its start and end are in the past; the stamp says when it was logged, which is what a
      // merge after a reset elsewhere asks of it (lib/sync-merge.js sinceReset).
      stampWorkout(w)
      const replaced = A.backfill.replaceId ? s.workouts.find(x => x.id === A.backfill.replaceId) : null
      const touched = [...new Set([...(replaced?.entries || []), ...w.entries].map(e => e?.id).filter(id => id != null))]
      s.workouts = rebuildPrHistory(completeBackfill(s.workouts, A, w), touched, w)
      shown = s.workouts.find(x => x === w || (w.id != null && x.id === w.id)) || w
      prs.push(...[...(shown.prs || [])])
    } else {
      w.entries.forEach(e => {
        // A warm-up or cool-down exercise never sets the weight the next session opens at.
        if (!countsForRecords(e)) return
        const mx = bestWeightForEntry(e)
        if (mx > 0 && beatsWeight(e.id, mx, (s.exWeights[e.id] || {}).w || 0)) {
          if (!Object.hasOwn(snapshot.exWeights, e.id)) snapshot.exWeights[e.id] = Object.hasOwn(s.exWeights, e.id) ? cloneData(s.exWeights[e.id]) : null
          s.exWeights[e.id] = { w: mx, d: w.d }
        }
      })
      s.workouts.push(w)
    }
    s.active = null
    const queue = snapshot ? cloneData(s.queue ?? null) : null
    const dayPlan = snapshot ? { ...(s.dayPlan || {}) } : null
    // A rotation pass this app manages starts its next pass the moment the last session lands
    // (lib/rotation.js). A planner's queue is left alone: it completes and waits for its writer.
    if (refillAfter(s, w) && snapshot) {
      const pins = Object.fromEntries(Object.entries(dayPlan).filter(([iso]) => !Object.hasOwn(s.dayPlan || {}, iso)))
      snapshot.rotation = { queue, pins }
    }
  })
  useStore.getState().autoBackupNow()
  // Its kcal entry reaches the day's diary now rather than at the hub's next poll.
  void syncNow().then(status => (status ? reportWorkoutKcal(shown) : null))
  useUI.getState().stopRest()
  // A hold still counting (a plank left unchecked, then Finish early) goes with the workout, as
  // on Discard: its bar is app-wide and would chime over the summary, and its callback writes
  // into s.active, which is gone. What it held is not logged, like any set left unchecked.
  useUI.getState().stopWork()
  beep(snd(), 880, 0.15); beep(snd(), 1100, 0.15, 0.18); beep(snd(), 1320, 0.3, 0.36)
  return { w: shown, prs, e1prs, snapshot }
}
