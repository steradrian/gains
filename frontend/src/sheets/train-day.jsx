import { useRef } from 'react'
import { useStore } from '../store/useStore.js'
import { dateLocale, t } from '../lib/i18n.js'
import { closeThenNav, nav } from '../lib/nav.js'
import { queueOf, queueView } from '../lib/queue.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { effectiveRoutineIds, workoutDay } from '../lib/history.js'
import { EXIDX, figureOf, imgSrc } from '../lib/exercises.js'
import { workoutsOn } from '../lib/backfill.js'
import { canNoteDay, dayNoteOf, DAY_NOTE_LABEL } from '../lib/day-notes.js'
import { restPlan } from '../lib/missed-day.js'
import { nameOf, workoutLabel } from '../lib/training-day.js'
import Icon from '../components/Icon.jsx'
import { useStartChoices } from '../components/use-start-choices.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import MenuList from '../ds/MenuList.jsx'
import Tag from '../ds/Tag.jsx'
import { addRoutine } from '../views/routines/routine-actions.js'
import { dayNoteSheet, dayOverrideSheet, importPlanFile, PLAN_FILE_ACCEPT } from './plan.jsx'
import { restDayWithUndo, routineSub } from './plan-day.jsx'
import { starterPlanSheet } from './starter.jsx'
import { repeatWorkout, startFlow } from './workout-flow.jsx'
import { S, ui } from './shared.js'

// The stack of exercise stills on a routine row (board T2.1 draws three).
const THUMBS = 3
const weekdayOf = iso => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short' })

function thumbsOf(st, routines) {
  const figure = figureOf(st)
  return routines.flatMap(r => r.ex || []).slice(0, THUMBS).map(cfg => {
    const ex = EXIDX[cfg.id]
    return ex?.img ? imgSrc(ex, figure) : null
  })
}

// The tag sits beside the name; the hidden comma keeps a screen reader from running the two
// together ("Push A, Planned today").
function RoutineRow({ name, tag, sub, thumbs, first, disabled, onClick }) {
  return (
    <button type="button" className={'g-xrow g-tr-choice' + (first ? '' : ' g-xrow-line')} disabled={disabled} onClick={onClick}>
      <span className="g-tr-stack" aria-hidden="true">
        {thumbs.map((src, i) => (
          <span key={i}>{src ? <img src={src} alt="" width="40" height="40" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>}</span>
        ))}
      </span>
      <span className="g-tr-b"><b>{name}{tag && <><span className="g-sr">, </span>{tag}</>}</b>{sub && <span>{sub}</span>}</span>
      {!disabled && <Icon name="chevronRight" className="g-icon g-xrow-chev" />}
    </button>
  )
}

// A coach week's or rotation's progress, over the routines: its name,
// and where it stands — done so far, complete, or the day the next one starts.
function queueLine(S, v) {
  const q = queueOf(S)
  // Ownership, not mere presence of a rotationId (lib/rotation.js): a pass this app manages
  // speaks in rounds and refills itself; a planner's week asks the coach for the next.
  const managed = !!q && !!S.rotation && q.rotationId === S.rotation.id
  const done = v.items.length - v.remaining.length
  const status = v.complete ? (managed ? t('Round complete') : t('Week complete, ask the coach'))
    : v.waiting ? (managed ? t('Next round starts {0}.', fmtDate(v.startsOn, true)) : t('Next week starts {0}', fmtDate(v.startsOn, true)))
      : managed ? t('{0} of {1} done this round.', done, v.items.length) : `${done} / ${v.items.length}`
  return { label: managed ? t('Rotation') : v.label, status }
}

function ActionRow({ icon, title, sub, first, onClick }) {
  return (
    <button type="button" className={'g-xrow g-tr-choice g-tr-act' + (first ? '' : ' g-xrow-line')} onClick={onClick}>
      <span className="g-tr-disc" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>
      <span className="g-tr-b"><b>{title}</b>{sub && <span>{sub}</span>}</span>
    </button>
  )
}

