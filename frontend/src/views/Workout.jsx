import { Fragment, useEffect, useId, useRef, useState } from 'react'
import SwipeCards from '../components/SwipeCards.jsx'
import SwipeRow from '../components/SwipeRow.jsx'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { back } from '../lib/use-tab-nav.js'
import { workoutControls } from '../lib/workout-controls.js'
import { useUI } from '../store/useUI.js'
import { exOr, betterWeight } from '../lib/exercises.js'
import { usesBar } from '../lib/bar.js'
import { loadKindFor, baseWeightFor, inventoryFor, rowLoad, sameLoad, plateDelta, dropGrid } from '../lib/plates.js'
import { lastEntryFor, bestWeightFor, setsDoneActive, setUnitsTotal, supersetUnits, unitOf, setLabel, modeOf, isBw, isPerSide, repStep, EFFORT, effortOf, stepEffort, canBeWarmup, setSpanAt, pinnedNoteFor, exNoteFor, setsRepsOf } from '../lib/history.js'
import { fmtNum, fmtPlate, exerciseNameText, fmtDate, fmtDaysAgo, todayISO, exCount, DAYN } from '../lib/format.js'
import { speedUnitOf, toSpeed, fromSpeed } from '../lib/speed.js'
import { clampIncline, hasIncline, inclineFits, INCLINE_STEP } from '../lib/incline.js'
import { t, tn, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { maxRecordAt, isPyramid, pyramidLabel } from '../lib/pyramid.js'
import Media from '../components/Media.jsx'
import WorkoutScrollAnchor from '../components/WorkoutScrollAnchor.jsx'
import WorkoutChips from '../components/WorkoutChips.jsx'
import { supersetMeta } from '../lib/superset-meta.js'
import WorkoutThumb, { hasWorkoutMedia } from '../components/WorkoutThumb.jsx'
import { workoutSettingsSheet } from '../components/WorkoutSettingsSheet.jsx'
import { fmtRest } from '../lib/duration.js'
import { startFlow, exerciseDetailSheet, finishWorkout, exitWorkoutEdit, confirmSheet, exerciseNoteSheet, sessionNoteSheet, renameWorkoutSheet, barWeightSheet, menuSheet, effortPickerSheet, exerciseHistorySheet, addRoutineToSessionSheet, finishWorkoutSheet } from '../sheets.jsx'
import { afterScrollRestore, scrollRestorePending } from '../components/Modals.jsx'
import { effortColor, effortInk } from '../lib/effort.js'
import Elapsed from '../components/Elapsed.jsx'
import { useStartChoices } from '../components/use-start-choices.js'
import Icon from '../components/Icon.jsx'
import { Button, Check, NumberField } from '../components/ui.jsx'
import { Card, Chip, EmptyState, SectionTitle, Stat, Tag } from '../components/blocks.jsx'
import { Inline, Spacer } from '../components/layout.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import { cx } from '../lib/ui-kit.js'
import { weightIncrement } from '../lib/progression.js'
import { progressionGuidance } from '../lib/progression-copy.js'
import { sessionNoProg } from '../lib/session-noprog.js'
import { glyphOf } from '../lib/glyphs.js'
import { sessionHistory } from '../lib/backfill.js'
import { bestSetFor } from '../lib/exercise-history.js'
import { isWarmupRow, isFailureSet, isDropSet, isRestPauseSet, dropsOf, clustersOf, isSideSet } from '../lib/workout-model.js'
import { canMoveActiveWorkoutUnit, canMoveActiveWorkoutEntry } from '../lib/active-workout-order.js'
import { reducedMotion } from '../lib/reduced-motion.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import FocusView from './FocusView.jsx'
import { entryDbLoad, bellsIn, ownedWeightsFor } from '../lib/dumbbells.js'
import { useWorkout } from './workout/use-workout.js'
import { discardWorkoutConfirm } from './workout/drawers.js'
import { setNumberAt, deleteActiveSet, undoDeleteSet, copyActiveSet, removeActiveExercise, stepLoad as stepLoadOf, toggleWarmupRowAt, toggleFailureAt as toggleFailureOf, addDropAt, addBurstAt, removeDropOf, removeBurstOf, setDropFieldAt, setBurstAt, setSideFieldAt } from './workout/workout-actions.js'

/* ---------- start chooser (no active workout) ---------- */
export function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { today, others } = useStartChoices()
  const { ids: todayIds, routines: todayRoutines, name: todayName, rescheduled: todayOvr } = today
  return <div>
    <div className="hdr"><div><h1>{t('Start workout')}</h1><div className="sub">{t(DAYN[new Date().getDay()])} · {todayRoutines.length ? t('today is {0}', todayName) : t('rest day, but no one’s stopping you')}</div></div></div>
    {todayRoutines.length > 0 && <Card>
      <h2 className="accent">{t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}</h2>
      <Inline justify="between" className="mb-6">
        <div><Stat value={todayName} /><div className="muted small">{exCount(todayRoutines.reduce((n, r) => n + r.ex.length, 0))}</div></div>
        <span className="lrow-i fs-title2" style={{ width: 38, height: 38, borderRadius: 9 }}><Icon name={glyphOf(todayRoutines[0].emoji)} /></span>
      </Inline>
      <Button variant="primary" icon="play" onClick={() => startFlow(todayIds)}>{t('Start {0}', todayName)}</Button>
    </Card>}
    {others.length > 0 && <><SectionTitle>{t('Other routines')}</SectionTitle>
      <div className="list">{others.map(r => <div key={r.id} className="item" onClick={() => startFlow([r.id])}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <Tag tone="acc">{t('Start')}</Tag></div>)}</div></>}
    <Spacer size={7} />
    <Button icon="shuffle" onClick={() => startFlow([])}>{t('Freestyle workout (pick as you go)')}</Button>
    {!S.routines.length && <><Spacer size={5} /><Button variant="primary" onClick={() => nav('/train/routines')}>{t('Build a plan first')}</Button></>}
  </div>
}


// A set-row column's number as it is shown. Most columns show what is stored; one with a `view`
// (cardio speed, stored in km/h) converts it for the screen.
const viewOf = (col, value) => (col.view && value != null && value !== '' ? col.view(value) : value)

// Arabic and Hebrew letters, the presentation forms included. A set summary with one in it is a
// per-side set in Arabic ("يسار 15×8 · يمين 15×7"): forced left to right, its side words stood
// on the wrong side of their numbers and the numbers after them turned round (8×15).
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/

/* ---------- one exercise block (reps: weight×reps · time: a held duration · cardio: duration+speed) ---------- */
// `compact` shrinks the block for a superset member; `dense` (compact view) goes further and
// drops everything that is not a set you are logging — media, tag chips, the note lines, the
// "last time" recap and the progression line — leaving the name, the ⋯ menu, the one-line plan
// the rows are measured against, and the sets.
// Nothing dropped is lost: it is all still on the ⋯ menu, or one ⋮ switch back to list/cards.

