import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EXIDX, figureOf, imgSrc } from '../lib/exercises.js'
import { fmtDate, fmtNum, fmtVol, fmtDur, durPart, todayISO, isoOf, DAYS, weekOrder, weekStartOf, weekDayOffset, MONTHS_LONG, exerciseNameText } from '../lib/format.js'
import { effectiveRoutineIds, workoutDay, workoutDuration, workoutVolume, workSetsDone, sessionSections, setLabel, NOTE_MAX } from '../lib/history.js'
import { t, tn, exerciseNameFor } from '../lib/i18n.js'
import { nav, closeThen, closeThenNav } from '../lib/nav.js'
import { drawerFlow } from '../store/useUI.js'
import { dayTargetOf, firstLogDay, navToDay } from '../lib/day-route.js'
import { diaryIndexDays } from '../lib/nutrition/diary-index.js'
import WorkoutMediaSection, { workoutMediaCount } from '../components/WorkoutMedia.jsx'
import { workoutMediaOf } from '../lib/media-refs.js'
import { mediaStore } from '../lib/media-store.js'
import Stepper from '../components/Stepper.jsx'
import Icon from '../components/Icon.jsx'
import { useSheetClosed } from '../components/presence.jsx'
import { Button, Row } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { MOBILE, shareExportBlob } from '../lib/mobile.js'
import { speedUnitOf } from '../lib/speed.js'
import { hasCompletedWork } from '../lib/workout-model.js'
import { saveSessionAsRoutine } from '../lib/session-routines.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { workoutFit, fitFileName } from '../lib/fit-export.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { levelsOf, loadOfWorkouts } from '../lib/muscles.js'
import { moveWorkout, sameWorkout, startTimeOf, durationMinOf, setWorkoutDuration, MAX_DURATION_MIN, endsInFuture } from '../lib/workout-date.js'
import { putBackWorkout, takeWorkout, takenMediaHashes } from '../lib/workout-delete.js'
import { editCompletedSession } from '../lib/session-edit.js'
import { markUndone, stampWorkout, undoMarks } from '../lib/sync-merge.js'
import { workoutText } from '../lib/workout-text.js'
import { copyText } from '../lib/clipboard.js'
import { pinState } from '../lib/queue.js'
import { volumeText } from '../lib/train-stats.js'
import { workoutLabel } from '../lib/training-day.js'
import { dayNoteOf, dayNoteLine } from '../lib/day-notes.js'
import BodyMap from '../ds/BodyMap.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import DetailRow from '../ds/DetailRow.jsx'
import ExerciseThumbRow from '../ds/ExerciseThumbRow.jsx'
import MenuList from '../ds/MenuList.jsx'
import StatTiles from '../ds/StatTiles.jsx'
import Tag from '../ds/Tag.jsx'
import { muscleSentence } from '../views/train/history/use-history.js'
import { S, update, ui, toast } from './shared.js'
import { confirmSheet } from './confirm-menu.jsx'
import { exerciseHistorySheet } from './exercise.jsx'
import { repeatWorkout } from './workout-flow.jsx'
import { dayOverrideSheet } from './plan.jsx'
import { shareWorkoutSheet } from './workout-share.jsx'

