import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { onSheetEntry } from '../lib/nav.js'
import { DAYN, exCount, fmtDate, fmtDur, todayISO } from '../lib/format.js'
import { effectiveRoutineIds, NOTE_MAX } from '../lib/history.js'
import { workoutsOn } from '../lib/backfill.js'
import { pinState, queueRemaining } from '../lib/queue.js'
import { deriveSessionName } from '../lib/session-merge.js'
import { restDay, restPlan } from '../lib/missed-day.js'
import { markUndone, undoMarks } from '../lib/sync-merge.js'
import { usualDuration } from '../lib/train-stats.js'
import { nameOf } from '../lib/training-day.js'
import { useSheetKeyboard } from '../lib/use-sheet-keyboard.js'
import { canNoteDay, dayNoteOf, withDayNote, DAY_NOTE_ICON, DAY_NOTE_LABEL, DAY_NOTE_TAGS } from '../lib/day-notes.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import MenuList from '../ds/MenuList.jsx'
import RadioRow from '../ds/RadioRow.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import TextField from '../ds/TextField.jsx'
import { musclesLine } from '../views/train/use-train.js'
import { logPastWorkoutSheet } from './workout-flow.jsx'
import { S, toast, ui, update } from './shared.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/** "Chest, shoulders, triceps · 55 min": what a session works, and how long one routine usually
 *  takes; the exercise count when it has no muscle data, and no duration when there is none. */
export function routineSub(st, routines) {
  const ms = routines.length === 1 ? usualDuration(st, routines[0].id) : null
  const n = routines.reduce((sum, r) => sum + (r.ex?.length || 0), 0)
  return [musclesLine(routines) || exCount(n), ms && fmtDur(ms)].filter(Boolean).join(' · ')
}

/**
 * Rest / skip this day (owner decision 1), with an Undo: the day rests and its session (one
 * routine of a combined day, lib/missed-day.js movingId) moves to the next free day. Returns
 * restDay's answer, or null when the day has nothing to move.
 */
export function restDayWithUndo(iso, today = todayISO()) {
  const before = S()
  let done = null
  update(s => { done = restDay(s, iso, today) })
  if (!done) return null
  // The Undo marks the plan days it put back, so another device's later edit to one still wins.
  const marks = undoMarks(before, S())
  const moved = nameOf([S().routines.find(r => r.id === done.id)].filter(Boolean))
  const text = done.to ? t('{0} moved to {1}', moved, fmtDate(done.to, true))
    : done.floats ? t('{0} moves to the next day you train', moved)
      : t('{0} set to rest', fmtDate(iso))
  ui().toast(text, { action: t('Undo'), onAction: () => update(s => { done.undo(s); markUndone(s, marks) }) })
  return done
}

// A routine of a multi-pick (Every Thursday): a check mark, announced as checked, in tap order.
function CheckRow({ title, sub, checked, onClick }) {
  return (
    <button type="button" className="g-radio g-tr3-check" role="checkbox" aria-checked={checked} onClick={onClick}>
      <span className="g-radio-body"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      <span className={checked ? 'g-tr3-mark on' : 'g-tr3-mark'} aria-hidden="true" />
    </button>
  )
}

/*
 * T3.1 Plan day (board Tr3PlanDay): what a day trains.
 * - Today and later: "Only {date}" picks one routine for that date (S.dayPlan[iso]; a date holds
 *   one, owner question 2), "Every {weekday}" picks one or more for the weekday (S.week[dow], in
 *   tap order, the key deleted rather than set to []). Pick, then Save.
 * - A day gone by: Log this workout when it was missed, Back to weekly plan, and the note.
 * In a coach week (or your own loop) its sessions still to do come first: picking one pins it to
 * the date, the same per-date override queueNext reads back; one pinned to another date says so.
 */