// T2.1 Start a workout: today's planned session first, the other routines, a missed day's routine
// last (named, as the missed-day banner names it), then Freestyle and the latest workout again.
// Every start goes through startFlow, which asks the weigh-in first unless it is off. A routine
// with no exercises opens its editor instead, as the routine tile's ▶ does. A coach week's or
// rotation's sessions wear their state: a done one is inert (starting it again earns no credit),
// the next one is "Up next"; the week's name and progress sit under the title. With no routines
// it offers T2.9's three ways to get a plan in place of the list.
function StartChooserDrawer({ close }) {
  const st = useStore(s => s.S)
  const { today, others, missed, last } = useStartChoices()
  const fileRef = useRef(null)
  const start = ids => { close(); startFlow(ids) }
  const open = r => (r.routines.every(x => !x.ex?.length) ? closeThenNav(close, '/train/routines/' + r.routines[0].id) : start(r.ids))
  const qv = queueView(st, todayISO())
  const stateOf = id => qv?.items.find(i => i.id === id)?.state
  const missedIds = new Set(missed?.ids || [])
  const one = r => {
    const state = stateOf(r.id)
    return {
      key: r.id, name: r.name, routines: [r], ids: [r.id], disabled: state === 'done',
      tag: state === 'done' ? <Tag tone="muted">{t('Done')}</Tag> : state === 'next' ? <Tag tone="accent">{t('Up next')}</Tag> : null,
    }
  }
  const rows = [
    ...(today.routines.length ? [{ key: 'today', name: today.name, routines: today.routines, ids: today.ids, tag: <Tag>{t('Planned today')}</Tag> }] : []),
    ...others.filter(r => !missedIds.has(r.id)).map(one),
    ...others.filter(r => missedIds.has(r.id)).map(r => ({ ...one(r), tag: <Tag tone="warning">{t('Missed {0}', weekdayOf(missed.iso))}</Tag> })),
  ]
  const week = qv && st.routines.length ? queueLine(st, qv) : null
  const noPlan = !st.routines.length
  const pickFile = ev => { const f = ev.target.files[0]; ev.target.value = ''; importPlanFile(f, close) }
  const actions = [
    ...(noPlan ? [
      { key: 'plans', icon: 'clipboard', title: t('Pick a ready-made plan'), onClick: () => { close(); starterPlanSheet() } },
      { key: 'new', icon: 'plus', title: t('Create a routine'), onClick: () => addRoutine(to => closeThenNav(close, to)) },
      { key: 'import', icon: 'download', title: t('Import a plan file'), onClick: () => fileRef.current?.click() },
    ] : []),
    { key: 'free', icon: 'shuffle', title: t('Freestyle'), sub: t('Pick exercises as you go'), onClick: () => start([]) },
    ...(last ? [{ key: 'repeat', icon: 'reset', title: t('Repeat a past workout'), sub: fmtDate(workoutDay(last), true) + ' · ' + workoutLabel(last), onClick: () => repeatWorkout(last, close) }] : []),
  ]
  return (
    <BottomSheet title={t('Start a workout')} chip={t('Today')}
      head={week && <p className="g-tr-week">{week.label && <b>{week.label}</b>}<span>{week.status}</span></p>}>
      {rows.map((r, i) => (
        <RoutineRow key={r.key} name={r.name} tag={r.tag} sub={routineSub(st, r.routines)} thumbs={thumbsOf(st, r.routines)} first={i === 0}
          disabled={r.disabled} onClick={() => open(r)} />
      ))}
      {actions.map((a, i) => <ActionRow key={a.key} {...a} first={!rows.length && i === 0} />)}
      {noPlan && <input ref={fileRef} type="file" accept={PLAN_FILE_ACCEPT} onChange={pickFile} hidden />}
      {!noPlan && (
        <div className="g-tr-more">
          <Button variant="secondary" block onClick={() => { close(); starterPlanSheet() }}>{t('Browse ready-made plans')}</Button>
        </div>
      )}
    </BottomSheet>
  )
}

/**
 * Opens T2.1 Start a workout. While a session is on (or a workout is open for editing) there is
 * nothing to choose: it goes back to it, as Train's Start slot always has.
 */
export function startChooserSheet() {
  if (S().active) { nav('/train/workout'); return }
  ui().openSheet(close => <StartChooserDrawer close={close} />, { variant: 'ds' })
}

// T2.2 Day options, the today card's ⋯ for any day: change it (the day sheet), a different workout
// just for today, rest it (its session moves to the next free day, with Undo), or a note.
function DayOptionsDrawer({ iso, close }) {
  const st = useStore(s => s.S)
  const today = todayISO()
  const name = nameOf(effectiveRoutineIds(st, iso, today).map(id => st.routines.find(r => r.id === id)).filter(Boolean))
  const date = fmtDate(iso, true)
  const logged = workoutsOn(st, iso).length > 0
  const note = dayNoteOf(st, iso)
  const canNote = !!note || (canNoteDay(iso) && !logged)
  // A day already trained, gone by, or being trained right now has nothing left to rest.
  const rest = iso >= today && !logged && !(iso === today && st.active) ? restPlan(st, iso, today) : null
  // A combined day moves one routine (restPlan's `id`): the line names that one, not the day.
  const routineName = id => nameOf([st.routines.find(r => r.id === id)].filter(Boolean))
  const restLine = !rest ? null
    : rest.to ? t('{0} moves to your next free day', routineName(rest.id))
      : rest.floats ? t('{0} moves to the next day you train', routineName(rest.id))
        : t('No workout this day')
  const restIt = () => { close(); restDayWithUndo(iso, today) }
  const items = [
    { key: 'change', icon: 'calendar', label: t('Change this day'), detail: t('Pick another routine for {0}', date), onClick: () => { close(); dayOverrideSheet(iso) } },
    iso === today && !st.active && { key: 'choose', icon: 'swap', label: t('Choose a different workout'), detail: t('Just for today'), onClick: () => { close(); startChooserSheet() } },
    rest && { key: 'rest', icon: 'moon', label: t('Rest / skip this day'), detail: restLine, onClick: restIt },
    canNote && { key: 'note', icon: 'note', label: t('Add a note for this day'), detail: note?.text || (note?.tag ? t(DAY_NOTE_LABEL[note.tag]) : null), onClick: () => { close(); dayNoteSheet(iso) } },
  ].filter(Boolean)
  return (
    <BottomSheet title={name ? date + ' · ' + name : date}>
      <MenuList items={items} label={t('Day options')} />
    </BottomSheet>
  )
}

/** Opens T2.2 Day options for the day `iso` (the today card's ⋯). */
export const dayOptionsSheet = iso => ui().openSheet(close => <DayOptionsDrawer iso={iso} close={close} />, { variant: 'ds' })
