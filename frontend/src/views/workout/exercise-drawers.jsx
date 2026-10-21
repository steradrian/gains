// The running workout's exercise drawers (PR-03 drawers-M2): Set edit (W1.12), How to with its Swap
// step (W1.14, W1.15, W1.33, W1.34, W1.43), Plate loading (W1.25), Time left (W1.4) and the
// exercise's own rest. Light DS drawers on BottomSheet; every write goes through workout-actions.js.
// Each drawer follows its exercise by id, as it was when the drawer opened, and closes when that
// exercise (or the workout) is gone. One drawer at a time: a row that opens another sheet closes
// this one first, and a row that leaves the workout hands the drawer's history entry on.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exOr, allExercises, figureOf, searchExercises } from '../../lib/exercises.js'
import { modeOf, isPerSide, canBeWarmup, setSpanAt, effortOf, EFFORT, lastEntryFor, NOTE_MAX } from '../../lib/history.js'
import { fmtNum, fmtDate } from '../../lib/format.js'
import { t, tn, exerciseNameFor, exerciseNameClass } from '../../lib/i18n.js'
import { closeThenNav } from '../../lib/nav.js'
import { REST_MAX, fmtRest } from '../../lib/duration.js'
import { sessionHistory } from '../../lib/backfill.js'
import { activeProfile } from '../../lib/equipment.js'
import { loadKindFor, baseWeightFor, inventoryFor, rowLoad } from '../../lib/plates.js'
import { isWarmupRow, isFailureSet, isDropSet, isRestPauseSet, isSideSet, dropsOf, clustersOf } from '../../lib/workout-model.js'
import { partOf } from '../../lib/workout-parts.js'
import { MUSCLE_NAME } from '../../lib/muscles.js'
import { exerciseHistory, bestSetFor } from '../../lib/exercise-history.js'
import { plannedConfigOf } from '../../lib/session-start.js'
import { routineSlotIndex } from '../../lib/routines.js'
import { weightIncrement } from '../../lib/progression.js'
import DurationWheel from '../../components/DurationWheel.jsx'
import { applyRestLeft } from '../../components/RestTimer.jsx'
import ExerciseStillRow from '../../components/ExerciseStillRow.jsx'
import Icon from '../../components/Icon.jsx'
import BigStepper from '../../ds/BigStepper.jsx'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import ChipGroup from '../../ds/ChipGroup.jsx'
import DetailRow from '../../ds/DetailRow.jsx'
import EffortChips from '../../ds/EffortChips.jsx'
import IconButton from '../../ds/IconButton.jsx'
import PlateBar from '../../ds/PlateBar.jsx'
import RadioRow from '../../ds/RadioRow.jsx'
import StatTiles from '../../ds/StatTiles.jsx'
import Switch from '../../ds/Switch.jsx'
import { exConfigSheet, exerciseHistorySheet, exerciseNoteSheet, barWeightSheet } from '../../sheets.jsx'
import { ExerciseHowTo } from '../../sheets/exercise.jsx'
import { replaceCandidates, lastDid } from '../../sheets/exercise-swap.jsx'
import { setFields, setText, sessionLine, EFFORT_OPTIONS } from './workout-view.js'
import { changeSetField } from './set-field-change.js'
import {
  setNumberAt, setFieldAt, setEffortAt, toggleWarmupRowAt, toggleFailureAt, addDropAt, addBurstAt, removeDropOf, removeBurstOf,
  setDropFieldAt, setBurstAt, copySetAt, removeSetAt, removeExerciseWithUndo, setEntryPart,
  addWarmupAt, setNoProgAt, routineKeepsOut, routineUpdateAt, setEntryRestAt, applyExerciseSettingsAt, swapEntryWithUndo,
} from './workout-actions.js'
import './exercise-drawers.css'

const openDs = render => useUI.getState().openSheet(render, { variant: 'ds' })
const SHOWN = 20