function PlanDayDrawer({ iso, close }) {
  const st = useStore(s => s.S)
  const today = todayISO()
  const past = iso < today
  const dow = new Date(iso + 'T12:00:00').getDay()
  const weekday = t(DAYN[dow])
  const date = fmtDate(iso, true)
  const dayPlan = st.dayPlan || {}
  const routineOf = id => st.routines.find(r => r.id === id)
  const nameFor = ids => deriveSessionName(ids.map(id => routineOf(id)?.name).filter(Boolean))

  const hasOvr = dayPlan[iso] !== undefined
  // A fulfilled pin (a coach session pinned here and since done) reads as no override, as it does
  // everywhere else; the row to clear the leftover entry stays.
  const changed = hasOvr && pinState(st, dayPlan[iso]) !== 'done'
  // The plan the day would have without its override: the weekday's routines, and in a coach week
  // the queue's session for the day in front of them, as Train's day card shows.
  const { [iso]: _ovr, ...noOvr } = dayPlan
  const weeklyIds = effectiveRoutineIds({ ...st, dayPlan: noOvr }, iso)
  const weekly = weeklyIds.length ? nameFor(weeklyIds) : t('Rest')
  const effIds = effectiveRoutineIds(st, iso)
  const logged = workoutsOn(st, iso).length > 0
  // A planned day gone by with nothing logged was missed, or trained and never logged (#284).
  const missed = past && effIds.length > 0 && !logged
  // A note on a day off (#261): today and days gone by with nothing logged (owner question 3).
  const note = dayNoteOf(st, iso)
  const canNote = !!note || (canNoteDay(iso, today) && !logged)

  // The coach week's sessions still to do; your own rotation's pass is your loop, not a coach's.
  const remaining = queueRemaining(st)
  const ownLoop = !!st.queue && !!st.rotation && st.queue.rotationId === st.rotation.id
  const coach = remaining.map(routineOf).filter(Boolean)
  const others = st.routines.filter(r => !remaining.includes(r.id))
  // Active pins straight from the plan (earliest day per session, today or later).
  const pinnedOn = Object.entries(dayPlan).filter(([d, id]) => d >= today && remaining.includes(id)).sort()
    .reduce((m, [d, id]) => (m[id] ? m : { ...m, [id]: d }), {})

  // Rest here moves the session on (restPlan), unless the day is trained or being trained: then
  // it is only set to rest, as before.
  const rest = !past && !logged && !(iso === today && st.active) ? restPlan(st, iso, today) : null
  const restLine = !rest ? t('No workout this day')
    : rest.to ? t('{0} moves to your next free day', nameFor([rest.id]))
      : rest.floats ? t('{0} moves to the next day you train', nameFor([rest.id]))
        : t('No workout this day')

  const startOne = hasOvr ? (dayPlan[iso] === 'rest' || dayPlan[iso] === '' ? 'rest' : dayPlan[iso])
    : effIds.length === 1 ? effIds[0] : effIds.length ? null : 'rest'
  const startMany = [].concat(st.week?.[dow] || [])
  const [scope, setScope] = useState('only')
  const [one, setOne] = useState(startOne)
  const [many, setMany] = useState(startMany)
  const titleId = useId()

  const openNote = () => { close(); dayNoteSheet(iso) }
  const noteItem = canNote && {
    key: 'note', icon: note?.tag ? DAY_NOTE_ICON[note.tag] : 'note',
    label: note ? (note.tag ? t(DAY_NOTE_LABEL[note.tag]) : t('Day note')) : t('Add a note for this day'),
    detail: note ? note.text || null : t('Life happens. Leave yourself a note, and the missed-day nudge lets this one go.'),
    onClick: openNote,
  }
  const backToWeekly = () => {
    update(s => { delete s.dayPlan[iso] })
    close()
    toast(t('Back to weekly plan'))
  }

  const head = (
    <p className="g-tr3-plan">
      {t('Weekly plan:')} {weekly}{changed && <b> · {t('changed for this day')}</b>}
    </p>
  )

  if (past) {
    const logIt = () => { close(); logPastWorkoutSheet({ iso, routineIds: effIds }) }
    const items = [
      hasOvr && { key: 'weekly', icon: 'reset', label: t('Back to weekly plan'), detail: weekly, onClick: backToWeekly },
      noteItem,
    ].filter(Boolean)
    return (
      <BottomSheet title={date} head={head}
        footer={missed && <Button block icon="checkCircle" onClick={logIt}>{t('Log this workout')}</Button>}>
        {items.length > 0 && <MenuList items={items} label={t('Day options')} />}
      </BottomSheet>
    )
  }

  const save = () => {
    if (scope === 'every') {
      close()
      if (sameList(many, startMany)) return
      update(s => { if (many.length) s.week[dow] = many; else delete s.week[dow] })
      toast(t('{0}s: {1}', weekday, many.length ? nameFor(many) : t('Rest')))
      return
    }
    close()
    if (one === startOne) return
    if (one === 'weekly') { update(s => { delete s.dayPlan[iso] }); toast(t('Back to weekly plan')); return }
    if (one === 'rest') {
      if (rest && restDayWithUndo(iso, today)) return
      update(s => { s.dayPlan[iso] = 'rest' })
      toast(t('{0} set to rest', fmtDate(iso)))
      return
    }
    update(s => { s.dayPlan[iso] = one })
    toast(t('{0} planned for {1}', routineOf(one)?.name, fmtDate(iso)))
  }
  const toggle = id => setMany(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))

  const radio = r => (
    <RadioRow key={r.id} title={r.name} selected={one === r.id} onClick={() => setOne(r.id)}
      sub={pinnedOn[r.id] && pinnedOn[r.id] !== iso ? fmtDate(pinnedOn[r.id], true) : routineSub(st, [r])} />
  )
  return (
    <BottomSheet title={date} type="half" head={<>
      {head}
      <SegmentedControl value={scope} onChange={setScope} label={t('Change for')}
        options={[{ value: 'only', label: t('Only {0}', date) }, { value: 'every', label: t('Every {0}', weekday) }]} />
      <p className="g-tr3-hint" id={titleId}>{scope === 'only' ? t('Pick one routine.') : t('Pick one routine, or more to train them together.')}</p>
    </>} footer={<Button block onClick={save} disabled={scope === 'only' && one == null}>{t('Save')}</Button>}>
      {scope === 'only' ? (
        <div className="g-tr3-list" role="radiogroup" aria-labelledby={titleId}>
          {coach.length > 0 && <h3 className="g-tr3-sec">{ownLoop ? t('Your loop') : t('Coach week')}</h3>}
          {coach.map(radio)}
          {coach.length > 0 && others.length > 0 && <h3 className="g-tr3-sec">{t('Routines')}</h3>}
          {others.map(radio)}
          <RadioRow title={t('Rest / skip this day')} sub={restLine} selected={one === 'rest'} onClick={() => setOne('rest')} />
          {hasOvr && <RadioRow title={t('Back to weekly plan')} sub={weekly} selected={one === 'weekly'} onClick={() => setOne('weekly')} />}
        </div>
      ) : (
        <div className="g-tr3-list" role="group" aria-labelledby={titleId}>
          {st.routines.map(r => <CheckRow key={r.id} title={r.name} sub={routineSub(st, [r])} checked={many.includes(r.id)} onClick={() => toggle(r.id)} />)}
          <CheckRow title={t('Rest / skip this day')} sub={t('Nothing planned on {0}s', weekday)} checked={!many.length} onClick={() => setMany([])} />
          <p className="g-tr3-hint">{t('Every {0} changes future {0}s only; past days keep what was logged.', weekday)}</p>
        </div>
      )}
      {noteItem && <div className="g-tr3-note"><MenuList items={[noteItem]} label={t('Day note')} /></div>}
    </BottomSheet>
  )
}

