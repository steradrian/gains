// The running workout's map and options drawers (PR-03 drawers-M3): the map with reorder, Make
// superset and Skip (W1.37, W1.23, W1.45), the superset settings step, and Workout options with its
// Workout settings step (W1.20, W1.21). Add exercise (W1.18, W1.19) is the picker, opened from
// drawers.js. Light DS drawers on BottomSheet; steps stay inside the drawer, and a row that opens
// another sheet closes this one first (one drawer at a time).
import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exOr } from '../../lib/exercises.js'
import { supersetUnits } from '../../lib/history.js'
import { exerciseNameText } from '../../lib/format.js'
import { t, tn } from '../../lib/i18n.js'
import { fmtRest } from '../../lib/duration.js'
import { SG_NAME_MAX, supersetMeta } from '../../lib/superset-meta.js'
import { partOf, partsOf } from '../../lib/workout-parts.js'
import { sessionNoProg, setSessionNoProg } from '../../lib/session-noprog.js'
import { markAllSetsDone } from '../../lib/backfill.js'
import { pictureOf } from '../train/use-train.js'
import { addRoutineToSessionSheet, renameWorkoutSheet, sessionNoteSheet } from '../../sheets.jsx'
import Elapsed from '../../components/Elapsed.jsx'
import { RestStep, RestTimerStep, WorkoutSettingsBody } from '../../components/WorkoutSettingsSheet.jsx'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import DetailRow from '../../ds/DetailRow.jsx'
import MapDrawer from '../../ds/MapDrawer.jsx'
import Switch from '../../ds/Switch.jsx'
import { discardSheet, finishSheet } from './finish-drawers.js'
import { heroMeta } from './workout-view.js'
import { moveEntryWithinPart, pairWithNext, unpairAt, setPartSkipped } from './workout-actions.js'
import './map-drawers.css'

const openDs = render => useUI.getState().openSheet(render, { variant: 'ds' })
const update = (fn, local) => useStore.getState().update(fn, local)
const TONES = { warmup: 'warm', main: 'main', cooldown: 'cool' }
const partName = part => (part === 'warmup' ? t('Warm-up') : part === 'cooldown' ? t('Cool-down') : t('Workout'))
const isDone = e => e.sets.length > 0 && e.sets.every(s => s.done)

// The superset of the current exercise, as entry indexes: [] when it stands alone.
const unitOf = A => supersetUnits(A.entries).find(u => u.includes(A.cur) && u.length > 1) || []

// The superset bracket of a row: its group's first member draws "a", the others "b".
function bracket(entries, idx) {
  const sg = entries[idx].sg
  if (!sg) return undefined
  const first = entries.findIndex(e => e.sg === sg)
  if (first === idx) return entries.some((e, j) => j !== idx && e.sg === sg) ? 'a' : undefined
  return 'b'
}

// Writes the group's own name and round rest onto every member's target (read back by supersetMeta).
function saveSupersetMeta(sg, { name, rest }) {
  const clean = name.trim().slice(0, SG_NAME_MAX)
  update(s => {
    for (const e of s.active?.entries || []) {
      if (!sg || e.sg !== sg) continue
      e.target = { ...(e.target || {}) }
      if (clean) e.target.sgName = clean; else delete e.target.sgName
      if (rest > 0) e.target.sgRest = Math.round(rest); else delete e.target.sgRest
    }
  })
}

/* --------------------------------------------------------------------- the map -- */