// The entry the drawer was opened on, followed by its id when the list moved under it; -1 when it is gone.
function useEntryAt(at) {
  const S = useStore(s => s.S)
  const A = S.active
  const idx = !A || A.id !== at.activeId ? -1
    : A.entries?.[at.idx]?.id === at.entryId ? at.idx
      : (A.entries || []).findIndex(e => e.id === at.entryId)
  return { S, A, idx, entry: idx >= 0 ? A.entries[idx] : null }
}
// Closes the drawer once what it shows is gone.
function useCloseWhenGone(gone, close) {
  useEffect(() => { if (gone) close() }, [gone])
}
const openedAt = idx => {
  const A = useStore.getState().S.active
  const entry = A?.entries?.[idx]
  return entry ? { activeId: A.id, idx, entryId: entry.id } : null
}
const cfgOf = entry => ({ ...(entry.target || {}), id: entry.id })
const partLabel = part => (part === 'warmup' ? t('Warm-up') : part === 'cooldown' ? t('Cool-down') : t('Workout'))

/* ---------------------------------------------------------------- Set edit (W1.12) -- */

// What the same set did last time: the row at the same place among the warm-ups or the work sets
// of the exercise's latest logged session, or null.
function lastRowFor(S, entry, i, side) {
  const s = entry.sets[i]
  const warm = isWarmupRow(s)
  const last = lastEntryFor(sessionHistory(S), entry.id, entry.rid)
  const k = entry.sets.filter(x => isWarmupRow(x) === warm).indexOf(s)
  const row = last?.sets?.filter(x => isWarmupRow(x) === warm && x.done)[k]
  if (!row) return null
  return side && row.sides ? row.sides[side] || null : row
}

// A field of setFields() as a BigStepper: the board's names (Weight, Reps), the unit after the
// number, and a hint only from what the data says (the step, the plan, last time).
function fieldStepper(S, entry, i, side, f, last) {
  const unit = S.unit
  const warm = isWarmupRow(entry.sets[i])
  if (f.f === 'w') {
    const lastW = last && Number(last.w) > 0 ? fmtNum(last.w) + ' ' + unit : null
    return {
      label: f.label === unit ? t('Weight') : f.label, unit,
      hint: [!f.owned && t('Steps of {0}', fmtNum(f.step) + ' ' + unit), lastW && t('last time {0}', lastW)].filter(Boolean).join(' · ') || null,
    }
  }
  if (f.f === 'r') {
    const plan = !warm && Number(entry.target?.reps) > 0 ? entry.target.reps : null
    return {
      label: t('Reps'), unit: t('reps'),
      hint: [plan && t('Plan {0}', plan), last?.r != null && t('last time {0}', last.r)].filter(Boolean).join(' · ') || null,
    }
  }
  if (f.f === 'sec') return { label: t('Seconds'), unit: t('sec'), hint: null }
  if (f.f === 'min') return { label: t('Minutes'), unit: t('min'), hint: null }
  if (f.f === 'speed') return { label: t('Speed'), unit: f.label, hint: null }
  return { label: t('Incline'), unit: '%', hint: null }
}