/* ============================ workout detail ============================ */
// Correcting when a saved session happened: typed in from another app, or logged on the wrong
// day. Only its place in history moves — the sets, the volume and the notes are the record, and
// the session keeps the length it had. The PR badges of the exercises it trained are worked out
// again, because "this was a record" is a claim about the sessions before it.
function WorkoutDateEdit({ w, onDone, close }) {
  const [date, setDate] = useState(w.d)
  const [time, setTime] = useState(startTimeOf(w))
  const today = todayISO()
  const save = () => {
    if (!date || date > today) { toast(t('Pick a day up to today')); return }
    // Nothing to do, and nothing to push: a no-op save and a workout deleted from another
    // sheet both just close.
    if (date === w.d && time === startTimeOf(w)) { close(); return }
    if (!(S().workouts || []).some(x => sameWorkout(x, w))) { close(); return }
    // It keeps its length, so the end it would have is what has to be in the past.
    if (endsInFuture(date, time, durationMinOf(w))) { toast(t('That’s still in the future. Try an earlier start.')); return }
    update(s => {
      const next = moveWorkout(s.workouts, w, date, time)
      if (next) s.workouts = next
    })
    close()
    onDone && onDone()
    toast(t('Workout moved'))
  }
  return <>
    <h3>{t('Change date & time')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('The session keeps its length. Personal records are worked out again from the new order.')}</div>
    <Row icon="calendar" title={t('Date')}>
      <input type="date" className="timef" value={date} max={today} onChange={e => setDate(e.target.value)} /></Row>
    <Row icon="clock" title={t('Start time')}>
      <input type="time" className="timef" value={time} onChange={e => setTime(e.target.value)} /></Row>
    <div style={{ height: 18 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
}
export const workoutDateSheet = (w, onDone) => ui().openSheet(close => <WorkoutDateEdit w={w} onDone={onDone} close={close} />)

// Correcting how long a saved session ran — mostly the workout nobody ended until they got home
// (Discord). The start stays, the end follows it; the sets, the order of history and the badges
// do not depend on the length and are left alone.
function WorkoutDurationEdit({ w, onDone, close }) {
  const [dur, setDur] = useState(durationMinOf(w))
  // A cleared field reads as 0, and saving that made the session one minute long without a word
  // (QA 1.3.9): it is refused with the reason under the field, and the saved length stays.
  const durInvalid = !(dur >= 1)
  const durTooLong = dur > MAX_DURATION_MIN
  const save = () => {
    if (durInvalid) { toast(t('Enter how long it took (at least 1 minute).')); return }
    if (durTooLong) { toast(t('That’s more than a day. Keep it to 24 hours or less.')); return }
    let changed = false
    update(s => {
      const next = setWorkoutDuration(s.workouts, w, dur)   // at least a minute, however the field was left
      if (next) { s.workouts = next; changed = true }
    })
    close()
    if (!changed) return
    onDone && onDone()
    toast(t('Duration changed'))
  }
  return <>
    <h3>{t('Change duration')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Forgot to finish on time? Set how long the session really took. It keeps its start time and its sets.')}</div>
    {/* min 0, not 1: the stepper would put a cleared field back to 1 as it lost focus to Save. */}
    {/* No max either: one would cut a typo down to a day on blur and save that without a word. */}
    <Stepper label={t('Duration')} unit={t('min')} value={dur} step={5} min={0} decimal={false} invalid={durInvalid || durTooLong} onChange={v => setDur(Math.round(v))} />
    {durInvalid && <div className="small" style={{ color: 'var(--red-ink)', marginTop: 6 }}>{t('Enter how long it took (at least 1 minute).')}</div>}
    {durTooLong && <div className="small" style={{ color: 'var(--red-ink)', marginTop: 6 }}>{t('That’s more than a day. Keep it to 24 hours or less.')}</div>}
    <div style={{ height: 18 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
}
export const workoutDurationSheet = (w, onDone) => ui().openSheet(close => <WorkoutDurationEdit w={w} onDone={onDone} close={close} />)

// An exercise as "Copy as text" and the share card write it, and as the drawer's rows show it.
const nameOf = e => (EXIDX[e.id] ? exerciseNameFor(EXIDX[e.id]) : (e.n || e.id))
const shownName = e => (EXIDX[e.id] ? exerciseNameText(EXIDX[e.id]) : (e.n || e.id))

// T8.1, a saved workout (board Tr8Workout): the name, and its date, which opens the day; Time,
// Sets and Volume; the muscle map with the muscles that did most of the work; the exercises with
// their sets and new bests, each opening its history; the photos and videos; the session note;
// then what can be done with it.
function WorkoutDetail({ w, close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  // The session note is editable here rather than only at the finish sheet: what you want to
  // record about a session is often clearer once you have looked at what you actually did.
  const [note, setNote] = useState(w.note || '')
  // A note written here is an edit of the saved workout, stamped for the sync to keep it over an
  // older copy of the same workout (stampWorkout) — and only when it changed, since a stamp
  // outranks what another device wrote since.
  const saveNote = () => update(s => {
    const rec = s.workouts.find(x => sameWorkout(x, w))
    if (!rec) return
    const text = note.trim().slice(0, NOTE_MAX)
    if (text === (rec.note || '')) return
    if (text) rec.note = text; else delete rec.note
    stampWorkout(rec)
  })
  // onBlur alone loses the note: Escape, the Android back gesture and swipe-to-dismiss all
  // close the sheet without ever moving focus out of the textarea. Flush on close too: the moment
  // it is closed, not once its way out has played. The ref keeps it to the note as it stands.
  const latest = useRef(note)
  latest.current = note
  const initial = useRef(w.note || '')
  useSheetClosed(() => {
    const text = latest.current.trim().slice(0, NOTE_MAX)
    if (text === initial.current) return
    update(s => {
      const rec = s.workouts.find(x => sameWorkout(x, w))
      if (!rec || text === (rec.note || '')) return   // deleted from this very sheet, or already saved
      if (text) rec.note = text; else delete rec.note
      stampWorkout(rec)
    })
  })
  // Every action that reads the record, moves it or leaves the drawer writes the note first (the
  // textarea only writes on blur), and stops the closing hook writing it a second time.
  const flush = () => {
    saveNote()
    initial.current = latest.current.trim().slice(0, NOTE_MAX)
  }
  const levels = useMemo(() => levelsOf(loadOfWorkouts([w])), [w])
  const sentence = useMemo(() => muscleSentence(w), [w])
  const day = workoutDay(w)
  const date = day ? fmtDate(day, true) : ''
  const figure = figureOf(st)
  const prs = new Set(w.prs || [])
  // Tapping an exercise opens its history (Discord 'Improvement ideas'): from one session to the
  // curve it sits on, which is the question a past workout raises most often.
  const entryRow = (e, i) => {
    const ex = EXIDX[e.id]
    const sets = e.sets.filter(hasCompletedWork).map(s => setLabel(e.id, s, e.target, speedUnitOf(st))).join(' · ') || t('no sets')
    return (
      <div key={i} className="g-wd-ex">
        <ExerciseThumbRow image={ex?.img ? imgSrc(ex, figure) : null} size={48} title={shownName(e)} sub={sets}
          trailing={prs.has(e.id) ? <Tag tone="positive">{t('New best')}</Tag> : false} onClick={() => exerciseHistorySheet(e.id)} />
        {e.note && <p className="g-wd-exnote">{e.notePin && <Icon name="pin" className="g-icon" />}{e.note}</p>}
      </div>
    )
  }
  // Exercises done as a superset stay together under a "Superset" label, the way the routine
  // editor shows them (Discord: "supersets aren't shown at all"). Adjacent entries with the same
  // tag, as in the workout itself; a workout finished before the tag was kept has none.
  const entryRows = units => units.map(unit => {
    if (unit.length < 2) return entryRow(w.entries[unit[0]], unit[0])
    return (
      <div key={'ss' + unit[0]} className="g-wd-ss">
        <p className="g-wd-ss-label"><Icon name="link" className="g-icon" />{t('Superset')}</p>
        {unit.map(i => entryRow(w.entries[i], i))}
      </div>
    )
  })
  // Copied with the note as it stands in the box, which may not be saved yet.
  const withNote = () => ({ ...(st.workouts.find(x => sameWorkout(x, w)) || w), note: note.trim() })
  const copyAsText = async () => {
    toast(await copyText(workoutText(withNote(), { unit: st.unit, nameOf, speedUnit: speedUnitOf(st) })) ? t('Copied') : t('Could not copy'))
  }
  // A Garmin .fit activity (#447) of the saved record, for Garmin Connect's Import Data.
  const exportFit = () => {
    const rec = st.workouts.find(x => sameWorkout(x, w)) || w
    let bytes
    try { bytes = workoutFit(rec, { unit: st.unit, version: __APP_VERSION__ }) }
    catch { toast(t('Could not create the file')); return }
    saveFitFile(new Blob([bytes], { type: 'application/vnd.ant.fit' }), fitFileName(rec))
  }
  const shareAsImage = () => {
    const rec = withNote()
    flush()
    drawerFlow(() => shareWorkoutSheet(rec, nameOf))
  }
  // The routine is named after the session and its day, as the row says it will be.
  const routineName = t('{0}, {1}', workoutLabel(w), day ? fmtDate(day) : '')
  const saveAsRoutine = () => confirmSheet({
    title: t('Save as routine?'),
    message: t('Create an independent routine from these exercise targets. Your workout history is kept.'),
    confirmText: t('Save'),
    onConfirm: () => {
      let id
      try { update(s => { id = saveSessionAsRoutine(s, w, routineName) }) }
      catch (e) { toast(t(e.message)); return }
      close()
      nav('/train/routines/' + id)
    },
  })
  // A combined session's entries carry a `rid`; group them into per-routine sections in merge
  // order, with each section's supersets paired inside it (sessionSections, which "Copy as text"
  // reads the workout through too). A legacy single-routine workout (one routineIds, or no rid
  // anywhere) renders flat.
  const groups = sessionSections(w.entries)
  const grouped = groups.length > 1 || (groups[0] && groups[0].rid && (w.routineIds || []).length > 1)
  const ms = workoutDuration(w)
  const tiles = [
    ms >= 60000 && { label: t('Time'), value: fmtDur(ms) },
    { label: t('Sets'), value: fmtNum(workSetsDone(w)) },
    { label: t('Volume'), value: volumeText(w.vol ?? workoutVolume(w), st.unit) },
    w.bw && { label: t('Body weight'), value: fmtNum(w.bw) + ' ' + st.unit },
  ].filter(Boolean)
  const running = !!st.active
  const later = t('Finish the current workout first.')
  return (
    <BottomSheet title={workoutLabel(w)} type="full" chip={date || null} chipLabel={date ? t('See {0}', date) : undefined}
      onChip={day ? () => { flush(); openDay(day, close) } : undefined}>
      <StatTiles items={tiles} />
      {sentence && (
        <div className="g-wd-map">
          <BodyMap levels={levels} tone="light" width={112} body={st.body === 'female' ? 'female' : 'male'} />
          <p><b>{t('Muscle map')}</b><span>{sentence}</span></p>
        </div>
      )}
      <h3 className="g-wd-h">{t('Exercises')}</h3>
      {grouped ? groups.map(g => {
        const r = g.rid ? st.routines.find(x => x.id === g.rid) : null
        const items = g.items.map(i => w.entries[i])
        const setN = workSetsDone({ entries: items })
        return (
          <section key={g.rid || '__none'} className="g-wd-group">
            <p className="g-wd-group-head">
              <b>{r && <Icon name={glyphOf(r.emoji)} className="g-icon" />}{r ? r.name : t('Freestyle')}</b>
              <span>{tn('{0} set', '{0} sets', setN)} · {volumeText(workoutVolume({ entries: items }), st.unit)}</span>
            </p>
            {entryRows(g.units)}
          </section>
        )
      }) : entryRows(groups[0]?.units || [])}
      {/* Progress photos and form-check videos: added and removed right here, on the saved record. */}
      <WorkoutMediaSection w={w} />
      <label className="g-wd-note">
        <b>{t('Session note')}</b>
        <textarea rows={2} maxLength={NOTE_MAX} value={note}
          placeholder={t('How the session went as a whole.')}
          onChange={e => setNote(e.target.value)} onBlur={saveNote} />
      </label>
      <div className="g-wd-rows">
        {/* The same exercises again, today, as a new session (#58): the rows read what was logged
            in this workout. The record itself stays as it is. */}
        <DetailRow icon="reset" title={t('Repeat today')} sub={running ? later : t('Same exercises, last weights')}
          onClick={running ? undefined : () => { flush(); repeatWorkout(w, close) }} />
        <DetailRow icon="plus" title={t('Save as routine')} sub={t('Becomes “{0}”', routineName)} onClick={saveAsRoutine} />
        <DetailRow icon="share" title={t('Share as image')} sub={t('A card with the map and your bests')} onClick={shareAsImage} />
        <DetailRow icon="pencil" title={t('Edit workout')} sub={t('Sets, date and time, duration')}
          onClick={() => { flush(); drawerFlow(() => editWorkoutSheet(w)) }} />
        <DetailRow icon="download" title={t('Export as .fit file')} sub={t('Garmin Connect can take it from there')} onClick={exportFit} />
        <DetailRow icon="copy" title={t('Copy as text')} onClick={copyAsText} />
        <DetailRow icon="trash" title={t('Delete workout')} sub={t('Undo for 8 s')} danger
          onClick={() => { flush(); close(); deleteWorkoutWithUndo(w) }} />
      </div>
    </BottomSheet>
  )
}
export const workoutDetailSheet = w => ui().openSheet(close => <WorkoutDetail w={w} close={close} />, { variant: 'ds' })

// Edit workout, from T8.1: the sets in the workout screen (not while another session runs, since
// the editor is that screen), or when it happened and how long it took.
function EditWorkoutMenu({ w, close }) {
  const running = useStore(s => !!s.S.active)
  const items = [
    {
      key: 'sets', icon: 'pencil', label: t('Edit sets'), detail: running ? t('Finish the current workout first.') : null, disabled: running,
      onClick: () => {
        try { update(state => { editCompletedSession(state, w) }); closeThenNav(close, '/train/workout') }
        catch (error) { toast(t(error.message)) }
      },
    },
    { key: 'date', icon: 'calendar', label: t('Change date & time'), onClick: () => drawerFlow(() => workoutDateSheet(w)) },
    { key: 'duration', icon: 'stopwatch', label: t('Change duration'), onClick: () => drawerFlow(() => workoutDurationSheet(w)) },
  ]
  return (
    <BottomSheet title={t('Edit workout')}>
      <MenuList items={items} label={t('Edit workout')} />
    </BottomSheet>
  )
}
export const editWorkoutSheet = w => ui().openSheet(close => <EditWorkoutMenu w={w} close={close} />, { variant: 'ds' })

/**
 * T8.4: deletes the saved workout `w` at once, with no confirm (the design system keeps confirms
 * for what an Undo cannot reverse), and offers Undo for 8 s. The Undo puts back the exact record
 * at its place and marks what it put back, so the sync keeps it over the removal (lib/
 * workout-delete.js). Its photos and videos are held in the local store while the Undo can still
 * bring them back, so no clean-up deletes a file in the meantime; the toast says they go too.
 * Returns whether there was anything to delete.
 */
export function deleteWorkoutWithUndo(w) {
  const before = S()
  let snap = null
  update(s => { snap = takeWorkout(s, w) })
  if (!snap) return false
  const marks = undoMarks(before, S())
  const rec = snap.taken[0].rec
  const release = mediaStore.hold(takenMediaHashes(snap))
  const files = workoutMediaOf(rec, Infinity).length
  const day = workoutDay(rec)
  ui().toast(day ? t('Deleted {0} from {1}', workoutLabel(rec), fmtDate(day, true)) : t('Deleted {0}', workoutLabel(rec)), {
    action: t('Undo'), icon: 'trash',
    body: files ? tn('Its photo or video is deleted with it.', 'Its {0} photos or videos are deleted with it.', files) : null,
    onAction: () => update(s => { if (putBackWorkout(s, snap)) markUndone(s, marks) }),
    onClose: release,
  })
  return true
}

// A past day from the first log on opens its Day page (PR07 D1), under the tab on screen. Today, a
// day to come, a day before the first log and a day off with a note (its note is in the day sheet)
// keep the sheets they had.
const opensDayPage = (st, iso) => {
  const noteOnly = !(st.workouts || []).some(w => workoutDay(w) === iso) && dayNoteOf(st, iso)
  return !noteOnly && dayTargetOf(iso, { today: todayISO(), first: firstLogDay(st, diaryIndexDays()) }) === 'day'
}

/**
 * Opens the day `iso`, as History's calendar, the heatmap and a workout's date open it: the Day
 * page (`/:tab/day/:date`) when the day opens there, else what the calendar sheet did: the day's
 * workouts as a list when it has any, else the day sheet to plan a session there. `close` is the
 * drawer it is opened from, closed first so that its history entry goes with it (the Day page
 * takes that entry's place).
 */
export function openDay(iso, close) {
  if (opensDayPage(S(), iso)) {
    closeThen(close, replace => navToDay(iso, undefined, { replace }))
    return
  }
  // Another drawer: it slides in over the one this was opened from.
  if ((S().workouts || []).some(w => workoutDay(w) === iso)) drawerFlow(() => dayWorkoutsSheet(iso))
  else drawerFlow(() => dayOverrideSheet(iso))
}

// The workouts of one day, newest last, each opening its drawer.
export const dayWorkoutsSheet = iso => {
  const ws = (S().workouts || []).filter(w => workoutDay(w) === iso)
  ui().openSheet(() => <><h3>{fmtDate(iso, true)}</h3><div className="list">{ws.map(w => <WorkoutRow key={w.id} w={w} onClick={() => drawerFlow(() => workoutDetailSheet(w))} />)}</div></>)
}

// The .fit file goes out the way a backup does: the share sheet in the phone app (Files, Drive,
// Garmin Connect itself), a download in the browser.
async function saveFitFile(blob, name) {
  if (MOBILE) { try { await shareExportBlob(blob, name) } catch { /* share sheet dismissed */ } return }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  toast(t('Saved. Garmin Connect can take it from here.'))
}
// The sentence a workout's Delete adds when its photos and videos go with it — every file the
// record lists, shown or not. Empty when it has none.
export function mediaGoesToo(rec) {
  const n = workoutMediaOf(rec, Infinity).length
  return n ? ' ' + tn('Its photo or video is deleted with it.', 'Its {0} photos or videos are deleted with it.', n) : ''
}

/* ============================ calendar ============================ */
// `onPick(iso)`: Home's date navigator. Every day is then a date to go to, and the days with food
// logged in NutriTrace are marked beside the trained ones (the one calendar for both). Days to
// come are dimmed there; `onFuture(iso)` makes them tappable and hands them over instead (Home
// and Training: "change this day" for a day ahead, the picked date untouched).
function Calendar({ start, close, onPick, onFuture }) {
  const st = useStore(s => s.S)
  const logged = useNutrition(s => s.logged)
  const [cur, setCur] = useState(() => {
    const d = !start ? new Date() : typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(start + 'T12:00:00') : new Date(start)
    d.setDate(1)
    return d
  })
  const y = cur.getFullYear(), mo = cur.getMonth()
  // The shown month only (NutriTrace has no range read: one request per day not cached yet),
  // never past today; another month or closing the sheet cancels what is still loading.
  useEffect(() => {
    if (!onPick || !nutritionAvailable(useStore.getState().user)) return undefined
    const ctl = new AbortController()
    useNutrition.getState().loadLogged(isoOf(new Date(y, mo, 1)), isoOf(new Date(y, mo + 1, 0)), { signal: ctl.signal })
    return () => ctl.abort()
  }, [onPick, y, mo])
  const byDay = {}
  st.workouts.forEach(w => {
    const day = workoutDay(w)
    if (day) (byDay[day] = byDay[day] || []).push(w)
  })
  // Which column the 1st sits in, and therefore how many blanks come before it.
  const ws = weekStartOf(st)
  const startOffset = weekDayOffset(new Date(y, mo, 1).getDay(), ws)
  const daysIn = new Date(y, mo + 1, 0).getDate()
  const monthWs = st.workouts.filter(w => workoutDay(w)?.startsWith(y + '-' + String(mo + 1).padStart(2, '0')))
  const monthVol = monthWs.reduce((a, w) => a + (w.vol || 0), 0)
  const monthMs = monthWs.reduce((a, w) => a + Math.max(0, (w.end || w.start) - w.start), 0)
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(<div key={'e' + i} />)
  for (let d = 1; d <= daysIn; d++) {
    const iso = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    // A fulfilled pin (a coach session pinned here and since done) reads as no override, as it does everywhere else.
    const ws = byDay[iso], planned = effectiveRoutineIds(st, iso).length > 0, ovr = st.dayPlan[iso] !== undefined && pinState(st, st.dayPlan[iso]) !== 'done'
    // A day off with a note on it (#261) shows the note's dot instead of the plan's, and its
    // note as the tooltip; tapping it opens the day sheet, where the note is.
    const note = !ws && dayNoteOf(st, iso)
    const dotCls = ws ? 'done' : note ? 'noted' : ovr && planned ? 'ovr' : planned ? 'plan' : ''
    const ate = !!onPick && logged.days.has(iso)
    cells.push(<button key={d} className={'cal-d' + (ws ? ' has' : '') + (note ? ' noted' : '') + (ate ? ' logged' : '') + (iso === todayISO() ? ' today' : '')}
      title={note ? dayNoteLine(note, t) : undefined} disabled={!!onPick && !onFuture && iso > todayISO()} onClick={() => {
      if (onPick) { close(); if (onFuture && iso > todayISO()) onFuture(iso); else onPick(iso); return }
      if (opensDayPage(st, iso)) { openDay(iso, close); return }
      if (!ws) { drawerFlow(() => dayOverrideSheet(iso)); return }
      if (ws.length === 1) { drawerFlow(() => workoutDetailSheet(ws[0])); return }
      drawerFlow(() => dayWorkoutsSheet(iso))
    }}><span>{d}</span><i className={dotCls} /></button>)
  }
  return <>
    <div className="row between" style={{ marginBottom: 2 }}>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo - 1, 1))} aria-label={t('Previous month')}><Icon name="chevronLeft" /></button>
      <h3 style={{ margin: 0 }}>{t(MONTHS_LONG[mo])} {y}</h3>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo + 1, 1))} aria-label={t('Next month')}><Icon name="chevronRight" /></button>
    </div>
    <div className="small muted" style={{ textAlign: 'center' }}>{monthWs.length ? `${tn('{0} workout', '{0} workouts', monthWs.length)} · ${fmtDur(monthMs)} · ${fmtVol(monthVol, st.unit)}` : t('No workouts this month')}</div>
    <div className="cal-grid">{weekOrder(ws).map(d => <div key={d} className="cal-h">{t(DAYS[d])}</div>)}{cells}</div>
    <div className="cal-legend">
      <span><i style={{ background: 'var(--acc)' }} />{t('Trained')}</span>
      <span><i style={{ background: 'var(--label-3)' }} />{t('Planned')}</span>
      <span><i style={{ background: 'var(--orange)' }} />{t('Rescheduled')}</span>
      {Object.keys(st.dayNotes || {}).some(k => k.startsWith(y + '-' + String(mo + 1).padStart(2, '0')) && dayNoteOf(st, k)) &&
        <span><i style={{ background: 'var(--indigo)' }} />{t('Day note')}</span>}
      {onPick && <span><i className="cal-logged-key" />{t('Food logged')}</span>}
    </div>
    <div className="small dim" style={{ textAlign: 'center', marginTop: 10 }}>{onPick ? t('Tap a day to see it') : t('Tap a trained day for details · tap any other day to plan a session')}</div>
  </>
}
export const calendarSheet = (start, { onPick, onFuture } = {}) => ui().openSheet(close => <Calendar start={start} close={close} onPick={onPick} onFuture={onFuture} />)

/* shared small workout row (used in lists) */
export function WorkoutRow({ w, onClick }) {
  const st = useStore(s => s.S)
  const glyph = glyphOf((st.routines.find(r => r.id === w.routineId) || {}).emoji)
  const mediaN = workoutMediaCount(w)
  return <div className="item" {...tappable(onClick)}>
    <span className="lrow-i" style={{ width: 34, height: 34, borderRadius: 8, fontSize: 19 }}><Icon name={glyph} /></span>
    <div className="grow"><div className="tt">{workoutLabel(w)}</div>
      <div className="ss">{[fmtDate(w.d, true), ...durPart(w.end - w.start), tn('{0} set', '{0} sets', workSetsDone(w)), fmtVol(w.vol, st.unit)].join(' · ')}</div></div>
    {mediaN > 0 && <span className="wrow-media" title={tn('{0} photo or video', '{0} photos or videos', mediaN)} aria-label={tn('{0} photo or video', '{0} photos or videos', mediaN)}><Icon name="image" />{mediaN}</span>}
    {w.prs && w.prs.length > 0 && <span className="pr"><Icon name="trophy" />{w.prs.length} PR</span>}
    <Icon name="chevronRight" className="chev" />
  </div>
}