function ExerciseBlock({ entryIdx, compact, dense, editing, onToggle, onToggleSide, onField, onAddSet, onRemoveSet, onAddWarmup, onRemoveSetAt, onCopySetAt, onStartTimed, onPairPrev, onPairNext, onSetRowRef, onProgressionSettings, onRest, onNoProg, routineUpdate, onSwap, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onRemoveExercise, busy }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const working = useUI(s => s.work)
  const restEnds = useUI(s => s.timer?.endsAt)
  const swipeHint = useUI(s => (s.swipeHint?.idx === entryIdx ? s.swipeHint : null))
  const setFlash = useUI(s => (s.setFlash?.idx === entryIdx ? s.setFlash : null))
  const optsId = useId()
  const entry = S.active.entries[entryIdx]
  // Drops/bursts mutate the row in place — same card, not a new set with its own long rest.
  // A planned exercise (see the exercise's "Intensifier" config) arrives with these already
  // filled in by applyIntensifierPlan; these only add/edit/remove entries live from here on.
  // Every mutation lives in views/workout/workout-actions.js, bound here to this exercise.
  const setPhaseAt = (i, warm) => toggleWarmupRowAt(entryIdx, i, warm)
  const toggleFailureAt = i => toggleFailureOf(entryIdx, i)
  const addDropRow = i => addDropAt(entryIdx, i)
  const addBurstRow = i => addBurstAt(entryIdx, i)
  // Per-side edits (issue #60). The done tick goes through onToggleSide → toggle() instead, so
  // ticking a side still fires the rest timer / auto-advance / workout-complete flow.
  const setSide = (i, side, field, v) => setSideFieldAt(entryIdx, i, side, field, v)
  const removeDrop = (i, di) => removeDropOf(entryIdx, i, di)
  const removeCluster = (i, ci) => removeBurstOf(entryIdx, i, ci)
  const setDropField = (i, di, field, v, side) => setDropFieldAt(entryIdx, i, di, field, v, side)
  const setClusterField = (i, ci, v, side) => setBurstAt(entryIdx, i, ci, v, side)
  const ex = exOr(entry.id)
  const thumb = !dense && S.gifSize === 'mini' && hasWorkoutMedia(ex)
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const cardio = mode === 'cardio'
  const timed = mode === 'time'
  // The history the rows were built from: before the session's day when it is logged into the
  // past (sessionHistory), so "last time", the best set and the Best chip are not from later on.
  const H = sessionHistory(S)
  // The routine's own last session of this exercise (or any, for a routine that has none), the
  // same one the rows and the progression line were built from (#216).
  const last = lastEntryFor(H, entry.id, entry.rid)
  const standingNote = exNoteFor(S, entry.id)
  // Only worth surfacing while there is still work left: once the exercise is finished, a note
  // telling you what to do in it is behind you, and the block is already long.
  const pinnedNote = entry.sets.some(s => !s.done) ? pinnedNoteFor(S, entry.id) : null
  // The number is the heaviest logged set, or the working weight you kept.
  // On an assistance machine the best is the least help, and a 0 on either side means "nothing
  // logged" rather than a record (issue #232).
  // Read in the meaning this session logs a dumbbell weight in (lib/dumbbells.js), so a past
  // "40 total" is not a record a "22 each" set has to beat.
  const meaning = entryDbLoad(entry)
  const bestHist = bestWeightFor(H, entry.id, meaning)
  const bestKept = (H.exWeights[entry.id] || {}).w || 0
  const best = cardio ? 0
    : bestHist > 0 && bestKept > 0 ? betterWeight(entry.id, bestHist, bestKept) : Math.max(bestHist, bestKept)
  // What the progression policy decided for this session, and why (issue #17). Computed when
  // the session was built so the reason matches the numbers already in the rows.
  const plan = entry.plan
  const guidance = progressionGuidance(plan)
  // The plan this exercise was built from (issue #275), on one quiet line in every view — the
  // routine's "2 × 10" is the thing the rows are measured against. When today's rows open
  // somewhere else, the same line says so: progression moved the sets or reps (a bodyweight
  // climb, a deload, an added set), or they carry last session's reps ("Your last session").
  // An entry built before plans were stamped, and a freestyle one, has no plan to show.
  const planned = entry.planned && mode !== 'cardio' ? entry.planned : null
  const planLine = (() => {
    if (!planned) return null
    const today = entry.target || {}
    // A pyramid reads as its targets, as on the routine row: "12 · 8 · 6 · Max · 12", never the
    // set count times the first target (#367). Its rows are the plan; nothing moves them.
    if (isPyramid(today)) return <div className="small dim planline mb-2">{t('Plan: {0}', pyramidLabel(today.pyramid))}</div>
    const todaySets = today.sets || planned.sets || 1
    const inPlan = timed
      ? today.sec == null || today.sec === planned.sec
      : today.reps == null || (planned.repsMin > 0 ? today.reps >= planned.repsMin && today.reps <= planned.reps : today.reps === planned.reps)
    const note = todaySets !== (planned.sets || 1) || !inPlan
      ? t('today {0}', setsRepsOf({ mode, sets: todaySets, reps: today.reps, sec: today.sec }))
      : entry.carried ? t('reps from your last session') : null
    return <div className="small dim planline mb-2">
      {t('Plan: {0}', setsRepsOf({ ...planned, mode }))}{note ? ' · ' + note : ''}
    </div>
  })()
  // What the rows are held against (#173): the last time in this routine (#216), or the best set
  // of the exercise ever logged — after a bad day, "last time" puts the bad day on the screen as
  // the number to beat. Tapping the line switches between the two, and the choice is the
  // profile's (S.logRef), so every exercise and the next session follow it.
  const refBest = S.logRef === 'best'
  const ref = refBest ? bestSetFor(H, entry.id, mode, meaning) : last
  // An exercise logged before only in another mode (reps then, a hold today) has a last time but
  // no best set to hold today's rows against. The line stays and says so: gone, it took the
  // switch back to "Last time" with it, reachable then only from Settings or another card.
  // How long ago reads at a glance (#363): "3 days ago", counted from the session's own day, so a
  // workout logged into the past is not told its last time was "today". The date itself stays
  // in the hover title and in what a screen reader hears.
  const refLabel = refBest ? t('Best set') : t('Last time')
  const refAgo = ref ? fmtDaysAgo(ref.d, S.active.d || todayISO()) : ''
  const refSets = ref ? (refBest ? [ref.set] : ref.sets).map(s => setLabel(entry.id, s, ref.target, speedUnitOf(S))) : []
  const refText = ref ? `${refLabel} (${refAgo}, ${fmtDate(ref.d, true, true)}): ` + refSets.join(', ') : refBest && last ? t('Best set: nothing logged this way yet') : null
  const refAction = refBest ? t('Show last time instead') : t('Show your best set instead')
  // The button's text is the reference, which says nothing about what a tap does; its name
  // carries both, the reference first as it reads on screen, then the switch.
  const refLine = refText ? <button type="button" className="refline small dim"
    title={refAction} aria-label={`${refText}. ${refAction}`}
    onClick={() => update(s => { s.logRef = refBest ? 'last' : 'best' })}>
    {/* Each set on its own left-to-right island. In Arabic the first one followed the label's
        direction and read 8×60, while those after a Latin "RIR" read 60×8. A set that carries
        words of a right-to-left script keeps its own direction, still isolated (RTL_LETTER). */}
    <span>{ref ? <>{refLabel} (<time dateTime={ref.d} title={fmtDate(ref.d, true, true)}>{refAgo}</time>): {refSets.map((l, i) => <Fragment key={i}>{i ? ', ' : ''}<bdi dir={RTL_LETTER.test(l) ? 'auto' : 'ltr'}>{l}</bdi></Fragment>)}</> : refText}</span>
    <Icon name="history" />
  </button> : null
  // Zero added weight must stay editable: a bodyweight set can become weighted
  // later, or return to zero without losing its load control (issue #460).
  const cfg = { ...(entry.target || {}), id: entry.id }
  const bw = !cardio && isBw(cfg)
  // A unilateral exercise logs each side on its own (issue #60): work rows render as an L and an
  // R sub-row, each with its own weight/reps/effort and done tick. Warm-ups stay single.
  const perSide = mode === 'reps' && isPerSide(cfg)
  const loadStep = mode === 'reps' ? weightIncrement(cfg, S.unit) : 2.5
  // With the dumbbells you own listed (issue #376), + and − walk from bell to bell — 9, 11, 13 —
  // instead of along the increment's grid; an off-list weight goes to the nearest bell that way.
  const owned = mode === 'reps' ? ownedWeightsFor(S, cfg) : null
  const stepLoad = (v, step, dir) => stepLoadOf(v, step, dir, owned)
  // The weight column says what a dumbbell weight means when the exercise has said (#474): one
  // bell or both together. A one-arm exercise holds one bell, so its plain heading is already true.
  const bells = !bw && bellsIn(cfg) === 2 ? meaning : 'as'
  const loadCol = { f: 'w', step: loadStep, dec: true, hd: bw ? t('Added ({0})', S.unit)
    : bells === 'each' ? t('Each ({0})', S.unit) : bells === 'total' ? t('Both ({0})', S.unit) : t('Weight ({0})', S.unit) }
  // The reps column is the total in every mode, unilateral included — the stepper walks in
  // twos there so the number you land on is one you can actually split evenly.
  const repCol = { f: 'r', step: repStep(cfg), dec: false, hd: t('Reps') }
  const col1 = cardio ? { f: 'min', step: 1, dec: false, hd: t('Duration (min)') }
    : timed ? { f: 'sec', step: 5, dec: false, hd: t('Seconds') }
      : loadCol
  // Speed is stored in km/h and shown in the profile's unit (lib/speed.js): `view` turns the
  // stored number into the one on screen, `store` the one typed or stepped back into km/h.
  const speedUnit = speedUnitOf(S)
  const col2 = cardio ? { f: 'speed', step: 0.5, dec: true, hd: speedUnit === 'mph' ? t('Speed (mph)') : t('Speed (km/h)'),
    view: v => toSpeed(v, speedUnit), store: v => fromSpeed(v, speedUnit) }
    : timed ? loadCol : repCol
  // Effort (RIR or RPE, whichever the profile logs) only makes sense for weighted rep sets,
  // not cardio/timed holds, and is opt-in since it adds a third stepper to every row. `opt`
  // because an unlogged effort is not the same as 0 — RIR 0 says the set went to failure.
  const kind = effortOf(S)
  const eff = EFFORT[kind]
  // The effort column carries the scale key (`eff`) and its field name; unlike weight/reps it
  // is not a stepper — it opens a colour-coded picker (see effortCell). `f` is s.rir or s.rpe.
  // Cardio's third column is the treadmill's incline (lib/incline.js), on the exercises that have
  // one and on any whose rows already carry a grade. `opt` again: a cleared field is no incline,
  // and `store` keeps whatever is typed on the half percent between 0 and 40.
  const inclineCol = cardio && (inclineFits(ex) || entry.sets.some(hasIncline))
    ? { f: 'incline', step: INCLINE_STEP, dec: true, opt: true, hd: t('Incline (%)'), store: clampIncline } : null
  const col3 = cardio ? inclineCol : mode === 'reps' && eff ? { f: eff.f, eff: kind, hd: t(eff.hd) } : null
  // The effort column walks its own scale — see stepEffort. Weight and reps step up from 0
  // with no ceiling, as they always did.
  const bump = (s, i, col, dir) => {
    // Read the current value directly from the store rather than from the render-time snapshot.
    // In a superset both ExerciseBlock instances share the same store subscription, so when one
    // member's field changes the partner re-renders too, replacing the closure's `s` reference
    // with a fresh clone before the next tap fires. Reading from the store avoids that stale-
    // closure problem entirely and keeps every tap operating on the real current value.
    const fresh = useStore.getState().S.active?.entries[entryIdx]?.sets[i]
    const cur = fresh ? fresh[col.f] : s[col.f]
    if (mode === 'reps' && col.f === 'w') return onField(i, col.f, stepLoad(cur, col.step, dir))
    // The step is in the unit on screen: +0.5 mph, not +0.5 km/h shown as +0.31.
    const next = Math.max(0, Math.round(((viewOf(col, cur) || 0) + dir * col.step) * 100) / 100)
    onField(i, col.f, col.store ? col.store(next) : next)
  }
  // Uses the shared stepper markup so a set row picks up the same control styling
  // as every other +/- field in the app.
  // Which of the optional control groups this profile wants on screen (Settings → During a
  // workout → Workout controls). The lean default keeps the sets and one "more" button; each
  // switch brings one of the old always-visible button rows back.
  const wc = workoutControls(S)
  const cell = (s, i, col, cls) => (
    <div className={'stp ' + cls + (wc.steppers ? '' : ' plain')}>
      {wc.steppers && <button aria-label={t('Decrease')} onClick={() => bump(s, i, col, -1)}><Icon name="minus" /></button>}
      <span className="val"><NumberField decimal={col.dec} nullable={col.opt} value={viewOf(col, s[col.f]) ?? ''}
        onChange={v => onField(i, col.f, col.store ? col.store(v) : v)} /></span>
      {wc.steppers && <button aria-label={t('Increase')} onClick={() => bump(s, i, col, 1)}><Icon name="plus" /></button>}
    </div>
  )
  // Plate loading, per set row (lib/plates.js): which plates make THIS row's weight, from the
  // plates you own. 'pairs' splits what is beyond the bar per side, 'single' is one stack (a
  // belt, a sled), 'none' shows nothing. A unilateral row logs each side's own weight; a bar is
  // the same bar for both legs, so the line uses the sides' weight while they agree (or only one
  // side has a number yet) and stays away once they differ. Only reps mode has a weight to load,
  // and a saved workout being corrected (#203) has nothing left to load, so its rows stay bare.
  // The rows and their drop-set sub-rows form one sequence in the order the bar sees them, keyed
  // `i` for a set and `i:dN` for its N-th drop; a rest-pause burst keeps the set's weight, so it
  // is not in the sequence.
  const plateLoading = mode === 'reps' && !editing
  const loadKind = plateLoading ? loadKindFor(S, cfg) : 'none'
  const base = baseWeightFor(S, entry.id)
  const loadSeq = loadKind === 'none' ? [] : (() => {
    const inv = inventoryFor(S)
    const out = []
    entry.sets.forEach((s, i) => {
      let w = s.w
      if (perSide && isSideSet(s)) {
        const L = s.sides.L?.w || 0, R = s.sides.R?.w || 0
        if (L && R && L !== R) return
        w = L || R
      }
      out.push({ key: String(i), load: rowLoad(loadKind, w, base, inv) })
      dropsOf(s).forEach((d, di) => out.push({ key: i + ':d' + di, load: rowLoad(loadKind, d.w, base, inv) }))
    })
    return out
  })()
  // Only a bar is named as one: a plate-loaded machine set to per side with its own weight is
  // not a "Bar 50 lb".
  const loadSummary = loadKind === 'none' ? t('Off')
    : loadKind === 'single' ? t('Single stack')
      : !usesBar(ex) ? t('Per side')
        : base > 0 ? t('Bar {0}', fmtNum(base) + ' ' + S.unit) : t('No bar')
  // The line under a set row (or a drop sub-row): shown on the first loaded row and whenever the
  // stack changes from the loaded row before it, so a run of equal weights shows its plates once.
  // What to strip and what to add rides along, except in the compact view.
  const loadLine = key => {
    const at = loadSeq.findIndex(x => x.key === key)
    const L = at >= 0 ? loadSeq[at].load : null
    if (!L) return null
    let p = at - 1
    while (p >= 0 && !loadSeq[p].load) p--
    const prev = p >= 0 ? loadSeq[p].load : null
    if (prev && sameLoad(prev, L)) return null
    // "+" between plates: "45 + 5 per side" reads as a sum, a dot did not (Boris, 2026-09-13).
    const stack = L.plates.map(w => fmtPlate(w)).join(' + ')
    const text = L.barOnly ? t('Bar only')
      : L.kind === 'pairs' ? t('{0} per side', stack || '–') : t('Load {0}', stack || '–')
    const d = prev && !dense ? plateDelta(prev.plates, L.plates) : null
    const moves = d ? [...d.strip.map(w => '−' + fmtPlate(w)), ...d.add.map(w => '+' + fmtPlate(w))] : []
    return <div className="plateline">
      <Icon name="plate" />
      <span>{text}{L.missing > 0 && <> · <span className="short">{t('{0} short', fmtPlate(L.missing) + ' ' + S.unit)}</span></>}</span>
      {moves.length > 0 && <span className="moves">{moves.join(' ')}</span>}
    </div>
  }
  // Everything about this exercise that is not a set you are logging right now lives behind one
  // button. What used to be a row of buttons in the header, a chip under the bar, a strip of
  // three under the sets and four more below the card is a single list you open once a session,
  // in groups since v1.3.11: what you change today, what you look up, the exercise's settings,
  // the order of the session, and Remove on its own at the end.
  // The exercise's own rest, or the default it falls back to (lib/supersetFlow.js restSecFor).
  const ownRest = entry.target?.restSec > 0 ? entry.target.restSec : 0
  const restSub = ownRest ? fmtRest(ownRest) : t('Default ({0})', fmtRest(S.restSec))
  const openMore = () => menuSheet({
    title: exerciseNameFor(ex),
    titleClass: exerciseNameClass(ex),
    sections: [
      { title: t('Today'), items: [
        onSwap && { icon: 'swap', label: t('Swap exercise'), onClick: onSwap, disabled: busy },
        { icon: 'sunrise', label: t('Add warm-up set'), onClick: onAddWarmup },
        { icon: 'note', label: entry.note ? t('Edit note') : t('Add note'), sub: entry.note || undefined, onClick: () => exerciseNoteSheet(entryIdx) },
        onNoProg && { icon: 'chartLineSlash', label: t('Don’t count for progression'), sub: t('This exercise, this session only'), on: entry.noProg === true, onClick: () => onNoProg(entry.noProg !== true) },
      ] },
      { title: t('Look it up'), items: [
        { icon: 'history', label: t('History'), sub: last ? t('Last time') + ' ' + fmtDate(last.d) : undefined, onClick: () => exerciseHistorySheet(entry.id) },
        { icon: 'info', label: t('How to do it'), onClick: () => exerciseDetailSheet(ex) },
      ] },
      { title: t('Settings'), items: [
        onProgressionSettings && { icon: 'slider', label: t('Exercise settings'), sub: guidance ? t(guidance.policyLabel) : t('Sets, reps, rest, progression'), onClick: onProgressionSettings },
        onRest && { icon: 'timer', label: t('Rest timer'), sub: restSub, onClick: onRest },
        plateLoading && { icon: 'plate', label: t('Plate loading'), sub: loadSummary, onClick: () => barWeightSheet(entry.id, cfg) },
        routineUpdate && { icon: 'clipboard', label: t('Update routine'), sub: routineUpdate.sub, onClick: routineUpdate.run },
      ] },
      { title: t('Order and supersets'), items: [
        onPairPrev && { icon: 'link', label: t('Make superset with previous'), onClick: onPairPrev },
        onPairNext && { icon: 'link', label: t('Make superset with next'), onClick: onPairNext },
        onMoveUp && { icon: 'chevronUp', label: t('Move up'), onClick: onMoveUp, disabled: busy || !canMoveUp },
        onMoveDown && { icon: 'chevronDown', label: t('Move down'), onClick: onMoveDown, disabled: busy || !canMoveDown },
      ] },
      { items: [
        onRemoveExercise && { icon: 'trash', label: t('Remove exercise'), onClick: onRemoveExercise, danger: true, disabled: busy },
      ] },
    ],
  })
  // The set number is the set's own menu: drop / burst / remove — three things that used to
  // sit as chips and an X on every single row.
  // A timed per-side exercise plans in L/R pairs (buildWorkSets, addSet below), so the two
  // halves of a pair read as one set number — "Set 1 — Left" then "Set 1 — Right" — rather than
  // counting every row and making the second half look like an extra set.
  const setNumOf = (s, i) => setNumberAt(entry.sets, i)
  const sideTagOf = s => s.side === 'L' ? t('Left') : s.side === 'R' ? t('Right') : null
  const openSetMenu = (s, i) => {
    const warm = isWarmupRow(s)
    const sideTag = sideTagOf(s)
    menuSheet({
      title: warm ? t('Warm-up') : sideTag ? t('Set {0} ({1})', setNumOf(s, i), sideTag) : t('Set {0}', setNumOf(s, i)),
      subtitle: setLabel(entry.id, s, entry.target, speedUnit),
      sections: [
        // A warm-up logged as a work set (or the other way round) changes phase here. Reps sets
        // only, the kind a warm-up is added as; one work set always stays, and a per-side
        // exercise's work sets keep their sides, so a warm-up there is not made one again.
        { items: [
          !warm && mode === 'reps' && canBeWarmup(s) && entry.sets.some((x, j) => j !== i && !isWarmupRow(x)) && { icon: 'sunrise', label: t('Make it a warm-up set'), onClick: () => setPhaseAt(i, true) },
          warm && mode === 'reps' && !perSide && { icon: 'dumbbell', label: t('Count it as a working set'), onClick: () => setPhaseAt(i, false) },
          // Taken to failure: a toggle with its check, like the menu's other on/off rows. It counts
          // as RIR 0 wherever effort is read, unless a rating was logged on the set. A timed
          // per-side pair is one set, so both halves get it.
          !warm && mode !== 'cardio' && { icon: 'gauge', label: t('Taken to failure'), sub: t('Nothing left in the tank'), on: isFailureSet(s), onClick: () => toggleFailureAt(i) },
        ] },
        { title: t('Add to this set'), items: [
          !warm && mode === 'reps' && !isRestPauseSet(s) && { icon: 'arrowDown', label: t('Drop set'), sub: t('+ Drop'), onClick: () => addDropRow(i) },
          !warm && mode === 'reps' && !isDropSet(s) && { icon: 'bolt', label: t('Rest-pause burst'), sub: t('+ Burst'), onClick: () => addBurstRow(i) },
        ] },
        { items: [
          onCopySetAt && { icon: 'copy', label: t('Copy this set'), onClick: () => onCopySetAt(i) },
          { icon: 'trash', label: t('Remove this set'), danger: true, disabled: !editing && entry.sets.length <= setSpanAt(entry.sets, i)[1], onClick: () => onRemoveSetAt(i) },
        ] },
      ],
    })
  }
  // The effort cell is a single button, not a stepper: it shows the rating in the profile's
  // scale, tinted by how close to failure it was, and opens the picker on tap — to set a
  // rating or change one. rirOf-via-effortColor keeps the colour identical whether the value
  // is logged as RIR or RPE. With the +/- buttons switched off (Workout controls) a logged
  // rating is just the tinted value, which still opens the picker.
  const effortCell = (s, i, col) => {
    const v = s[col.f] ?? null
    const rir = col.eff === 'rpe' ? (v == null ? null : 10 - v) : v
    const color = effortColor(rir)
    // Logging an effort concludes the set (issue #64): once you rate how a set felt, it is done —
    // so picking a value also ticks the set and starts the rest timer, sparing the redundant
    // second confirmation. Clearing a rating (null) never un-ticks: ending a set stays a manual
    // undo via the checkmark. Reads `done` live from the store, since a superset re-render can
    // stale the closure's `s`, and only ticks a set that is not already done.
    const pickEffort = nv => {
      onField(i, col.f, nv)
      if (nv == null) return
      const fresh = useStore.getState().S.active?.entries[entryIdx]?.sets[i]
      if (fresh && !fresh.done) onToggle(i)
    }
    const open = () => effortPickerSheet(col.eff, v, pickEffort)
    if (v == null) return (
      <button className="effcell is-empty" aria-label={col.hd} onClick={open}>{col.hd}</button>
    )
    const step = dir => onField(i, col.f, stepEffort(col.eff, v, dir))
    return (
      <div className={'stp effcell-stp' + (wc.steppers ? '' : ' plain')}
        style={color ? { color: effortInk(rir), borderColor: color, background: `color-mix(in srgb, ${color} 20%, var(--surface-2))` } : undefined}>
        {wc.steppers && <button aria-label={t('Decrease')} onClick={() => step(-1)}><Icon name="minus" /></button>}
        <button className="val" aria-label={col.hd} onClick={open}>{fmtNum(v)}</button>
        {wc.steppers && <button aria-label={t('Increase')} onClick={() => step(1)}><Icon name="plus" /></button>}
      </div>
    )
  }
  // Per-side versions of the weight/reps stepper and the effort picker. Same markup and stepping
  // rules as the row-level `cell`/`effortCell`, but bound to one side of a unilateral row and
  // routed through setSide so the aggregate stays correct. Reads the live side value from the
  // store for the same stale-closure reason `bump` does.
  const sideBump = (i, side, col, dir) => {
    const fresh = useStore.getState().S.active?.entries[entryIdx]?.sets[i]?.sides?.[side]
    const cur = fresh ? fresh[col.f] : 0
    if (col.f === 'w') return setSide(i, side, col.f, stepLoad(cur, col.step, dir))
    // Reps step by one per side: repCol's step of two keeps the *combined* total evenly
    // splittable, but here each side is logged directly, so one tap is one rep.
    const step = col.f === 'r' ? 1 : col.step
    setSide(i, side, col.f, Math.max(0, Math.round(((cur || 0) + dir * step) * 100) / 100))
  }
  const sideCell = (sd, i, side, col, cls) => (
    <div className={'stp ' + cls + (wc.steppers ? '' : ' plain')}>
      {wc.steppers && <button aria-label={t('Decrease')} onClick={() => sideBump(i, side, col, -1)}><Icon name="minus" /></button>}
      <span className="val"><NumberField decimal={col.dec} value={sd[col.f] ?? ''}
        onChange={v => setSide(i, side, col.f, v)} /></span>
      {wc.steppers && <button aria-label={t('Increase')} onClick={() => sideBump(i, side, col, 1)}><Icon name="plus" /></button>}
    </div>
  )
  const sideEffortCell = (sd, i, side, col) => {
    const v = sd[col.f] ?? null
    const rir = col.eff === 'rpe' ? (v == null ? null : 10 - v) : v
    const color = effortColor(rir)
    const open = () => effortPickerSheet(col.eff, v, nv => {
      setSide(i, side, col.f, nv)
      const fresh = useStore.getState().S.active?.entries[entryIdx]?.sets[i]?.sides?.[side]
      if (nv != null && fresh && !fresh.done) onToggleSide(i, side)
    })
    if (v == null) return <button className="effcell is-empty" aria-label={col.hd} onClick={open}>{col.hd}</button>
    const step = dir => setSide(i, side, col.f, stepEffort(col.eff, v, dir))
    return (
      <div className={'stp effcell-stp' + (wc.steppers ? '' : ' plain')}
        style={color ? { color: effortInk(rir), borderColor: color, background: `color-mix(in srgb, ${color} 20%, var(--surface-2))` } : undefined}>
        {wc.steppers && <button aria-label={t('Decrease')} onClick={() => step(-1)}><Icon name="minus" /></button>}
        <button className="val" aria-label={col.hd} onClick={open}>{fmtNum(v)}</button>
        {wc.steppers && <button aria-label={t('Increase')} onClick={() => step(1)}><Icon name="plus" /></button>}
      </div>
    )
  }
  // One side's row: the L or R badge, then the same weight/reps/effort controls as a straight
  // row but bound to that side, and the side's own done tick.
  const sideRow = (s, i, side, col1, col2, col3) => {
    const sd = (s.sides && s.sides[side]) || { w: 0, r: 0, done: false }
    return <div className={'setrow side' + (sd.done ? ' done' : '') + (col3 ? ' eff3' : '')}>
      <span className="sidetag" aria-hidden="true">{side === 'L' ? t('L') : t('R')}</span>
      {sideCell(sd, i, side, col1, 'w')}
      {col2 && sideCell(sd, i, side, col2, 'r')}
      {col3 && sideEffortCell(sd, i, side, col3)}
      <Check checked={sd.done} label={t('Set {0} ({1}) done', setNumOf(s, i), side === 'L' ? t('Left') : t('Right'))} onChange={() => onToggleSide(i, side)} />
    </div>
  }
  // A side's own drop-set/rest-pause sub-rows (issue #60): the intensifier is logged per limb, so
  // the drops and bursts hang under that side's row, each editable, exactly like a straight set's
  // do under its row. Reads the side object, not the aggregate.
  const sideExtras = (s, i, side) => {
    const sd = (s.sides && s.sides[side]) || {}
    return <>
      {dropsOf(sd).map((d, di) => (
        <div className="subrow" key={'d' + di}>
          <span className="subn">{t('Drop {0}', di + 1)}</span>
          {miniStepper(d.w, loadStep, true, v => setDropField(i, di, 'w', v, side), true)}
          {miniStepper(d.r, 1, false, v => setDropField(i, di, 'r', v, side))}
          <button className="iconbtn" aria-label={t('Remove drop')} onClick={() => removeDrop(i, di)}><Icon name="xmark" /></button>
        </div>
      ))}
      {clustersOf(sd).map((c, ci) => (
        <div className="subrow" key={'c' + ci}>
          <span className="subn">{t('Burst {0}', ci + 1)}</span>
          {miniStepper(c.r, 1, false, v => setClusterField(i, ci, v, side))}
          <span className="dim small">{c.restSec}s</span>
          <button className="iconbtn" aria-label={t('Remove burst')} onClick={() => removeCluster(i, ci)}><Icon name="xmark" /></button>
        </div>
      ))}
    </>
  }
  // A smaller stepper for a drop's weight/reps or a burst's reps — editing what the plan (or a
  // live "+ Drop"/"+ Burst" tap) already put on the row, not typing into a fresh field.
  const miniStepper = (value, step, dec, onChange, snapWeightStep = false) => (
    <div className="stp mini">
      <button aria-label={t('Decrease')} onClick={() => onChange(snapWeightStep ? stepLoad(value, step, -1) : Math.max(0, Math.round(((value || 0) - step) * 100) / 100))}><Icon name="minus" /></button>
      <span className="val"><NumberField decimal={dec} value={value ?? ''} onChange={onChange} /></span>
      <button aria-label={t('Increase')} onClick={() => onChange(snapWeightStep ? stepLoad(value, step, 1) : Math.max(0, Math.round(((value || 0) + step) * 100) / 100))}><Icon name="plus" /></button>
    </div>
  )
  // A plain set row (anything but a reps L/R stack). Its own function since a timed per-side
  // hold draws two of them, L then R, inside one swipe so the pair slides as the one set it is.
  // A set taken to failure wears a small "F" on its number, the button every row's menu opens
  // from. The button's own label speaks for it, so a screen reader hears it with the set number.
  const failMark = s => isFailureSet(s) ? <span className="failmark" aria-hidden="true">{t('F')}</span> : null
  const failSay = (s, label) => isFailureSet(s) ? label + ', ' + t('Taken to failure') : label
  const plainRow = (s, i) => (
    <div ref={el => onSetRowRef?.(i, el)} className={'setrow' + (s.done ? ' done' : '') + (col3 ? ' eff3' : '') + (timed ? ' timed' : '')}>
      <button type="button" className="n" aria-label={failSay(s, sideTagOf(s) ? t('Set {0} ({1})', setNumOf(s, i), sideTagOf(s)) : t('Set {0}', setNumOf(s, i)))} aria-describedby={optsId} title={t('More')} onClick={() => openSetMenu(s, i)}>{setNumOf(s, i)}{failMark(s)}</button>
      {/* Both words sit in the pill's one grid cell (::before/::after, hidden), so Left and
          Right are as wide as the longer of the two in every language and the inputs
          after them line up (#322). */}
      {sideTagOf(s) && <span className="tag acc nocap sidepill" data-l={t('Left')} data-r={t('Right')}><span>{sideTagOf(s)}</span></span>}
      {cell(s, i, col1, 'w')}
      {col2 && cell(s, i, col2, 'r')}
      {col3 && (col3.eff ? effortCell(s, i, col3) : cell(s, i, col3, 'r inc'))}
      {/* A timed set is started, not typed: the timer counts the hold down and checks the
          set off itself. The checkbox stays for anyone who timed it on their own watch. */}
      {timed && !editing && <button className="setgo" aria-label={t('Start set')} disabled={s.done || !!working}
        onClick={() => onStartTimed(i)}><Icon name="play" /></button>}
      <Check checked={s.done} label={sideTagOf(s) ? t('Set {0} ({1}) done', setNumOf(s, i), sideTagOf(s)) : t('Set {0} done', setNumOf(s, i))} onChange={() => onToggle(i)} />
    </div>
  )
  // Swipe on sets (v1.3.11, Settings → Workout): a set row swiped toward the start of the line is
  // removed with an Undo, toward the end copied below itself. Off, the row is the plain row it
  // was, and the Cards swipe works from it again. The row closes whenever its exercise's rows
  // change, the row is ticked, or a rest or hold starts: rows are keyed by index, so an open row
  // could otherwise end up showing another set.
  const swipeOn = !!(wc.swipeSets && onCopySetAt && onRemoveSetAt)
  const dismissHint = () => { if (useUI.getState().swipeHint) setUI({ swipeHint: null }) }
  const swipeRow = (s, i, row) => {
    if (!swipeOn) return row
    // A timed per-side pair comes here once, at its L row, and stands for both rows.
    const [from, count] = setSpanAt(entry.sets, i)
    const mine = j => j != null && j >= from && j < from + count
    return <SwipeRow canDelete={editing || entry.sets.length > count}
      onDelete={() => onRemoveSetAt(i)} onCopy={() => onCopySetAt(i)}
      onBlocked={() => useUI.getState().toast(t('Keep at least one set, champ'))}
      onStart={dismissHint}
      closeKey={[entry.sets.length, s.done ? 1 : 0, count === 2 && entry.sets[from + 1]?.done ? 1 : 0, s.sides?.L?.done ? 1 : 0, s.sides?.R?.done ? 1 : 0, restEnds || 0, working?.endsAt || 0, S.active.cur].join('|')}
      flash={setFlash && mine(setFlash.i) ? setFlash.id : 0}
      peek={swipeHint && mine(swipeHint.i) ? swipeHint.id : 0}>
      {row}
    </SwipeRow>
  }
  return <>
    {/* Animations set to Small: a thumbnail beside the name instead of a strip above it, so the
        first set is on screen without scrolling; a tap brings the full animation back. */}
    {!dense && !thumb && <Media ex={ex} key={entry.id} compact={compact} minimizable />}
    <Inline justify="between" className="exhd mb-3">
      {thumb && <WorkoutThumb ex={ex} onExpand={() => update(s => { s.gifSize = 'full' })} />}
      <div style={{ flex: 1, minWidth: 0, letterSpacing: '-.02em', lineHeight: 1.2 }} className={cx('fw-semibold', (compact || dense) ? 'fs-body' : 'fs-title3', exerciseNameClass(ex))}>{exerciseNameFor(ex)}</div>
      <Inline gap={1} style={{ flex: 'none' }}>
        {entry.note && <button className="iconbtn ink-acc" aria-label={t('Note')} title={t('Note')}
          onClick={() => exerciseNoteSheet(entryIdx)}><Icon name="note" /></button>}
        <button className="iconbtn" aria-label={t('More')} title={t('More')} onClick={openMore}><Icon name="more" /></button>
      </Inline>
    </Inline>
    {/* Kept out of progression: by hand for this session (the ⋯ menu, with its undo right here),
        or by a deload or rehab routine, which owns that choice and offers no undo. On in every
        view, compact included: it changes what the next session is built from. */}
    {entry.noProg === true && <div className="noprog">
      <Icon name="chartLineSlash" /><span>{t('Not counted for progression')}</span>
      {onNoProg && <Chip onClick={() => onNoProg(false)}>{t('Undo')}</Chip>}
    </div>}
    {/* compact view keeps the plan line: it is what the rows are measured against */}
    {dense && planLine}
    {wc.pairButtons && !compact && !dense && (onPairPrev || onPairNext) && <Inline gap={3} wrap className="mb-4">
      {onPairPrev && <Button size="xs" variant="tinted" icon="link" title={t('Make superset with previous')} onClick={onPairPrev}>{t('Make superset with previous')}</Button>}
      {onPairNext && <Button size="xs" variant="tinted" icon="link" title={t('Make superset with next')} onClick={onPairNext}>{t('Make superset with next')}</Button>}
    </Inline>}
    {/* compact view drops everything from here to the sets card — it is all still on the ⋯ menu
        (note, details, history, bar weight, progression) or is display-only (tags, "last time"). */}
    {!dense && <>
    <Inline gap={3} wrap className="mb-4">
      {cardio && <Tag tone="acc" icon="figureRun">{t('Cardio')}</Tag>}
      {/* A unilateral exercise is logged per side directly (the L/R rows below for reps, a
          "Left"/"Right" tag on each doubled row for a timed hold), so the old "{n} per side"
          chip — which halved the combined total for display — is gone: the split is no longer
          derived, it is what you enter. The tag only flags that this is per-side. */}
      {!cardio && isPerSide(cfg) && <Tag tone="acc" nocap icon="sides">{t('Per side')}</Tag>}
      {(ex.tg || ex.bp) && <Tag>{t(MUSCLE_NAME[ex.tg] || ex.tg || ex.bp)}</Tag>}
      {ex.eq && <Tag>{t(ex.eq)}</Tag>}
      {best > 0 && <Tag nocap>{t('Best:')} {fmtNum(best)} {S.unit}</Tag>}
    </Inline>
    {/* Three notes can apply to one exercise and they are not interchangeable, so each keeps its
        own line and its own icon: the plan's instruction (cfg.note, from the routine), the
        standing fact about the movement (exNotes), and the message you pinned to yourself last
        session. Today's own note is edited through the button in the header and shown last. */}
    {cfg.note && <div className="exnote">{cfg.note}</div>}
    {standingNote && <div className="exnote"><Icon name="info" className="fs-footnote" style={{ marginInlineEnd: 5, verticalAlign: '-2px' }} />{standingNote}</div>}
    {pinnedNote && <div className="exnote ink-warn">
      <Icon name="pin" className="fs-footnote" style={{ marginInlineEnd: 5, verticalAlign: '-2px' }} />
      {t('From {0}:', fmtDate(pinnedNote.d, true))} {pinnedNote.note}
    </div>}
    {entry.note && <div className="exnote">{entry.note}</div>}
    {planLine}
    {refLine}
    {guidance && onProgressionSettings && <button type="button" className={'progline' + (plan.kind === 'deload' ? ' warn' : '')}
      aria-label={t('Open exercise settings')} onClick={onProgressionSettings}>
      <Icon name={plan.kind === 'up' ? 'arrowUp' : plan.kind === 'deload' ? 'arrowDown' : 'lightbulb'} />
      <span><strong>{t(guidance.policyLabel)}</strong> · {t(...guidance.why)}</span>
    </button>}
    </>}
    <Card className="mt-5 mb-0">
      {/* the header carries the same eff3/timed sizing as the rows, or the labels drift off their
          columns; over L/R rows it also has to skip the side badge that sits in front of the weight cell */}
      <div className={'sethead' + (col3 ? ' eff3' : '') + (timed ? ' timed' : '') + (perSide ? ' per-side' : '') + (wc.steppers ? '' : ' plain')}><span className="n-sp" /><span className="w-sp">{col1.hd}</span>{col2 && <span className="r-sp">{col2.hd}</span>}{col3 && <span className={col3.eff ? 'eff-sp' : 'r-sp'}>{col3.hd}</span>}{timed && <span className="ck-sp" />}<span className="ck-sp" /></div>
      <span id={optsId} className="vh">{t('Options: copy, remove')}</span>
      {entry.sets.map((s, i) => {
        const warm = isWarmupRow(s)
        const warmBefore = i > 0 && isWarmupRow(entry.sets[i - 1])
        const isFirstWarmup = warm && !warmBefore
        // Numbering restarts per phase: with two warm-ups the first work set reads 1, not 3.
        const phaseNum = entry.sets.slice(0, i + 1).filter(x => isWarmupRow(x) === warm).length
        // A timed per-side hold is an L row and an R row that delete and copy as one set, so they
        // also swipe as one: the L row's turn draws both, the R row's draws neither.
        const [spanStart, spanCount] = setSpanAt(entry.sets, i)
        const pairHead = spanCount === 2 && spanStart === i
        const pairTail = spanCount === 2 && spanStart !== i
        return <div key={i}>
          {isFirstWarmup && <div className="setph">{t('Warm-up')}</div>}
          {!warm && warmBefore && <div className="setsep" />}
          {/* A pyramid's Max set: the reps are what you managed, not a number to hit. */}
          {/* With the record to beat at this set's weight or heavier, from before this session. */}
          {!warm && s.max && <div className="setph">{t('Max: as many reps as you can')}{(() => {
            const rec = maxRecordAt(H.workouts, entry.id, s.w)
            if (!rec) return null
            return ' · ' + (rec.w > 0 ? tn('Record: {0} rep at {1}', 'Record: {0} reps at {1}', rec.r, fmtNum(rec.w) + ' ' + S.unit) : tn('Record: {0} rep', 'Record: {0} reps', rec.r))
          })()}</div>}
          {!pairTail && swipeRow(s, i, perSide && isSideSet(s) ? (
            // Unilateral set: the number sits beside a two-row L/R stack, each side logged and
            // ticked on its own (issue #60). Warm-ups split the same way as the work sets they
            // ramp toward, so a warm-up side set shows L/R too (#388).
            <div ref={el => onSetRowRef?.(i, el)} className={'setrow-side' + (s.done ? ' done' : '')}>
              <button type="button" className="n" aria-label={failSay(s, t('Set {0}', phaseNum))} aria-describedby={optsId} title={t('More')} onClick={() => openSetMenu(s, i)}>{phaseNum}{failMark(s)}</button>
              <div className="side-rows">
                {sideRow(s, i, 'L', col1, col2, col3)}
                {sideExtras(s, i, 'L')}
                {sideRow(s, i, 'R', col1, col2, col3)}
                {sideExtras(s, i, 'R')}
              </div>
            </div>
          ) : pairHead ? <>{plainRow(s, i)}{plainRow(entry.sets[i + 1], i + 1)}</> : plainRow(s, i))}
          {swipeHint && swipeHint.i === i && swipeOn && <div className="swhint">
            <button type="button" onClick={() => setUI({ swipeHint: null })}>
              <Icon name="swap" /><span>{t('Psst: swipe a set. Left deletes, right copies.')}</span><Icon name="xmark" />
            </button>
          </div>}
          {loadLine(String(i))}
          {/* Drop-sets and rest-pause bursts extend this same row — no long rest, no new set.
              A planned exercise arrives with these already filled in (applyIntensifierPlan);
              every value here is just as editable as the main row's own weight/reps. */}
          {!warm && mode === 'reps' && <>
            {dropsOf(s).map((d, di) => (
              <div className="subrow" key={'d' + di}>
                <span className="subn">{t('Drop {0}', di + 1)}</span>
                {miniStepper(d.w, loadStep, true, v => setDropField(i, di, 'w', v), true)}
                {miniStepper(d.r, 1, false, v => setDropField(i, di, 'r', v))}
                <button className="iconbtn" aria-label={t('Remove drop')} onClick={() => removeDrop(i, di)}><Icon name="xmark" /></button>
              </div>
            )).flatMap((el, di) => [el, <Fragment key={'dl' + di}>{loadLine(i + ':d' + di)}</Fragment>])}
            {clustersOf(s).map((c, ci) => (
              <div className="subrow" key={'c' + ci}>
                <span className="subn">{t('Burst {0}', ci + 1)}</span>
                {miniStepper(c.r, 1, false, v => setClusterField(i, ci, v))}
                <span className="dim small">{c.restSec}s</span>
                <button className="iconbtn" aria-label={t('Remove burst')} onClick={() => removeCluster(i, ci)}><Icon name="xmark" /></button>
              </div>
            ))}
            {wc.setShortcuts && <div className="setextra">
              {!isRestPauseSet(s) && <Chip className="add" onClick={() => addDropRow(i)}><Icon name="arrowDown" />{t('+ Drop')}</Chip>}
              {!isDropSet(s) && <Chip className="add" onClick={() => addBurstRow(i)}><Icon name="bolt" />{t('+ Burst')}</Chip>}
            </div>}
          </>}
        </div>
      })}
      <Spacer size={4} />
      {wc.setShortcuts ? <Inline wrap>
        <Button size="sm" icon="sunrise" onClick={onAddWarmup}>{t('Add warm-up set')}</Button>
        <Button size="sm" icon="minus" disabled={entry.sets.length <= setSpanAt(entry.sets, entry.sets.length - 1)[1]} onClick={onRemoveSet}>{t('Remove set')}</Button>
        <Button size="sm" icon="plus" onClick={onAddSet}>{t('Add set')}</Button>
      </Inline> : <Button size="sm" icon="plus" onClick={onAddSet}>{t('Add set')}</Button>}
    </Card>
  </>
}