function SetEditDrawer({ at, close }) {
  const { S, A, idx, entry } = useEntryAt(at)
  const [i, setI] = useState(at.i)
  const s = entry?.sets?.[i] || null
  const [note, setNote] = useState(s?.note || '')
  useCloseWhenGone(!s, close)
  if (!s) return null

  const cfg = cfgOf(entry)
  const mode = modeOf(cfg)
  const perSide = isPerSide(cfg)
  const warm = isWarmupRow(s)
  const editing = !!A.editingWorkoutId
  const name = exerciseNameFor(exOr(entry.id))
  const n = setNumberAt(entry.sets, i)
  const sideWord = s.side === 'L' ? t('Left') : s.side === 'R' ? t('Right') : null
  const title = [warm ? t('Warm-up') : t('Set {0}', n), sideWord, name].filter(Boolean).join(' · ')
  const sides = isSideSet(s) ? ['L', 'R'] : [null]
  const kind = effortOf(S)
  const effort = EFFORT[kind] && mode === 'reps' && !warm ? EFFORT[kind] : null
  const canWarm = mode === 'reps' && (warm ? !perSide : canBeWarmup(s) && entry.sets.some((x, j) => j !== i && !isWarmupRow(x)))
  const canDrop = !warm && mode === 'reps' && !isRestPauseSet(s)
  const canBurst = !warm && mode === 'reps' && !isDropSet(s)
  const removable = editing || entry.sets.length > setSpanAt(entry.sets, i)[1]

  const flipWarm = on => {
    // The row moves to the edge of the warm-ups: it lands after the other warm-up rows.
    const to = entry.sets.filter((x, j) => j !== i && isWarmupRow(x)).length
    toggleWarmupRowAt(idx, i, on)
    setI(to)
  }
  const save = () => {
    const text = note.trim().slice(0, NOTE_MAX)
    if (text !== (s.note || '')) setFieldAt(idx, i, 'note', text || null)
    close()
  }
  const remove = () => { close(); removeSetAt(idx, i, { editing }) }
  const copy = () => { close(); copySetAt(idx, i) }
  const sideTitle = side => (side === 'L' ? t('Left side') : t('Right side'))
  const rowOf = side => (side ? s.sides[side] : s)

  return (
    <BottomSheet type="auto" title={title}
      footer={<div className="wkd-foot">
        <Button variant="secondary" icon="trash" disabled={!removable} onClick={remove}>{t('Remove')}</Button>
        <Button onClick={save}>{warm ? t('Save warm-up') : t('Save set {0}', n)}</Button>
      </div>}>
      <div className="wkd-body">
        {sides.map(side => {
          const last = lastRowFor(S, entry, i, side)
          return (
            <div key={side || 'set'} className="wkd-group" role={side ? 'group' : undefined} aria-label={side ? sideTitle(side) : undefined}>
              {side && <p className="wkd-h" aria-hidden="true">{sideTitle(side)}</p>}
              {setFields(S, entry, i, side).fields.map(f => {
                const look = fieldStepper(S, entry, i, side, f, last)
                return <BigStepper key={f.f} label={look.label} value={f.value} step={f.step} decimals={f.decimals} unit={look.unit} hint={look.hint}
                  lessLabel={t('Less {0}', look.label)} moreLabel={t('More {0}', look.label)} onChange={v => changeSetField(idx, i, f, v)} />
              })}
            </div>
          )
        })}
        {effort && <EffortChips label={t('How hard was that set?')} hint={kind === 'rir' ? t('Reps left in the tank') : null}
          options={EFFORT_OPTIONS[kind]()} value={s[effort.f] ?? null} onChange={v => setEffortAt(idx, i, effort.f, v)} />}
        {canWarm && <Switch checked={warm} onChange={flipWarm} label={t('Make it a warm-up set')} description={t('Left out of volume and records')} />}
        {!warm && mode !== 'cardio' && <Switch checked={isFailureSet(s)} onChange={() => toggleFailureAt(idx, i)}
          label={t('Taken to failure')} description={t('Nothing left in the tank')} />}

        {sides.map(side => dropsOf(rowOf(side)).map((d, di) => (
          <div key={'d' + (side || '') + di} className="wkd-group">
            <div className="wkd-extra-h">
              <span>{[side && sideTitle(side), t('Drop {0}', di + 1)].filter(Boolean).join(' · ')}</span>
              {!side && <IconButton icon="xmark" tone="tonal" label={t('Remove drop {0}', di + 1)} onClick={() => removeDropOf(idx, i, di)} />}
            </div>
            <BigStepper label={t('Weight')} value={Number(d.w) || 0} step={weightIncrement(cfg, S.unit)} unit={S.unit}
              lessLabel={t('Less {0}', t('Weight'))} moreLabel={t('More {0}', t('Weight'))} onChange={v => setDropFieldAt(idx, i, di, 'w', v, side || undefined)} />
            <BigStepper label={t('Reps')} value={Number(d.r) || 0} unit={t('reps')}
              lessLabel={t('Less {0}', t('Reps'))} moreLabel={t('More {0}', t('Reps'))} onChange={v => setDropFieldAt(idx, i, di, 'r', v, side || undefined)} />
          </div>
        )))}
        {sides.map(side => clustersOf(rowOf(side)).map((c, ci) => (
          <div key={'c' + (side || '') + ci} className="wkd-group">
            <div className="wkd-extra-h">
              <span>{[side && sideTitle(side), t('Burst {0}', ci + 1)].filter(Boolean).join(' · ')}</span>
              {!side && <IconButton icon="xmark" tone="tonal" label={t('Remove burst {0}', ci + 1)} onClick={() => removeBurstOf(idx, i, ci)} />}
            </div>
            <BigStepper label={t('Reps')} value={Number(c.r) || 0} unit={t('reps')}
              lessLabel={t('Less {0}', t('Reps'))} moreLabel={t('More {0}', t('Reps'))} onChange={v => setBurstAt(idx, i, ci, v, side || undefined)} />
          </div>
        )))}

        <div className="g-xd-rows">
          {canDrop && <DetailRow icon="arrowDown" title={t('Drop set')} sub={t('+ Drop')} onClick={() => addDropAt(idx, i)} />}
          {canBurst && <DetailRow icon="bolt" title={t('Rest-pause burst')} sub={t('+ Burst')} onClick={() => addBurstAt(idx, i)} />}
          <DetailRow icon="copy" title={t('Copy this set')} sub={t('One more like this one, right below it')} onClick={copy} />
        </div>
        <label className="wkd-note">
          <span>{t('Set note')}</span>
          <textarea rows={2} maxLength={NOTE_MAX} value={note} placeholder={t('Anything specific to remember')} onChange={e => setNote(e.target.value)} />
        </label>
      </div>
    </BottomSheet>
  )
}
/** Opens Set edit for set `i` of the exercise at `idx`. */
export function openSetEdit(idx, i) {
  const at = openedAt(idx)
  if (!at || !useStore.getState().S.active.entries[idx].sets?.[i]) return
  openDs(close => <SetEditDrawer at={{ ...at, i }} close={close} />)
}