function MapHost({ close, addExercise }) {
  const S = useStore(s => s.S)
  const A = S.active
  const [step, setStep] = useState('map')
  const [draft, setDraft] = useState({ name: '', rest: 0 })
  useEffect(() => { if (!A) close() }, [!A])
  if (!A) return null

  const unit = unitOf(A)
  const cur = A.entries[A.cur]
  const next = A.entries[A.cur + 1]
  const runs = partsOf(A.entries)
  const count = A.entries.length
  const seen = {}
  const keys = A.entries.map(e => { seen[e.id] = (seen[e.id] || 0) + 1; return e.id + ':' + seen[e.id] })

  const row = idx => {
    const e = A.entries[idx]
    const ex = exOr(e.id)
    const name = exerciseNameText(ex)
    const done = isDone(e)
    const now = idx === A.cur && !done
    const upto = Math.max(0, e.sets.findIndex(s => !s.done))
    return {
      id: keys[idx], image: pictureOf(S, e.id), name, sub: heroMeta(S, e),
      state: done ? 'done' : now ? 'now' : 'todo', stateLabel: done ? t('Done') : t('Up next'),
      nowLabel: t('Set {0} of {1}', upto + 1, e.sets.length),
      superset: bracket(A.entries, idx),
      handleLabel: t('Move {0}', name),
      onClick: () => { update(s => { if (s.active?.entries?.[idx]) s.active.cur = idx }); close() },
    }
  }
  const sections = runs.map(run => {
    const idxs = Array.from({ length: run.count }, (_, k) => run.from + k)
    const done = idxs.filter(i => isDone(A.entries[i])).length
    const open = done < run.count && !A.skipped?.[run.part]
    return {
      key: String(run.from), tone: TONES[run.part], rows: idxs.map(row),
      title: done === run.count ? t('{0} · done', partName(run.part)) : t('{0} · {1} of {2} done', partName(run.part), done, run.count),
      action: open && run.part !== 'main' ? (run.part === 'warmup' ? t('Skip warm-up') : t('Skip cool-down')) : undefined,
      onAction: () => setPartSkipped(run.part, true),
    }
  })
  const reorder = (key, from, to) => {
    const run = runs.find(r => String(r.from) === key)
    if (run) moveEntryWithinPart(run.from + from, run.from + to)
  }
  const pairable = unit.length === 0 && !!next && cur && partOf(cur) === partOf(next)

  if (step === 'rest') {
    return <BottomSheet type="auto" title={t('Rest after each round')}>
      <RestStep back={t('Superset')} value={draft.rest} off={t('Longest exercise rest')}
        hint={t('Without one, the superset rests as long as its longest exercise rest.')}
        onDone={rest => setDraft(d => ({ ...d, rest }))} onBack={() => setStep('superset')} />
    </BottomSheet>
  }
  if (step === 'superset') {
    const save = () => { saveSupersetMeta(cur?.sg, draft); setStep('map') }
    return <BottomSheet type="auto" title={t('Superset')} footer={<Button block onClick={save}>{t('Save')}</Button>}>
      <div className="g-ws-step">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => setStep('map')}>{t('All exercises')}</Button>
        <input className="g-ws-input" type="text" maxLength={SG_NAME_MAX} value={draft.name} aria-label={t('Superset')}
          placeholder={t('Name, e.g. Arm finisher')} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') save() }} />
        <DetailRow icon="timer" title={t('Rest after each round')}
          value={draft.rest > 0 ? fmtRest(draft.rest) : t('Longest exercise rest')} onClick={() => setStep('rest')} />
      </div>
    </BottomSheet>
  }
  const openSuperset = () => { setDraft(supersetMeta(A.entries, unit, { onTarget: true })); setStep('superset') }
  return (
    <BottomSheet type="full" meta={A.start ? <Elapsed start={A.start} /> : undefined}
      title={`${A.name || t('Workout')} · ${tn('{0} exercise', '{0} exercises', count)}`}>
      <MapDrawer sections={sections} hint={t('Drag to reorder within a phase')} onReorder={reorder}
        movedLabel={(name, place, total) => t('Moved {0} to {1} of {2}', name, place, total)}
        addLabel={t('Add exercise')} onAdd={() => addExercise?.(cur ? partOf(cur) : null)}
        supersetLabel={unit.length ? t('Unpair') : pairable ? t('Make superset') : undefined}
        onSuperset={() => (unit.length ? unpairAt(A.cur) : pairWithNext(A.cur))}
        footer={<div className="g-mp-foot">
          {unit.length > 0 && <Button variant="ghost" icon="timer" onClick={openSuperset}>{t('Superset settings')}</Button>}
          <Button variant="ghost" icon="gear" onClick={() => openOptions({ addExercise })}>{t('Workout options')}</Button>
        </div>} />
    </BottomSheet>
  )
}

/** Opens the map. `addExercise(part)` opens Add exercise (drawers.js). */
export function openMap({ addExercise } = {}) {
  if (!useStore.getState().S.active) return
  openDs(close => <MapHost close={close} addExercise={addExercise} />)
}

/* ------------------------------------------------------------------- options -- */

function OptionsHost({ close, markAllDone, addExercise }) {
  const S = useStore(s => s.S)
  const A = S.active
  const [step, setStep] = useState('options')
  useEffect(() => { if (!A) close() }, [!A])
  if (!A) return null

  const editing = !!A.editingWorkoutId
  const keepsOut = e => !!e?.rid && S.routines.some(r => r.id === e.rid && r.excludeFromProgression === true)
  const switchable = !A.entries.length || A.entries.some(e => !keepsOut(e))
  const markAll = markAllDone || (() => {
    update(s => { if (s.active) s.active.entries = markAllSetsDone(s.active.entries) }, true)
    finishSheet()
  })

  if (step === 'rest') {
    return <BottomSheet type="auto" title={t('Rest timer')}>
      <RestTimerStep back={t('Workout settings')} onBack={() => setStep('settings')} />
    </BottomSheet>
  }
  if (step === 'settings') {
    return <BottomSheet type="auto" title={t('Workout settings')}>
      <div className="g-ws-step">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => setStep('options')}>{t('Options')}</Button>
        <WorkoutSettingsBody onRest={() => setStep('rest')} />
      </div>
    </BottomSheet>
  }
  return (
    <BottomSheet type="auto" title={t('Workout options')}>
      <div className="g-ws-body">
        <DetailRow icon="chevronsUpDown" title={t('Reorder exercises')} sub={t('Drag in the map, any phase')}
          onClick={() => openMap({ addExercise })} />
        <DetailRow icon="pencil" title={t('Rename workout')} sub={A.name || undefined} onClick={() => renameWorkoutSheet()} />
        <DetailRow icon="note" title={t('Session note')} sub={A.note || t('How it went, what to change')} onClick={() => sessionNoteSheet()} />
        {!editing && <DetailRow icon="clipboard" title={t('Add routine')} sub={t('Bring another routine into this session')}
          onClick={() => addRoutineToSessionSheet()} />}
        <DetailRow icon="gear" title={t('Workout settings')} sub={t('Next exercise, rest, sound, plates')} onClick={() => setStep('settings')} />
        {A.backfill && A.entries.length > 0 && <DetailRow icon="checkCircle" title={t('Mark all sets done')} onClick={() => markAll()} />}
        {switchable && <Switch label={t('Don’t count for progression')} description={t('Every exercise in this workout')}
          checked={sessionNoProg(A)} onChange={on => update(s => setSessionNoProg(s.active, on, keepsOut))} />}
        {!editing && <DetailRow icon="trash" danger title={t('Discard workout')} sub={t('Asks first, then Undo')} onClick={() => discardSheet()} />}
      </div>
    </BottomSheet>
  )
}

/** Opens Workout options. `markAllDone` is the hook's, which re-baselines the progress marks. */
export function openOptions({ markAllDone, addExercise } = {}) {
  if (!useStore.getState().S.active) return
  openDs(close => <OptionsHost close={close} markAllDone={markAllDone} addExercise={addExercise} />)
}