/* ---------- swipe on sets: delete, undo, copy (v1.3.11) ---------- */
// The swipe, the set-number menu and the Undo on the toast all come through the set helpers in
// views/workout/workout-actions.js, so a set is removed, put back and copied the same way
// whichever you used, and always through the store's normal update: the sync sees an ordinary
// edit (with its _rev/baseRev), never an old snapshot written back over newer state. Re-exported
// here for the callers and tests that import them from this file.
export { setNumberAt, deleteActiveSet, undoDeleteSet, copyActiveSet, removeActiveExercise }
// UI state written from effects here; a test that stubs the UI store without setState simply
// does not see it.
const setUI = patch => useUI.setState?.(patch)

/* ---------- active workout ---------- */

// Whether a set row sits wholly between the fixed bars at the top and at the bottom: the status bar
// and the connection bar above, the tab bar and the rest or hold bar below. The Cards header
// scrolls with the page, so it takes nothing off the top, and a row is short enough to be all in
// or all out.
const rowOnScreen = el => {
  if (typeof window === 'undefined' || typeof el.getBoundingClientRect !== 'function') return false
  const r = el.getBoundingClientRect()
  let bottom = window.innerHeight
  for (const id of ['timer', 'tabbar']) {
    const bar = document.getElementById(id)
    const top = bar && typeof bar.getBoundingClientRect === 'function' ? bar.getBoundingClientRect().top : null
    if (top != null && top < bottom) bottom = top
  }
  return r.bottom <= bottom && r.top >= coveredTop()
}
// How much of the top of the screen the fixed bars cover. The installed app draws the page under
// the translucent status bar (viewport-fit=cover), and the connection bar (SyncBanner) sits below
// it while there is no server to reach. index.css keeps the two as --sat and --conn, but --sat is
// a max() of env() and --native-sat, and a custom property's computed value is the expression as
// text ("max(0px,47px)"), not a length. So it is measured off an element that is that tall.
const coveredTop = () => {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:calc(var(--sat) + var(--conn));visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const inset = probe.offsetHeight || 0
  probe.remove()
  return inset
}