/* ------------------------------------------------------ How to and Swap (W1.14, W1.15) -- */

// "Best: 17.5 kg × 12" and "Last: 17.5 × 12 · 12 · 11, Thu 15 Oct"; for a timed hold "Held 2 × 30 s
// each side" and "Last: Thu 15 Oct". Nothing before the exercise has been logged.
function factsFor(S, entry) {
  const H = sessionHistory(S)
  const mode = modeOf(cfgOf(entry))
  const last = exerciseHistory(H, entry.id, { limit: 1 }).sessions[0]
  if (!last) return null
  if (mode === 'time') {
    const held = (last.sets || []).filter(x => x.side !== 'R')
    const sec = Math.max(0, ...(last.sets || []).map(x => Number(x.sec) || 0))
    const sided = (last.sets || []).some(x => x.side)
    return {
      best: held.length && sec ? (sided ? t('Held {0} × {1} s each side', held.length, sec) : t('Held {0} × {1} s', held.length, sec)) : null,
      last: t('Last: {0}', fmtDate(last.d, true)),
    }
  }
  const best = bestSetFor(H, entry.id, mode)
  return {
    best: best ? t('Best: {0}', setText(S, { ...entry, target: best.target || entry.target }, best.set)) : null,
    last: t('Last: {0}, {1}', sessionLine(entry.id, last.mode, last.sets, last.target, S.speedUnit), fmtDate(last.d, true)),
  }
}