// The day the plan-day drawer is open on, while it is: the page's ?day= stays while it is up.
let openOn = null

/** Opens T3.1 for the day `iso`, from anywhere (the Plan page, Train's Change this day, History's
 *  calendar, Training load). Only the Plan page gives it a URL (usePlanDayParam). */
export function dayOverrideSheet(iso) {
  openOn = iso
  const gone = () => { if (openOn === iso) openOn = null }
  ui().openSheet(close => <PlanDayDrawer iso={iso} close={() => { gone(); close() }} />, { variant: 'ds', onDismiss: gone })
}

/**
 * The Plan page's half of T3.1's own URL (/train/schedule?day=2026-10-22). The page sets ?day=
 * as it opens the drawer; on a load with it (a link, a reload) this opens the drawer, and once
 * the drawer (and any sheet it opened, like the note) is closed it takes ?day= away again, in
 * place, after the sheet's own history entry is walked off (Modals.jsx).
 */
export function usePlanDayParam() {
  const { search, key } = useLocation()
  const navigate = useNavigate()
  const open = useUI(s => s.sheets.length > 0)
  const day = new URLSearchParams(search).get('day')
  const cold = useRef(true)
  useEffect(() => {
    const first = cold.current
    cold.current = false
    if (!day || open || openOn === day) return
    if (first && ISO.test(day)) { dayOverrideSheet(day); return }
    if (onSheetEntry()) return
    const rest = new URLSearchParams(search)
    rest.delete('day')
    const left = rest.toString()
    navigate({ search: left ? '?' + left : '' }, { replace: true })
    // `key` re-runs it once the sheet's entry is walked off: the URL is the same, the entry is not.
  }, [day, open, key, search, navigate])
}