export function ActiveWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { work, timer } = useUI()
  const A = S.active
  const editing = !!A.editingWorkoutId
  const units = supersetUnits(A.entries)
  const cur = Number.isInteger(A.cur)
    ? Math.min(Math.max(A.cur, 0), Math.max(0, A.entries.length - 1))
    : 0
  const unit = A.entries.length ? unitOf(units, cur) : []
  const unitIdx = units.findIndex(u => u === unit)
  const isSuperset = unit.length > 1
  // Cards show one unit at a time with Prev/Next + swipe; list and compact stack every unit so
  // the whole session is visible and scrollable (Settings → During a workout → Workout view,
  // seeded onto s.active and overridable for this session from the header ⋮). compact is list
  // with the per-exercise media, tag chips, note lines, "last time" and progression line
  // stripped — just names, the one-line plan and set rows. Every set handler below is already entry-index
  // parameterised, so these only change what is rendered — completion, rest, top-weight and
  // auto-advance share one path. Unknown/absent values read as cards, keeping every
  // pre-existing profile (and a session started before this field) as it was.
  const requestedView = A.workoutView || S.workoutView
  const workoutView = ['list', 'compact', 'focus'].includes(requestedView) ? requestedView : 'cards'
  const listMode = workoutView === 'list' || workoutView === 'compact'
  const focusMode = workoutView === 'focus'
  const dense = workoutView === 'compact'
  // A superset's heading: its own name and rest between rounds when it has them (#292).
  const ssTitle = u => {
    const m = supersetMeta(A.entries, u, { onTarget: true })
    if (m.rest > 0) return t('{0} · back-to-back, {1} rest after each round', m.name || t('Superset'), fmtRest(m.rest))
    return m.name ? t('{0} · do these back-to-back, rest when done', m.name) : t('Superset · do these back-to-back, rest when done')
  }
  // Collapse finished exercises in the list (#241). The current unit stays open, superset
  // members included, until you move on (ticking its last set does that, see toggle); an empty
  // exercise or a half-done warm-up or side stays open too.
  // The session's own choice (the Layout menu) wins over the saved one (Settings → Workout), the
  // way the layout itself does, so someone who always wants it switches it on once.
  const collapseOn = listMode && !!(A.collapseCompleted ?? S.collapseCompleted)
  // A finished unit you tapped open again to look at or fix (Discord: "minimize completed exercises
  // so I view only what I have yet to do"). This screen's own memory: a reload folds it back.
  // Keyed by index like the units, so a different number of exercises starts over.
  const [openedState, setOpenedState] = useState(() => ({ len: A.entries.length, keys: new Set() }))
  const opened = openedState.len === A.entries.length ? openedState.keys : new Set()
  const finished = u => u.every(idx => A.entries[idx].sets.length > 0 && A.entries[idx].sets.every(s => s.done))
  const collapsed = new Set(collapseOn ? units.filter(u =>
    !u.includes(cur) && !opened.has(u.join('-')) && finished(u),
  ).map(u => u.join('-')) : [])
  const setUnitOpen = (key, open) => setOpenedState(prev => {
    const keys = new Set(prev.len === A.entries.length ? prev.keys : [])
    if (open) keys.add(key); else keys.delete(key)
    return { len: A.entries.length, keys }
  })
  const wc = workoutControls(S)
  // Superset flow: center the actionable row when completing a set moves to the partner or
  // back to the first exercise of the next round. Entry-bound maps keep repeated exercise IDs
  // distinct, while each rendered set index identifies the existing row within that entry.
  const exRefs = useRef(new Map())
  const setRefs = useRef(new Map())
  const focusPointerEpoch = useRef(0)
  const bindExRef = (entry, el) => {
    if (el) exRefs.current.set(entry, el)
    else {
      exRefs.current.delete(entry)
      setRefs.current.delete(entry)
    }
  }
  const bindSetRef = (entry, setIdx, el) => {
    let refs = setRefs.current.get(entry)
    if (el) {
      if (!refs) { refs = new Map(); setRefs.current.set(entry, refs) }
      refs.set(setIdx, el)
    } else if (refs) {
      refs.delete(setIdx)
      if (!refs.size) setRefs.current.delete(entry)
    }
  }
  // The handlers and the running session's effects (high-water marks, swipe hint, a hold back
  // from a reload, hardware keys, presence heartbeat) live in views/workout/use-workout.js. This
  // screen passes the hooks its own DOM needs: the Focus pointer, the superset scroll's marker,
  // the list's reveal after a fold, and the scroll a key move asks for.
  const { actions } = useWorkout({
    listMode, collapseOn, focusMode,
    onShift: force => { if (force || focusMode) focusPointerEpoch.current++ },
    onCurMoved: at => { lastCur.current = at },
    onReveal: () => { revealCur.current = true },
    onKeyMove: () => showCurrent(),
    selectUnit: idx => focusUnit(idx),
  })
  const {
    toggle, addSet, removeSet, addWarmup, removeSetAt, setField, mutEntry, pairAt, unpairAt, moveUnitAt,
    setNoProg, toggleSessionNoProg, routineKeepsOut, noProgSwitchable, swapExercise, markAllDone,
    startTimed, navigateUnit, routineUpdateFor, openExerciseRest, openProgressionSettings,
    selectEntry: selectFocusEntry, advanceUnit: advanceFocusUnit,
  } = actions
  // A button's or a menu item's click must not reach the picker's options.
  const addExercise = () => actions.addExercise()
  useEffect(() => {
    const liveEntries = new Set(A.entries)
    for (const entry of exRefs.current.keys()) {
      if (!liveEntries.has(entry)) exRefs.current.delete(entry)
    }
    for (const entry of setRefs.current.keys()) {
      if (!liveEntries.has(entry)) setRefs.current.delete(entry)
    }
  })
  // What this render shows, for a scroll that may run after it (below): the store clones the
  // whole state on every write and the ref maps above are keyed by entry object, so an entry
  // kept from an earlier render can be a key nothing is under any more.
  const shown = useRef(null)
  shown.current = { entries: A.entries, cur }
  // The marker's index when the effect below last ran. The effect also runs on mount, when two
  // exercises are paired, on List → Cards and when a unit is moved up or down. Each of those used
  // to ask for the same scroll, and a sheet closing in the same tap (the weigh-in sheet a session
  // starts through, the exercise ⋯ menu, the Layout menu) undid it on the spot. Once the scroll
  // waits for that restore they would land, and a session started through the weigh-in sheet
  // would open with its header off screen. So a run the marker did not cause scrolls only a row
  // that is off screen, and never while a sheet is still putting the page back. Coming back to
  // the session with the row below the fold still brings it back, as it always did.
  const lastCur = useRef(null)
  useEffect(() => {
    // Judged by index alone. A unit moved up or down carries the marker's index with it, and
    // moveUnitAt records the new index here itself before this runs, so that reads as no move;
    // a superset of two rows of the same exercise still reads the tick from one to the other as
    // a move.
    const was = lastCur.current
    lastCur.current = cur
    const moved = was != null && was !== cur
    if (!isSuperset || listMode) return
    // A run the marker did not cause, with a sheet closing in the same tap, never scrolled: the
    // restore undid it. Keep that by not asking at all. Asking after the restore and then judging
    // the row would centre a first row that a tall first block (a note, "Last time", the
    // progression line) pushes partly under the tab bar, and scroll the header away.
    if (!moved && scrollRestorePending()) return
    // Rating the set (RIR or RPE, one picker) closes the sheet and ticks the set in one tap, and
    // the sheet's un-pin puts the page back where it stood, now and once more a frame later
    // (components/Modals.jsx). A scroll asked for in this same commit was undone a few ms later,
    // every time, and the partner's row stayed below the fold. With no sheet closing in the last
    // third of a second, afterScrollRestore runs this at once, as the tick always did.
    return afterScrollRestore(() => {
      const { entries, cur: at } = shown.current
      const entry = entries[at]
      const firstIncomplete = entry?.sets.findIndex(s => !s.done) ?? -1
      const setIdx = firstIncomplete >= 0 ? firstIncomplete : (entry?.sets.length ?? 0) - 1
      const el = (setIdx >= 0 && setRefs.current.get(entry)?.get(setIdx)) || exRefs.current.get(entry)
      if (!el || typeof el.scrollIntoView !== 'function') return
      if (!moved && rowOnScreen(el)) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [cur, isSuperset, listMode, A.entries.length])
  // The list opens at the exercise you are on, not at the top of the session (issue #224): you
  // switch to it mid-workout to look at what comes before and after. Only on the way in — once
  // the list is open, "current" moves because you tick rows in it, and a list that scrolls
  // itself under your thumb is worse than one that stays put. List ↔ Compact counts as a way
  // in: the rows change height, so the same scroll offset lands somewhere else.
  //
  // The scroll waits for the next frame rather than running in the effect itself. App.jsx
  // restores the route's remembered position in a frame it asked for during the same commit
  // (a back navigation), and a sheet closing (⋯ → Layout → List) puts the page back
  // where it was before the sheet opened, in an effect cleanup that runs before this one —
  // both would win over a scroll made right here. A frame asked for now runs after theirs.
  const listRef = useRef(null)
  const hdrRef = useRef(null)
  useEffect(() => {
    if (!listMode) return
    const schedule = callback => window.requestAnimationFrame
      ? window.requestAnimationFrame(callback)
      : window.setTimeout(callback, 0)
    const cancel = frame => window.cancelAnimationFrame
      ? window.cancelAnimationFrame(frame)
      : window.clearTimeout(frame)
    // scrollToUnit (below) clears the sticky header at whatever height it has right now.
    const frame = schedule(() => scrollToUnit(listRef.current?.querySelector('.wl-unit.cur')))
    return () => cancel(frame)
  }, [workoutView])

  const total = setUnitsTotal(A.entries)
  const done = setsDoneActive(A)

  const onPairPrev = !isSuperset && cur > 0 ? () => pairAt(cur - 1, cur) : null
  const onPairNext = !isSuperset && cur < A.entries.length - 1 ? () => pairAt(cur, cur + 1) : null
  // The buttons below the exercise move the whole unit; the exercise ⋯ menu's move (member) a
  // superset member inside its superset (useWorkout moveUnitAt).
  const moveCurrentUnit = direction => moveUnitAt(cur, direction)

  // One prop object per entry so the card and list layouts share the exact same wiring. The
  // exercise-level actions (swap, move, remove) address the entry itself, so the "more" menu of
  // a superset member acts on that member, not on whatever the marker happens to point at.
  const blockProps = idx => ({
    editing,
    onSwap: () => swapExercise(idx),
    onMoveUp: () => moveUnitAt(idx, -1, true),
    onMoveDown: () => moveUnitAt(idx, 1, true),
    canMoveUp: canMoveActiveWorkoutEntry(A, idx, -1),
    canMoveDown: canMoveActiveWorkoutEntry(A, idx, 1),
    onRemoveExercise: () => confirmRemoveExercise(idx),
    busy: !!work,
    onToggle: (i, onFocusProgress) => toggle(idx, i, undefined, { onFocusProgress }),
    onToggleSide: (i, side, onFocusProgress) => toggle(idx, i, side, { onFocusProgress }),
    onField: (i, f, v) => setField(idx, i, f, v),
    onMutateSet: (i, fn) => mutEntry(idx, entry => { entry.sets[i] = fn(entry.sets[i]) }),
    onAddSet: () => addSet(idx),
    onRemoveSet: () => removeSet(idx),
    onAddWarmup: () => addWarmup(idx),
    onRemoveSetAt: i => removeSetAt(idx, i),
    onCopySetAt: i => copyActiveSet(idx, i),
    onStartTimed: (i, onFocusProgress) => startTimed(idx, i, onFocusProgress),
    onProgressionSettings: editing ? null : () => openProgressionSettings(idx),
    onRest: editing ? null : () => openExerciseRest(idx),
    onNoProg: routineKeepsOut(A.entries[idx]) ? null : on => setNoProg(idx, on),
    routineUpdate: routineUpdateFor(idx),
  })
  // List mode shows every unit at once, so the "current" exercise is chosen by tapping
  // "Set current" on its header instead of Prev/Next. The bottom Move/Swap/Remove actions
  // keep operating on it, and completing sets still advances it on its own.
  // When the list was only opened for this session and cards are the saved default, "Set
  // current" has no purpose besides picking which exercise to look at next, so it also goes
  // back to card view (#260) rather than leaving you in the list to open Cards yourself. It
  // stays in the list when the list is the saved default, which is a choice to keep, and when
  // the exercise buttons are on, because then the tap also picks what Move/Swap/Remove below
  // act on and the list is where you use them.
  const focusUnit = firstIdx => update(s => {
    if (!s.active) return
    s.active.cur = firstIdx
    if (!workoutControls(s).exerciseButtons && (s.workoutView || 'cards') === 'cards') s.active.workoutView = 'cards'
  })
  // The header ⋮ re-lays-out the running session without touching the saved default
  // (Settings → During a workout → Workout view). It writes s.active.workoutView, which the
  // render above prefers over S.workoutView.
  const setWorkoutView = v => update(s => { if (s.active) s.active.workoutView = v })
  const LAYOUT_LABEL = {
    cards: t('Cards'),
    list: t('List'),
    compact: t('Compact'),
    focus: t('Focus'),
  }
  const openLayoutMenu = () => menuSheet({
    title: t('Layout'),
    items: [
      { icon: 'layout', label: t('Cards'), on: workoutView === 'cards', onClick: () => setWorkoutView('cards') },
      { icon: 'list', label: t('List'), on: workoutView === 'list', onClick: () => setWorkoutView('list') },
      { icon: 'compact', label: t('Compact'), on: workoutView === 'compact', onClick: () => setWorkoutView('compact') },
      { icon: 'target', label: t('Focus'), on: workoutView === 'focus', onClick: () => setWorkoutView('focus') },
      listMode && { icon: 'minimize', label: t('Collapse completed exercises'),
        sub: t('Keep the current exercise open'), on: collapseOn,
        onClick: () => update(s => { if (s.active) s.active.collapseCompleted = !collapseOn }) },
    ],
  })
  // Ending the session without saving it. The ⋯ menu's last item since the header's ✕ became the
  // ⌄ that only leaves the screen (v1.3.11).
  // Off the screen the way it came in (lib/use-tab-nav.js back): the session's page is gone.
  const discardWorkout = discardWorkoutConfirm
  // The header ⋯, in groups: the settings you change at the gym first (their own sheet, the same
  // values as Settings), then what to add, what to change about this workout, and Discard last.
  // Layout here stays this session's own (s.active.workoutView); the settings sheet's Layout is
  // the saved one.
  const openViewMenu = () => menuSheet({
    sections: [
      { items: [
        { icon: 'gear', accent: true, chevron: true, label: t('Workout settings'),
          sub: [S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer'), S.sound ? t('Sound') : t('Silent')].join(' · '),
          onClick: workoutSettingsSheet },
      ] },
      { title: t('Add'), items: [
        { icon: 'plusCircle', label: t('Add exercise'), onClick: addExercise },
        !editing && { icon: 'clipboard', label: t('Add routine'), sub: t('Bring another routine into this session'), onClick: addRoutineToSessionSheet },
      ] },
      { title: t('This workout'), items: [
        A.backfill && A.entries.length > 0 && { icon: 'checkCircle', label: t('Mark all sets done'), onClick: markAllDone },
        { icon: 'pencil', label: t('Rename workout'), onClick: renameWorkoutSheet },
        { icon: 'layout', label: t('Layout'), sub: LAYOUT_LABEL[workoutView] || LAYOUT_LABEL.cards, onClick: openLayoutMenu },
        { icon: 'note', label: A.note ? t('Edit session note') : t('Add session note'), onClick: sessionNoteSheet },
        noProgSwitchable && { icon: 'chartLineSlash', label: t('Don’t count for progression'), sub: t('Every exercise in this workout'), on: sessionNoProg(A), onClick: toggleSessionNoProg },
      ] },
      { items: [
        !editing && { icon: 'trash', label: t('Discard workout'), danger: true, onClick: discardWorkout },
      ] },
    ],
  })
  // Remove a whole exercise from the session. The confirmation always asks first; in a
  // superset it asks WHICH exercise of the group to remove.
  const removeExercise = idx => { focusPointerEpoch.current++; removeActiveExercise(idx) }
  const confirmRemoveExercise = idx => {
    const e = A.entries[idx]
    if (!e) return
    const hasDone = (e.sets || []).some(s => s.done)
    confirmSheet({
      title: t('Remove {0}?', exerciseNameText(exOr(e.id))),
      message: hasDone
        ? t('The sets you logged for this exercise in this session will be lost.')
        : t('This removes the exercise from your current session.'),
      confirmText: t('Remove'), danger: true, onConfirm: () => removeExercise(idx)
    })
  }
  const removeExerciseSheet = () => {
    if (unit.length > 1) {
      useUI.getState().openSheet(close => (
        <div>
          <SheetHeader title={t('Remove exercise')} />
          <div className="muted small mb-6">{t('Which exercise in this superset do you want to remove?')}</div>
          <div className="list">
            {unit.map(idx => <div key={idx} className="item" onClick={() => { close(); confirmRemoveExercise(idx) }}>
              <div className="grow"><div className={`tt ${exerciseNameClass(exOr(A.entries[idx]?.id))}`}>{exerciseNameFor(exOr(A.entries[idx]?.id))}</div></div>
              <Icon name="chevronRight" />
            </div>)}
          </div>
        </div>
      ))
    } else confirmRemoveExercise(cur)
  }

  // After the finished exercise folded away (toggle, above): the new current one is the next thing
  // to do, so if it now sits under the header or low on the screen with little more than its title
  // showing, it glides up under the header. Where it is already in reach the page stays put. Run
  // after a closing sheet has put the page back (the effort picker ticks the set as it closes).
  const revealCur = useRef(false)
  useEffect(() => {
    if (!revealCur.current) return
    revealCur.current = false
    if (!listMode) return
    return afterScrollRestore(() => {
      const el = listRef.current?.querySelector('.wl-unit.cur')
      if (!el || typeof el.getBoundingClientRect !== 'function') return
      const top = el.getBoundingClientRect().top
      const under = hdrRef.current?.getBoundingClientRect?.().bottom || 0
      const screen = window.innerHeight || 0
      if (!screen || (top >= under && top <= screen * 0.55)) return
      scrollToUnit(el, true)
    })
  }, [cur])
  // Brings a list unit to the top of the screen, under the pinned header. The header grows when
  // the name wraps and by the chip row, so the unit's scroll margin (index.css) is fed its height
  // as it is right now. A jump the eye should follow glides, unless the device or the app's Reduce
  // motion asks for less.
  const scrollToUnit = (el, glide) => {
    if (!el || typeof el.scrollIntoView !== 'function') return
    const hdrH = hdrRef.current?.offsetHeight
    if (hdrH) listRef.current?.style.setProperty('--whdr-h', hdrH + 'px')
    const still = reducedMotion()
    el.scrollIntoView(glide && !still ? { block: 'start', behavior: 'smooth' } : { block: 'start' })
  }
  // A tap on a chip at the top (#323). Cards and Focus show one unit, so the chip makes it the one
  // on screen: the marker moves because you asked it to, never on its own. The list already shows
  // every unit, so there the chip only scrolls to it and leaves "Current" where it was, the same
  // as scrolling there by hand; the frame wait is the one opening the list uses (above).
  const pickChip = chip => {
    if (listMode) {
      // A folded unit opens as you jump to it: you tapped it to see it.
      if (collapsed.has(chip.key)) setUnitOpen(chip.key, true)
      const go = () => scrollToUnit(listRef.current?.querySelector(`.wl-unit[data-unit-key="${chip.key}"]`), true)
      if (window.requestAnimationFrame) window.requestAnimationFrame(go)
      else window.setTimeout(go, 0)
      return
    }
    if (chip.unit.includes(cur)) return
    update(s => { if (s.active) s.active.cur = chip.unit[0] })
  }
  const chipRow = wc.exerciseChips && A.entries.length > 0
    ? <WorkoutChips entries={A.entries} cur={cur} onPick={pickChip} />
    : null

  // Hardware keys (issue #133) are useWorkout's. In the list the "current" exercise can be off screen. A key that moves it brings it into
  // view the way opening the list does; ticking and tapping never scroll it (see above).
  const showCurrent = () => {
    if (!listMode) return
    const scroll = () => scrollToUnit(listRef.current?.querySelector('.wl-unit.cur'))
    // After the render that moves the marker, as the effect above waits for its frame.
    if (window.requestAnimationFrame) window.requestAnimationFrame(scroll)
    else window.setTimeout(scroll, 0)
  }
  return <WorkoutScrollAnchor enabled={collapseOn} collapsed={[...collapsed].join(',')}>
    {/* In list mode the whole session scrolls under the header, so the header (name, clock,
        set counter, discard/finish, progress) stays pinned — the one thing you want in view
        while you are somewhere in the middle of a long stack. Cards mode never scrolls far. */}
    <div className={'whdr' + (listMode ? ' stick' : '')} ref={hdrRef}>
    {/* ⌄ leaves the screen and keeps the session running (the tab bar's Resume brings it back);
        in the editor of a saved workout it is the ✕ that closes the editor. Discard is in the ⋯
        menu now, and Finish is a labelled pill rather than a check that looked like a set tick: it
        opens the Finish sheet (Finish and save, Discard), the editor's Save saves at once. */}
    <div className="hdr whdr-bar">
      {editing
        ? <button className="iconbtn" aria-label={t('Close editor')} title={t('Close editor')} onClick={() => exitWorkoutEdit()}><Icon name="xmark" /></button>
        : <button className="iconbtn" aria-label={t('Minimize')} title={t('Minimize')} onClick={back}><Icon name="chevronDown" /></button>}
      <div className="whdr-mid"><div className="whdr-name">{A.name}</div><div className="sub">{(A.backfill || editing) ? fmtDate(A.d, true) : <Elapsed start={A.start} />} · {t('{0} sets', done + '/' + total)}</div></div>
      <button className="iconbtn" aria-label={t('Workout options')} title={t('Workout options')} onClick={openViewMenu}><Icon name="more" /></button>
      <button className="btn primary pill whdr-finish" aria-label={editing ? t('Save changes') : undefined}
        onClick={() => (editing ? finishWorkout() : finishWorkoutSheet({ onDiscard: discardWorkout }))}>{editing ? t('Save') : t('Finish')}</button>
    </div>
    <div className="wprog"><i style={{ width: (total ? done / total * 100 : 0) + '%' }} /></div>
    {/* In the list the chips ride in the pinned header, so any exercise is one tap away from
        anywhere in a long stack. */}
    {listMode && chipRow}
    </div>
    {editing && <p className="muted small">{t('Editing a saved workout. Date and duration stay unchanged.')}</p>}
    {A.backfill && <div className="muted small mb-4">{t('Logging a past workout, so no rest timers.')}</div>}

    {A.entries.length ? (listMode ? (
      <div className="workout-list" data-testid="workout-list" ref={listRef}>
        {units.map((u, ui) => {
          const multi = u.length > 1
          const isCur = u.includes(cur)
          const isCollapsed = collapsed.has(u.join('-'))
          // Finished and tapped open again: it says it can fold back, and does on a tap.
          const reopened = collapseOn && !isCur && !isCollapsed && opened.has(u.join('-')) && finished(u)
          return <section key={u.join('-')} className={'wl-unit' + (isCur ? ' cur' : '')} data-exidx={u[0]} data-unit-key={u.join('-')}>
            <div className="wl-hd">
              <span className="muted small">{multi ? t('Superset {0} / {1}', ui + 1, units.length) : t('Exercise {0} / {1}', ui + 1, units.length)}</span>
              <Inline as="span" gap={3}>
                {reopened && <Chip aria-expanded="true" aria-controls={'workout-unit-' + u.join('-')}
                  onClick={() => setUnitOpen(u.join('-'), false)}>{t('Fold away')}</Chip>}
                {isCur
                  ? <Tag tone="acc">{t('Current')}</Tag>
                  : <Chip onClick={() => focusUnit(u[0])}>{t('Set current')}</Chip>}
              </Inline>
            </div>
            <div id={'workout-unit-' + u.join('-')}>
            {/* One line per exercise, and the line is the way back in: a tap opens the sets again
                to fix a number, without making it the current exercise. */}
            {isCollapsed ? <button type="button" className="wl-summary" aria-expanded="false" title={t('Show the sets')}
              onClick={() => setUnitOpen(u.join('-'), true)}>
              {u.map(idx => <Inline as="span" key={idx} justify="between" gap={4}>
                <span className="fw-semibold capitalize">{exerciseNameFor(exOr(A.entries[idx].id))}</span>
                <Tag tone="acc" nocap icon="check">{t('{0} sets', A.entries[idx].sets.length)}</Tag>
              </Inline>)}
            </button> : multi ? (
              <div className="ss-card">
                <Inline justify="between" className="ss-hd">
                  <Inline as="span" gap={2.5}><Icon name="link" />{ssTitle(u)}</Inline>
                  <Button size="xs" variant="ghost" icon="link" title={t('Unpair')} onClick={() => unpairAt(u[0])}>{t('Unpair')}</Button>
                </Inline>
                {u.map((idx, k) => {
                  const entry = A.entries[idx]
                  return <div key={idx} ref={el => bindExRef(entry, el)} className="ss-ex" data-exidx={idx}>
                    {k > 0 && <div className="ss-amp">+</div>}
                    <ExerciseBlock entryIdx={idx} compact dense={dense} onSetRowRef={(setIdx, el) => bindSetRef(entry, setIdx, el)}
                      {...blockProps(idx)} />
                  </div>
                })}
              </div>
            ) : (
              <ExerciseBlock entryIdx={u[0]} dense={dense}
                onPairPrev={u[0] > 0 ? () => pairAt(u[0] - 1, u[0]) : null}
                onPairNext={u[0] < A.entries.length - 1 ? () => pairAt(u[0], u[0] + 1) : null}
                {...blockProps(u[0])} />
            )}
            </div>
          </section>
        })}
      </div>
    ) : <>
      {/* The chips stand in for "Exercise 2 / 5": the number is on the current chip, and the
          others say what is done and what is waiting (#323). */}
      {chipRow || <div className="muted small mb-3">{isSuperset ? t('Superset {0} / {1}', unitIdx + 1, units.length) : t('Exercise {0} / {1}', unitIdx + 1, units.length)}</div>}
      <SwipeCards index={unitIdx} count={units.length} revision={A}
        timerKey={timer && `${timer.endsAt}:${timer.forIdx ?? ''}`} workKey={work?.endsAt}
        onNavigate={navigateUnit} renderPreview={direction => {
          // The card slid in shows what the card itself will: in the editor, no hold to start
          // and no plates to load; in a session, the progression line, or the card grows by it
          // the moment it lands. It gets the card's own wiring for that — the preview is inert,
          // so none of it can be pressed. That includes a superset's header with its Unpair, and a
          // lone exercise's "Make superset" buttons when Settings shows them: without them the
          // header's words moved over, or the card grew by a row, as it landed.
          const adjacent = units[unitIdx + direction] || []
          if (!adjacent.length) return null
          return adjacent.length > 1 ? (
            <div className="ss-card">
              <Inline justify="between" className="ss-hd">
                <Inline as="span" gap={2.5}><Icon name="link" />{ssTitle(adjacent)}</Inline>
                <Button size="xs" variant="ghost" icon="link" title={t('Unpair')} onClick={() => unpairAt(adjacent[0])}>{t('Unpair')}</Button>
              </Inline>
              {adjacent.map((idx, k) => <div key={idx} className="ss-ex" data-exidx={idx}>
                {k > 0 && <div className="ss-amp">+</div>}
                <ExerciseBlock entryIdx={idx} compact {...blockProps(idx)} />
              </div>)}
            </div>
          ) : <ExerciseBlock entryIdx={adjacent[0]}
            onPairPrev={adjacent[0] > 0 ? () => pairAt(adjacent[0] - 1, adjacent[0]) : null}
            onPairNext={adjacent[0] < A.entries.length - 1 ? () => pairAt(adjacent[0], adjacent[0] + 1) : null}
            {...blockProps(adjacent[0])} />
        }}>
      {focusMode ? (
        <FocusView entryIdx={cur} unit={unit}
          onSelectEntry={selectFocusEntry} onAdvanceUnit={advanceFocusUnit} pointerEpoch={focusPointerEpoch.current}
          onPairPrev={onPairPrev} onPairNext={onPairNext} onUnpair={() => unpairAt(cur)}
          {...blockProps(cur)} />
      ) : isSuperset ? (
        <div className="ss-card">
          <Inline justify="between" className="ss-hd">
            <Inline as="span" gap={2.5}><Icon name="link" />{ssTitle(unit)}</Inline>
            <Button size="xs" variant="ghost" icon="link" title={t('Unpair')} onClick={() => unpairAt(cur)}>{t('Unpair')}</Button>
          </Inline>
          {unit.map((idx, k) => {
            const entry = A.entries[idx]
            return <div key={idx} ref={el => bindExRef(entry, el)} className="ss-ex" data-exidx={idx}>
              {k > 0 && <div className="ss-amp">+</div>}
              <ExerciseBlock entryIdx={idx} compact onSetRowRef={(setIdx, el) => bindSetRef(entry, setIdx, el)}
                {...blockProps(idx)} />
            </div>
          })}
        </div>
      ) : (
        <ExerciseBlock entryIdx={cur} onPairPrev={onPairPrev} onPairNext={onPairNext} {...blockProps(cur)} />
      )}
      </SwipeCards>
    </>) : <EmptyState illustration="dumbbell" title={t('Freestyle workout')} body={t('Add your first exercise and off you go.')} />}

    <Spacer size={6} />
    {!listMode && <Inline>
      <Button icon="chevronLeft" disabled={unitIdx <= 0} onClick={() => navigateUnit(-1)}>{t('Prev')}</Button>
      <Button trailingIcon="chevronRight" disabled={unitIdx < 0 || unitIdx >= units.length - 1} onClick={() => navigateUnit(1)}>{t('Next')}</Button>
    </Inline>}
    {!listMode && <Spacer size={5} />}
    {wc.exerciseButtons && listMode && A.entries.length > 0 && <div className="muted small mb-3">{t('Move, swap and remove below act on the exercise marked {0}.', t('Current'))}</div>}
    <Button onClick={addExercise} icon="plus">{t('Add exercise')}</Button>
    {wc.exerciseButtons && A.entries.length > 0 && <>
      <Spacer size={3} />
      <Inline>
        <Button size="sm" icon="chevronUp" aria-label={t('Move up')}
          disabled={!!work || !canMoveActiveWorkoutUnit(A, cur, -1)} onClick={() => moveCurrentUnit(-1)}>{t('Move up')}</Button>
        <Button size="sm" trailingIcon="chevronDown" aria-label={t('Move down')}
          disabled={!!work || !canMoveActiveWorkoutUnit(A, cur, 1)} onClick={() => moveCurrentUnit(1)}>{t('Move down')}</Button>
      </Inline>
      <Spacer size={3} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button size="sm" icon="swap" aria-label={t('Swap exercise')} disabled={!!work}
          onClick={() => swapExercise(cur)}>{t('Swap exercise')}</Button>
      </div>
      <Spacer size={3} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button size="sm" icon="minus" className="ink-danger" disabled={!!work} onClick={removeExerciseSheet}>{t('Remove exercise')}</Button>
      </div>
    </>}
    <Spacer size={5} />
    {/* Wrapping up is when you know how the session went, so the note sits with the finish
        button rather than somewhere in the header. */}
    <div className="mb-5" style={{ display: 'flex', justifyContent: 'center' }}>
      <Button size="sm" icon="note" variant={A.note ? 'tinted' : undefined} onClick={sessionNoteSheet}>
        {A.note ? t('Edit session note') : t('Add session note')}
      </Button>
    </div>
    {(() => {
      const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
      const allDone = A.entries.length > 0 && exDone === A.entries.length
      return <button className={allDone ? 'btn primary' : 'btn ghost dim'} onClick={finishWorkout}>
        {editing ? t('Save changes') : allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
      </button>
    })()}
    <div className="workout-end-spacer" />
  </WorkoutScrollAnchor>
}

export default function Workout() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}