// What a swap row says it did last time: "Last: 50 kg × 10", "Last: 20 reps", or "Never done".
function lastLine(S, exId) {
  const did = lastDid(S, exId)
  if (did) return t('Last: {0}', fmtNum(did.w) + ' ' + S.unit + ' × ' + fmtNum(did.r))
  const last = lastEntryFor(sessionHistory(S), exId)
  const done = (last?.sets || []).filter(x => x.done)
  if (!done.length) return t('Never done')
  const reps = Math.max(0, ...done.map(x => Number(x.r) || 0))
  if (reps > 0) return t('Last: {0}', tn('{0} rep', '{0} reps', reps))
  const sec = Math.max(0, ...done.map(x => Number(x.sec) || 0))
  if (sec > 0) return t('Last: {0}', t('{0} s', sec))
  const min = Math.max(0, ...done.map(x => Number(x.min) || 0))
  return min > 0 ? t('Last: {0}', t('{0} min', min)) : t('Done before')
}

const SWAP_CHIPS = () => [
  { value: 'same', label: t('Same muscle') },
  { value: 'cable', label: t('Cable') },
  { value: 'dumbbell', label: t('Dumbbells') },
  { value: 'machine', label: t('Machine') },
  { value: 'body weight', label: t('Bodyweight') },
]
const chipMatches = (chip, e) => chip === 'same' || (chip === 'machine' ? /machine/.test(e.eq || '') : e.eq === chip)

function SwapStep({ S, A, idx, entry, close }) {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('same')
  const [scope, setScope] = useState('session')
  const searchRef = useRef(null)
  const ex = exOr(entry.id)
  const name = exerciseNameFor(ex)
  const figure = figureOf(S)
  const routine = !A.editingWorkoutId && entry.rid ? S.routines.find(r => r.id === entry.rid) : null
  const inRoutine = routine && routineSlotIndex(routine, A.entries, idx) >= 0 ? routine : null
  const pool = q.trim()
    ? searchExercises(allExercises(S).filter(e => e.id !== entry.id && (chip !== 'same' || e.tg === ex.tg)), q)
    : replaceCandidates(S, ex)
  const list = pool.filter(e => chipMatches(chip, e)).slice(0, SHOWN)
  const logged = entry.sets.some(x => x.done)
  const pick = e => { close(); swapEntryWithUndo(idx, e, { alsoRoutine: scope === 'routine' && !!inRoutine }) }

  const head = <>
    <label className="g-lf-search">
      <Icon name="magnifier" className="g-icon" />
      <input ref={searchRef} type="search" value={q} placeholder={t('Search exercises')} aria-label={t('Search exercises')}
        enterKeyHint="search" onChange={e => setQ(e.target.value)} />
      {q && <button type="button" className="g-lf-clear" onClick={() => { setQ(''); searchRef.current?.focus() }} aria-label={t('Clear')}><Icon name="xmark" className="g-icon" /></button>}
    </label>
    <div className="wkd-chips"><ChipGroup scroll label={t('Filter')} value={chip} onChange={setChip} options={SWAP_CHIPS()} /></div>
  </>
  const footer = inRoutine && (
    <div role="radiogroup" aria-label={t('Where the swap applies')} className="wkd-scope">
      <RadioRow title={t('This workout only')} sub={t('{0} keeps {1}', inRoutine.name, name)} selected={scope === 'session'} onClick={() => setScope('session')} />
      <RadioRow title={t('Also in {0}', inRoutine.name)} sub={t('Updates the routine from next time')} selected={scope === 'routine'} onClick={() => setScope('routine')} />
    </div>
  )
  return (
    <BottomSheet type="full" title={t('Swap {0}', name)} head={head} footer={footer || undefined}>
      <div className="wkd-swap">
        {logged && <p className="wkd-line">{t('Your logged sets stay with {0}. The new exercise comes in after it.', name)}</p>}
        {list.length === 0 && <p className="g-pk-note">{t('No match')}</p>}
        {list.map((e, k) => (
          <ExerciseStillRow key={e.id} size={48} first={k === 0} ex={e} figure={figure}
            title={<i className={exerciseNameClass(e)}>{exerciseNameFor(e)}</i>} sub={[e.eq && t(e.eq), lastLine(S, e.id)].filter(Boolean).join(' · ')}
            onClick={() => pick(e)} trailing={<Icon name="swap" className="g-icon g-xrow-chev" />} />
        ))}
      </div>
    </BottomSheet>
  )
}