/*
 * T3.4 Day note (board Tr3Note): why a day went without training (#261), one of four quick tags, a
 * line of text, or both. Saving an empty note takes it away (a stamped clear, withDayNote), and so
 * does Remove note.
 */
function DayNoteDrawer({ iso, close }) {
  const noteRef = useRef(null)
  const onNoteFocus = useSheetKeyboard(noteRef)
  const st = useStore(s => s.S)
  const had = dayNoteOf(st, iso)
  const [tag, setTag] = useState(had?.tag || null)
  const [text, setText] = useState(had?.text || '')
  const write = v => {
    update(s => { s.dayNotes = withDayNote(s.dayNotes, iso, v) })
    close()
  }
  const save = () => {
    const clean = text.trim().slice(0, NOTE_MAX)
    if (!tag && !clean && !had) { close(); return }
    write({ tag, text: clean })
    toast(tag || clean ? t('Noted. See you next session!') : t('Note removed'))
  }
  const remove = () => { write(null); toast(t('Note removed')) }
  return (
    <BottomSheet title={t('Day note')} chip={fmtDate(iso, true)} footer={<>
      <Button block onClick={save}>{t('Save')}</Button>
      {had && <Button block variant="ghost" icon="trash" onClick={remove}>{t('Remove note')}</Button>}
    </>}>
      <div className="g-tr3-tags">
        <ChipGroup label={t('Why')} value={tag} onChange={v => setTag(v === tag ? null : v)}
          options={DAY_NOTE_TAGS.map(k => ({ value: k, label: t(DAY_NOTE_LABEL[k]) }))} />
      </div>
      <TextField label={t('Day note')} value={had?.text || ''} placeholder={t('Anything else? (optional)')} multiline rows={3}
        inputRef={noteRef} inputProps={{ maxLength: NOTE_MAX, onFocus: onNoteFocus }} onChange={setText} />
    </BottomSheet>
  )
}

/** Opens T3.4 for the day `iso`. */
export const dayNoteSheet = iso => ui().openSheet(close => <DayNoteDrawer iso={iso} close={close} />, { variant: 'ds' })