function HowToDrawer({ at, close }) {
  const { S, A, idx, entry } = useEntryAt(at)
  const busy = useUI(u => !!u.work)
  const [step, setStep] = useState('how')
  useCloseWhenGone(!entry, close)
  if (!entry) return null
  if (step === 'swap') return <SwapStep S={S} A={A} idx={idx} entry={entry} close={close} />

  const ex = exOr(entry.id)
  const mode = modeOf(cfgOf(entry))
  const part = partOf(entry)
  const first = !lastEntryFor(sessionHistory(S), entry.id)
  const facts = factsFor(S, entry)
  const update = routineUpdateAt(idx)
  const lastTime = exerciseHistory(sessionHistory(S), entry.id, { limit: 1 }).sessions[0]
  const muscle = ex.tg ? t(MUSCLE_NAME[ex.tg] || ex.tg) : null
  const tags = [
    (mode === 'time' || ex.eq) && { key: 'eq', label: mode === 'time' ? t('Timed') : t(ex.eq) },
    muscle && { key: 'muscle', label: muscle },
    part !== 'main' && { key: 'part', label: partLabel(part), tone: 'accent' },
  ].filter(Boolean)
  const intro = (first || part === 'warmup') && (
    <div className="wkd-intro">
      {first && <p>{t('First time with this one. Start light: today’s numbers become your baseline.')}</p>}
      {part === 'warmup' && <p>{t('A warm-up: it counts in your history and muscles, not for new bests.')}</p>}
    </div>
  )
  const then = fn => () => { close(); fn() }

  return (
    <BottomSheet type="full" title={<span className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</span>}
      footer={<div className="wkd-foot">
        <Button variant="secondary" icon="swap" disabled={busy} onClick={() => setStep('swap')}>{t('Swap')}</Button>
        <Button onClick={close}>{t('Back to set')}</Button>
      </div>}>
      <div className="wkd-body">
        <ExerciseHowTo ex={ex} tags={tags} intro={intro} />
        {entry.note
          ? <div className="wkd-pinned">
            <p>{entry.note}</p>
            <Button variant="ghost" size="sm" aria-label={t('Edit note')} onClick={then(() => exerciseNoteSheet(idx))}>{t('Edit')}</Button>
          </div>
          : null}
        {facts && (facts.best || facts.last) && <p className="wkd-facts">
          {facts.best && <b>{facts.best}</b>}
          {facts.last && <span>{facts.last}</span>}
        </p>}
        <div className="g-xd-rows">
          <DetailRow icon="slider" title={t('Exercise settings')} sub={t('Sets, reps, rest, progression for this exercise')} onClick={then(() => exerciseSettingsSheet(idx))} />
          {!entry.note && <DetailRow icon="note" title={t('Add note')} onClick={then(() => exerciseNoteSheet(idx))} />}
          {mode !== 'cardio' && <DetailRow icon="sunrise" title={t('Add a warm-up set')} onClick={then(() => addWarmupAt(idx))} />}
          {!routineKeepsOut(S, entry) && <Switch checked={entry.noProg === true} onChange={on => setNoProgAt(idx, on)}
            label={t('Don’t count for progression')} description={t('This exercise, this session only')} />}
          <DetailRow icon="history" title={t('History')} sub={lastTime ? t('Last time') + ' ' + fmtDate(lastTime.d) : undefined}
            onClick={then(() => exerciseHistorySheet(entry.id))} />
          {update && <DetailRow icon="clipboard" title={t('Update {0}', update.routine.name)} sub={update.sub} onClick={then(update.run)} />}
          {!busy && <DetailRow icon="trash" danger title={t('Remove from this workout')} sub={t('Undo for 8 s')} onClick={then(() => removeExerciseWithUndo(idx))} />}
        </div>
      </div>
    </BottomSheet>
  )
}

/** Opens How to for the exercise at `idx`. */
export function openHowTo(idx) {
  const at = openedAt(idx)
  if (at) openDs(close => <HowToDrawer at={at} close={close} />)
}

/**
 * Exercise settings for the exercise at `idx`, from inside the workout: the routine editor's sheet
 * at the plan's sets and reps, with "Part of the workout". A part changed there moves the exercise
 * once the settings are saved (setEntryPart).
 */
export function exerciseSettingsSheet(idx) {
  const S = useStore.getState().S
  const entry = S.active?.entries?.[idx]
  if (!entry) return
  const at = { activeId: S.active.id, entryId: entry.id, entryCount: S.active.entries.length }
  const routine = S.routines.find(r => r.id === entry.rid)
  // Opens at the plan's sets and reps, so saving it unchanged rebuilds the rows it has.
  const opened = plannedConfigOf(entry)
  let part = partOf(entry)
  exConfigSheet(exOr(entry.id), opened, cfg => {
    if (!applyExerciseSettingsAt(idx, cfg, opened, at)) return
    if (part !== partOf(useStore.getState().S.active.entries[idx])) setEntryPart(idx, part)
  }, null, routine, null, null, undefined, { part, onPartChange: p => { part = p } })
}

/* ------------------------------------------------------------- Plate loading (W1.25) -- */

// The set the plate line belongs to: the first one still to do, else the last.
const loadSetOf = entry => entry.sets.find(x => !x.done && !isWarmupRow(x)) || entry.sets.find(x => !x.done) || entry.sets[entry.sets.length - 1]
const loadOf = (S, entry) => {
  const s = loadSetOf(entry)
  const w = Number(s?.w) || 0
  const base = baseWeightFor(S, entry.id)
  return { w, base, load: rowLoad(loadKindFor(S, cfgOf(entry)), w, base, inventoryFor(S)) }
}

function PlatesDrawer({ at, close }) {
  const { S, entry } = useEntryAt(at)
  useCloseWhenGone(!entry, close)
  if (!entry) return null
  const { w, base, load } = loadOf(S, entry)
  if (!load) return null
  const unit = S.unit
  const kg = v => fmtNum(v) + ' ' + unit
  const pairs = load.kind === 'pairs'
  const total = kg(w)
  const spoken = load.barOnly ? t('{0}: just the bar', total)
    : pairs ? t('{0}: bar plus {1} each side', total, load.plates.map(fmtNum).join(' ' + t('and') + ' '))
      : t('{0}: {1} loaded', total, load.plates.map(fmtNum).join(' ' + t('and') + ' '))
  const caption = load.barOnly ? t('Just the bar')
    : pairs ? t('{0} on each side', load.plates.map(kg).join(' ')) : t('{0} in total', load.plates.map(kg).join(' '))
  const tiles = pairs
    ? [{ label: t('Total'), value: total }, { label: t('Bar'), value: kg(base) }, { label: t('Each side'), value: kg(load.perSide) }]
    : [{ label: t('Total'), value: total }, base > 0 && { label: t('Base'), value: kg(base) }, { label: t('Plates'), value: kg(load.perSide) }].filter(Boolean)
  const profile = activeProfile(S)
  const ex = exOr(entry.id)
  return (
    <BottomSheet type="auto" title={t('Load {0}', total)} head={<p className="wkd-sub">{exerciseNameFor(ex)}</p>}>
      <div className="wkd-body">
        <PlateBar plates={load.plates} unit={unit} label={spoken}>{caption}</PlateBar>
        <StatTiles items={tiles} />
        {load.missing > 0 && <p className="wkd-line">{t('Your plates come {0} short of this.', kg(load.missing * (pairs ? 2 : 1)))}</p>}
        <p className="wkd-line">
          {profile ? t('From your plates at {0}.', profile.name) : t('From your plates.')}{' '}
          <button type="button" className="wkd-link" onClick={() => closeThenNav(close, '/me/equipment')}>{t('Change them in Gym setup.')}</button>
        </p>
        <div className="g-xd-rows">
          <DetailRow icon="plate" title={t('Bar and loading')} sub={t('What the bar weighs and how this exercise is loaded')}
            onClick={() => { close(); barWeightSheet(entry.id, cfgOf(entry)) }} />
        </div>
      </div>
    </BottomSheet>
  )
}

/** Opens Plate loading for the exercise at `idx`; one that loads no plates opens Bar and loading. */
export function openPlates(idx) {
  const at = openedAt(idx)
  if (!at) return
  const S = useStore.getState().S
  const entry = S.active.entries[idx]
  if (!loadOf(S, entry).load) { barWeightSheet(entry.id, cfgOf(entry)); return }
  openDs(close => <PlatesDrawer at={at} close={close} />)
}

/* ------------------------------------------------------ Time left (W1.4) and the exercise's rest -- */

function RestWheelDrawer({ opened, close }) {
  const running = useUI(u => !!u.timer)
  const [v, setV] = useState(opened)
  const read = useRef(null)
  useCloseWhenGone(!running, close)
  const done = () => { const now = read.current ? read.current() : v; close(); applyRestLeft(now, opened) }
  const skip = () => { close(); useUI.getState().stopRest() }
  return (
    <BottomSheet type="auto" title={t('Time left')}
      footer={<div className="g-wd-foot">
        <Button variant="secondary" onClick={skip}>{t('Skip')}</Button>
        <Button onClick={done}>{t('Done')}</Button>
      </div>}>
      <DurationWheel variant="ds" value={v} onChange={setV} max={REST_MAX} off={t('Skip')} readRef={read} />
      <p className="g-wd-hint">{t('Scroll to 0:00 to end the rest now.')}</p>
    </BottomSheet>
  )
}

/** Opens Time left on the running rest; 0:00 on Done ends it (applyRestLeft). */
export function openRestWheel() {
  const tm = useUI.getState().timer
  if (!tm) return
  const opened = tm.ready ? 0 : Math.min(tm.left, REST_MAX)
  openDs(close => <RestWheelDrawer opened={opened} close={close} />)
}

function ExerciseRestDrawer({ at, close }) {
  const { S, idx, entry } = useEntryAt(at)
  const [v, setV] = useState(entry?.target?.restSec > 0 ? entry.target.restSec : 0)
  const read = useRef(null)
  useCloseWhenGone(!entry, close)
  if (!entry) return null
  const done = () => {
    const now = read.current ? read.current() : v
    close()
    setEntryRestAt(idx, now, { activeId: at.activeId, entryId: at.entryId })
  }
  return (
    <BottomSheet type="auto" title={t('Rest for this exercise')}
      footer={<Button block onClick={done}>{t('Done')}</Button>}>
      <DurationWheel variant="ds" value={v} onChange={setV} max={REST_MAX} off={t('Default ({0})', fmtRest(S.restSec))} readRef={read} />
      <p className="g-wd-hint">{t('Rest after each set of this exercise. 0:00 means your default rest.')}</p>
    </BottomSheet>
  )
}

/** Opens the exercise's own rest, where 0:00 means the default rest applies. */
export function openExerciseRest(idx) {
  const at = openedAt(idx)
  if (at) openDs(close => <ExerciseRestDrawer at={at} close={close} />)
}
