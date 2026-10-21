import { useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { isCardio, isBodyweightEq, isAssisted, smOf, isCustomEx, figureOf } from '../lib/exercises.js'
import { fmtNum } from '../lib/format.js'
import { defaultConfig, modeOf, EFFORT, capEffort, stepEffort, isBw, isPerSide, sideReps, MAX_PLANNED_WARMUPS } from '../lib/history.js'
import { toScale, rirOf, EFFORT_PRESETS, effortColor, effortInk } from '../lib/effort.js'
import { t, tn, descFor, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { useExerciseStill } from '../components/CustomMedia.jsx'
import Stepper from '../components/Stepper.jsx'
import { durationSheet } from '../components/DurationWheel.jsx'
import { REST_MAX, fmtRest } from '../lib/duration.js'
import Icon from '../components/Icon.jsx'
import { useSheetClosed } from '../components/presence.jsx'
import { Button, Switch, Row, NumberField } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import DsButton from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import MenuList from '../ds/MenuList.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import SetTable from '../ds/SetTable.jsx'
import Tag from '../ds/Tag.jsx'
import { glyphOf, GLYPH_GROUPS } from '../lib/glyphs.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { isBellEx, dbLoadOf, dbLoadFor } from '../lib/dumbbells.js'
import { policyFor, defaultIncrement, POLICIES_FOR, POLICY_NAME, POLICY_DESC, MAX_BW_SETS, MAX_TRIPLE_SETS } from '../lib/progression.js'
import { normalizeRepRange } from '../lib/rep-range.js'
import { isBackoff, backoffWeights } from '../lib/backoff.js'
import { isPyramid, normalizePyramid, normalizePyramidRest, normalizePyramidWeight, pyramidFromFlat, flatFromPyramid, pyramidLabel, PYRAMID_MAX, MAX_PYRAMID_SETS, PYRAMID_PRESETS } from '../lib/pyramid.js'
import { speedUnitOf, toSpeed, fromSpeed } from '../lib/speed.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { drawerFlow } from '../store/useUI.js'
import { ui } from './shared.js'
import { BarWeightEditor, DbLoadPicker } from './equipment.jsx'
import { customExSheet, trainedBy } from './exercise.jsx'

/* ============================ exercise config ============================ */
// Progression settings for one exercise (issue #17). Shown inside the config sheet because
// "how does this lift go up" belongs next to sets and reps, not in a separate screen. Left
// on "follow the routine" it inherits, so most people never touch it.
const progressionStepOf = (c, mode, ex, unit) =>
  c.inc >= 0 ? c.inc : (mode === 'time' ? 5 : defaultIncrement(ex.id, unit))
// Back-off sets step down by the same Step, so a plan using them needs one even with no rule.
const progressionStepIsValid = (step, policy, backoff = false) =>
  (policy === 'off' && !backoff) || (Number.isFinite(step) && step > 0)
// Back-off sets (lib/backoff.js) are offered where there is a load to step down: rep work on a
// loaded exercise, not a pyramid (it owns each set), not a rest-pause (one work set), not an
// assistance machine (less load is harder there).
const backoffOffered = (c, mode, ex, bw) => mode === 'reps' && !bw && !isAssisted({ ...c, id: ex.id })
  && !(Array.isArray(c.pyramid) && c.pyramid.length) && c.intensifier?.type !== 'restpause'
// The intensifier chips that choosing one turns off (the sheet's intensifier row).
const INTENSIFIER_CLASHES = {
  pyramid: ['failure', 'dropset', 'restpause', 'backoff'],
  failure: ['pyramid'],
  dropset: ['pyramid', 'restpause'],
  restpause: ['pyramid', 'dropset', 'backoff'],
  backoff: ['pyramid', 'restpause'],
}

// Double and triple progression both climb a rep range (`repsMin`..`reps`), so the sheet keeps it
// normalised for either.
const climbsRange = policy => policy === 'double' || policy === 'triple'
// Triple progression's set ceiling while it is being edited: never below the starting sets.
const setsMaxOf = c => Math.max(Math.max(1, Math.round(c.sets) || 1), Math.min(MAX_TRIPLE_SETS, Math.round(c.setsMax) || 0))

// The rule chips, its sentence and the numbers it needs. `backoff` is back-off sets being on, which
// needs the Step even with no rule.
function ProgressionFields({ ex, mode, c, setC, routine, unit, perSide, bw, backoff }) {
  // Triple progression adds sets and then load. Bodyweight work with nothing added already climbs
  // reps and then sets on its own (the rep ceiling below), and has no load to finish the cycle
  // with, so it is not offered there.
  const options = (POLICIES_FOR[mode] || ['off']).filter(p => p !== 'triple' || !bw || c.weight > 0 || c.prog === 'triple')
  if (options.length < 2) return null
  const inherited = policyFor({ id: ex.id }, routine, mode)
  const active = policyFor({ ...c, id: ex.id }, routine, mode)
  const inc = progressionStepOf(c, mode, ex, unit)
  const invalid = !progressionStepIsValid(inc, active, backoff)
  const stride = mode === 'reps' && perSide ? 2 : 1
  const range = climbsRange(active) ? normalizeRepRange(c.reps, c.repsMin, stride) : null
  const epleyEligible = mode === 'reps' && !isBw({ ...c, id: ex.id }) && (active === 'linear' || climbsRange(active))
  // What is typed is shown as typed, 0 for an emptied field included: shown as the default 90
  // instead, the field could not be emptied to type a new percentage.
  const deloadPercent = Math.round((c.deloadFactor != null && Number.isFinite(Number(c.deloadFactor)) ? Number(c.deloadFactor) : 0.9) * 100)
  const setRule = v => setC(x => {
    const next = { ...x, prog: v || undefined }
    // Greyskull's final set is taken to failure by design, so choosing it here switches "Last set
    // to failure" on too, unless it was already decided. Only the sheet's draft: nothing is
    // written until Save, and a plan saved before stays what it was.
    if (v === 'greyskull' && next.lastToFailure == null) next.lastToFailure = true
    const picked = policyFor({ ...next, id: ex.id }, routine, mode)
    // Triple progression opens with room for two more sets, the usual 3 to 5.
    if (picked === 'triple' && !(next.setsMax > 0)) next.setsMax = Math.min(MAX_TRIPLE_SETS, Math.max(1, Math.round(next.sets) || 1) + 2)
    return climbsRange(picked)
      ? { ...next, ...normalizeRepRange(next.reps, next.repsMin, stride) }
      : next
  })
  // Double progression says it with the numbers on the sheet; the other rules keep their sentence.
  const sentence = active === 'double' && range && !invalid && mode === 'reps' && !(bw && !(c.weight > 0))
    ? t('When every set hits {0} reps, the next workout adds {1} and starts again at {2}.', range.reps, fmtNum(inc) + ' ' + unit, range.repsMin)
    : t(POLICY_DESC[active])
  return <>
    <h4 className="g-cfg-h">{t('Progression')}</h4>
    <ChipGroup label={t('Progression')} value={c.prog || ''} onChange={setRule}
      options={[{ value: '', label: t('Follow the routine ({0})', t(POLICY_NAME[inherited])) }, ...options.map(p => ({ value: p, label: t(POLICY_NAME[p]) }))]} />
    <p className="g-cfg-note">{sentence}</p>
    {/* Double progression on a weighted exercise fills this row with four steppers; `cfgrow-4`
        lets it wrap into two pairs on phones, where four abreast left the inputs a few px wide. */}
    {(active !== 'off' || backoff) && <div className={'row cfgrow g-cfg-steps' + ((active === 'double' && epleyEligible) || active === 'triple' ? ' cfgrow-4' : '')}>
      <Stepper label={mode === 'time' ? t('Step (seconds)') : t('Step ({0})', unit)} value={inc}
        step={mode === 'time' ? 5 : 1.25} decimal={mode !== 'time'} invalid={invalid} className={invalid ? 'invalid' : ''}
        onChange={v => setC(x => ({ ...x, inc: v }))} />
      {climbsRange(active) && <>
        {/* The draft stays as typed: normalising on every keystroke turned "12" into 92 (the
            "1" was pulled above the lower bound first). Save and the engine normalise anyway. */}
        <Stepper label={t('Reps from')} value={c.repsMin ?? range.repsMin} step={stride} decimal={false}
          onChange={v => setC(x => ({ ...x, repsMin: v }))} />
        <Stepper label={t('Reps up to')} value={c.reps ?? range.reps} step={stride} decimal={false}
          onChange={v => setC(x => ({ ...x, reps: v }))} />
      </>}
      {/* Where triple progression stops adding sets; the Sets above are where it starts. */}
      {active === 'triple' && <Stepper label={t('Sets up to')} value={c.setsMax ?? setsMaxOf(c)} step={1} decimal={false}
        onChange={v => setC(x => ({ ...x, setsMax: v }))} />}
      {epleyEligible && <Stepper label={t('Deload 1RM (%)')} value={deloadPercent} step={5} min={50} max={95} decimal={false}
        onChange={v => setC(x => ({ ...x, deloadFactor: Number(v) / 100 }))} />}
    </div>}
    {invalid && <div className="small g-cfg-alert" role="alert">
      {t('Enter a positive step to use this progression rule.')}
    </div>}
  </>
}

// The drop-set and rest-pause fields take what is typed and are held to their minimums once left
// (Stepper `min`). A sheet saved from a field still being typed in is held to them here: an
// emptied weight drop would otherwise plan drops at the same weight.
const intensifierToSave = x => (x.type === 'dropset'
  ? { ...x, count: Math.max(1, Math.round(x.count) || 0), pct: Math.max(5, Number(x.pct) || 0) }
  : x.type === 'restpause'
    ? { ...x, totalReps: Math.max(1, Math.round(x.totalReps) || 0), restSec: Math.max(5, Number(x.restSec) || 0) }
    : x)

// T5.5 exercise settings, a full drawer. `options` is opt-in: { superset, onSupersetChange(on) } adds
// "Superset with the exercise above" (the routine editor passes it), and { removeUndo: true } says the
// caller's `onDelete` offers an Undo, so Remove names it.
function ExConfig({ ex, existing, onSave, onDelete, onReplace, close, routine, initial, saveLabel, options }) {
  const st = useStore(s => s.S)
  const speedUnit = speedUnitOf(st)
  const seed = existing || initial || defaultConfig(ex.id)
  // Cardio as the slot is logged, not by the body part alone: a custom exercise on Legs logged as
  // cardio carries `mode: 'cardio'` (defaultConfig), and read as reps it was saved as 1 × 10.
  const cardio = modeOf({ ...seed, id: ex.id }) === 'cardio'
  const [c, setC] = useState(() => {
    const cfg = { ...seed }
    // A session's target carries the meaning of its dumbbell weight as a stamp (lib/dumbbells.js);
    // one that only repeats the exercise's own default is not the slot's choice, so it is not kept.
    if (cfg.dbLoad != null && dbLoadOf(cfg.dbLoad) === dbLoadFor(st, ex.id)) delete cfg.dbLoad
    return climbsRange(policyFor({ ...cfg, id: ex.id }, routine, modeOf({ ...cfg, id: ex.id })))
      ? { ...cfg, ...normalizeRepRange(cfg.reps, cfg.repsMin, isPerSide(cfg) ? 2 : 1) }
      : cfg
  })
  const [inSuperset, setInSuperset] = useState(!!options?.superset)
  // Workout drawers-M2: the part of the workout (lib/workout-parts.js), held by the caller.
  const [part, setPart] = useState(options?.part || 'main')
  // Cardio keeps its own duration+speed form; the reps/time choice (issue #16) is offered for
  // everything else, which is where the gap was — planks, hangs, wall sits, loaded carries.
  const mode = cardio ? 'cardio' : modeOf({ ...c, id: ex.id })
  // Both default from the dataset and are then whatever the config says — see isBw.
  const bw = !cardio && isBw({ ...c, id: ex.id })
  const perSide = isPerSide(c)
  // Pyramid sets: one rep target per set, in place of the flat Sets × Reps (CONTEXT.md).
  const pyramid = mode === 'reps' && isPyramid({ ...c, mode })
  const setPyramidAt = (i, v) => setC(x => ({ ...x, pyramid: x.pyramid.map((p, j) => (j === i ? v : p)) }))
  const progressionPolicy = policyFor({ ...c, id: ex.id }, routine, mode)
  const canBackoff = backoffOffered(c, mode, ex, bw)
  const backoff = canBackoff && c.backoff === true
  const progressionStepInvalid = !progressionStepIsValid(progressionStepOf(c, mode, ex, st.unit), progressionPolicy, c.backoff === true && canBackoff)
  const activePolicy = progressionPolicy
  // Both climb a range: the flat Reps stepper gives way to "Reps from" / "Reps up to".
  const ranged = mode === 'reps' && climbsRange(activePolicy)
  const triple = mode === 'reps' && activePolicy === 'triple'
  // Keep whatever the other mode already had (sets, weight) and fill only what is missing.
  const setMode = m => setC(x => {
    const next = { ...defaultConfig(ex.id, m), ...x, mode: m }
    return m === 'reps' && climbsRange(policyFor({ ...next, id: ex.id }, routine, 'reps'))
      ? { ...next, ...normalizeRepRange(next.reps, next.repsMin, isPerSide(next) ? 2 : 1) }
      : next
  })
  const save = () => {
    if (progressionStepInvalid) return
    close()
    const sets = Math.max(1, Math.round(c.sets) || (cardio ? 1 : 3))
    // Only carry progression settings that differ from the inherited default, so a plan file
    // stays readable and "follow the routine" keeps meaning exactly that.
    const prog = {}
    if (c.prog) prog.prog = c.prog
    if (c.inc > 0) prog.inc = c.inc
    // Epley deloading is configurable per occurrence, but the default stays omitted so older
    // plans retain their compact shape and keep the existing 90% behaviour.
    if (mode === 'reps' && !bw && (activePolicy === 'linear' || climbsRange(activePolicy))) {
      const deloadFactor = Math.max(0.5, Math.min(0.95, Number(c.deloadFactor) || 0.9))
      if (deloadFactor !== 0.9) prog.deloadFactor = deloadFactor
    }
    // Written only when it differs from what the dataset already says, so a barbell config
    // stays exactly the shape it was before these flags existed.
    // `bodyweight` is true of a hold as much as of a set of reps. `side` used to be dropped on
    // switching to Time too — a timed hold has no rep count to split — but "per side" does not
    // have to mean splitting: for a hold it means doing the whole thing once per side, so the
    // flag now survives the switch and buildWorkSets doubles the planned sets instead.
    const flags = {}
    if (bw !== isBodyweightEq(ex.id)) flags.bodyweight = bw
    // Free text, e.g. a pyramid's per-set loading ("bar only, +1 plate/side each set") — the
    // sets/reps/weight fields are one flat target and have no room for that on their own.
    // Mode-independent, so it is spread in below rather than folded into `flags`.
    const note = (c.note || '').trim().slice(0, 500)
    const withNote = note ? { note } : {}
    // Only written when there are any, so a plan that never asked for warm-ups keeps the exact
    // shape it had — and reads back as 0 either way (buildSets).
    const warmupSets = Math.max(0, Math.min(MAX_PLANNED_WARMUPS, Math.round(c.warmupSets) || 0))
    const withWarmups = warmupSets ? { warmupSets } : {}
    // Per-exercise rest (issue #10): written only when a positive value was set, so 0 keeps
    // inheriting the global rest timer and a config that never touched it stays the shape it
    // was. Mode-independent — a heavy triple, a plank and a cardio interval all rest.
    const restSec = Math.max(0, Math.round(c.restSec) || 0)
    const withRest = restSec ? { restSec } : {}
    // What a dumbbell weight means in this slot (lib/dumbbells.js): written only when the slot
    // picked its own, so every other config stays the shape it was.
    const dbLoad = isBellEx(ex) && !bw ? dbLoadOf(c.dbLoad) : null
    const withMeant = dbLoad ? { dbLoad } : {}
    // "Last set to failure": written only when on, so a plan that never asked keeps its shape.
    const withFailure = c.lastToFailure === true ? { lastToFailure: true } : {}
    // Off the Cardio body part only the mode says cardio, so it is written there (defaultConfig).
    if (cardio) onSave({ sets, min: Math.max(1, Math.round(c.min) || 20), speed: Math.max(0, c.speed || 8), ...(isCardio(ex.id) ? {} : { mode: 'cardio' }), ...withNote, ...withRest })
    else if (mode === 'time') onSave({ sets, mode: 'time', sec: Math.max(1, Math.round(c.sec) || 45), weight: Math.max(0, c.weight || 0), ...flags, ...(perSide ? { side: true } : {}), ...prog, ...withNote, ...withWarmups, ...withRest, ...withMeant, ...withFailure })
    else {
      // A unilateral target is stored even: the split has to divide, and a typed 15 would
      // otherwise plan seven reps on one side and eight on the other, every session.
      const typed = Math.max(1, Math.round(c.reps) || 10)
      const stride = perSide ? 2 : 1
      let reps = perSide ? Math.ceil(typed / stride) * stride : typed
      let range = null
      if (ranged) {
        range = normalizeRepRange(reps, c.repsMin, stride)
        reps = range.reps
      }
      const out = { sets, mode: 'reps', reps, weight: Math.max(0, c.weight || 0), ...flags, ...(perSide ? { side: true } : {}), ...prog, ...withNote, ...withWarmups, ...withRest, ...withMeant }
      // The list is the prescription; sets and reps follow it, so everything that reads the
      // flat target (a config sheet reopened with the toggle off, older builds) still makes sense.
      const list = pyramid ? normalizePyramid(c.pyramid, stride) : []
      if (list.length) Object.assign(out, flatFromPyramid(list), { pyramid: list })
      const pyramidRest = list.length ? normalizePyramidRest(c.pyramidRest, list.length) : []
      if (pyramidRest.length) out.pyramidRest = pyramidRest
      const pyramidWeight = list.length && !bw ? normalizePyramidWeight(c.pyramidWeight, list.length) : []
      if (pyramidWeight.length) out.pyramidWeight = pyramidWeight
      if (ranged) out.repsMin = range.repsMin
      // Triple progression's set ceiling, written only when it is above the starting sets: at the
      // same number it would add nothing, and the plan keeps the shape it had.
      if (triple && !list.length && setsMaxOf(c) > sets) out.setsMax = setsMaxOf(c)
      // A ceiling below the working reps would tell you to add a set on day one.
      if (bw && !(out.weight > 0) && c.repsMax > 0) out.repsMax = Math.max(reps, Math.round(c.repsMax))
      // Every set in this exercise becomes a drop-set/rest-pause (buildSets stamps the rows) —
      // decided here, in the plan, not re-decided live each time you train it.
      if (!list.length && c.intensifier && c.intensifier.type) out.intensifier = intensifierToSave(c.intensifier)
      // Back-off sets: written only when on, and only where the sheet offered them.
      if (c.backoff === true && backoffOffered(out, 'reps', ex, bw) && isBackoff({ ...out, backoff: true })) out.backoff = true
      // A pyramid has its own Max set for this, so the flag is not offered (or kept) there.
      if (!list.length) Object.assign(out, withFailure)
      onSave(out)
    }
  }

  // ---- the sets table: one summary row for a mode with one value for all its sets, a row a set
  // for a pyramid ----
  const field = key => v => setC(x => ({ ...x, [key]: v }))
  const num = (value, onChange, label, extra) => ({ value, onChange, label, ...extra })
  const restLine = c.restSec > 0 ? fmtRest(c.restSec) : t('Default ({0})', fmtRest(st.restSec))
  const restCell = {
    text: fmtRest(c.restSec > 0 ? c.restSec : st.restSec), muted: !(c.restSec > 0), label: t('Rest for this exercise') + ': ' + restLine,
    // On the same wheel as the default rest timer (v1.3.11): 0:00 is "no rest of its own", so
    // the default applies, and the cell says which default that is.
    onClick: () => durationSheet({
      title: t('Rest for this exercise'), value: c.restSec > 0 ? c.restSec : 0, max: REST_MAX,
      off: t('Default ({0})', fmtRest(st.restSec)),
      footer: t('Rest after each set of this exercise. 0:00 means your default rest.'),
      onDone: v => setC(x => ({ ...x, restSec: v })),
    }),
  }
  const weightHead = t('Weight ({0})', st.unit)
  const speedHead = speedUnit === 'mph' ? t('Speed (mph)') : t('Speed (km/h)')
  const rangeNow = ranged ? normalizeRepRange(c.reps, c.repsMin, perSide ? 2 : 1) : null
  const addSet = key => () => setC(x => ({ ...x, [key]: Math.max(1, Math.round(x[key]) || 0) + 1 }))
  let table
  if (cardio) {
    table = {
      columns: [t('Intervals'), t('Minutes'), speedHead, t('Rest')],
      rows: [{ key: 'all', cells: [
        num(c.sets, field('sets'), t('Intervals')), num(c.min, field('min'), t('Minutes')),
        num(toSpeed(c.speed, speedUnit), v => setC(x => ({ ...x, speed: fromSpeed(v, speedUnit) })), speedHead, { decimal: true }), restCell] }],
      add: { label: t('Add set'), onClick: addSet('sets') },
    }
  } else if (mode === 'time') {
    table = {
      columns: [t('Sets'), t('Seconds'), weightHead, t('Rest')],
      // A bodyweight hold's load is the "Added" row below — showing both put two fields on one value.
      rows: [{ key: 'all', cells: [
        num(c.sets, field('sets'), t('Sets')), num(c.sec, field('sec'), t('Seconds')),
        bw ? null : num(c.weight, field('weight'), weightHead, { decimal: true }), restCell] }],
      add: { label: t('Add set'), onClick: addSet('sets') },
    }
  } else if (pyramid) {
    const sync = (key, i, v) => setC(x => {
      const list = Array.from({ length: x.pyramid.length }, (_, j) => (x[key] || [])[j] || 0)
      list[i] = v
      return { ...x, [key]: list }
    })
    const aux = (i, on) => ({ text: t('Max'), label: t('Set {0} max', i + 1), pressed: on, onClick: () => setPyramidAt(i, on ? (c.reps || 10) : PYRAMID_MAX) })
    table = {
      columns: [t('Sets'), t('Reps'), weightHead, t('Rest (s)')],
      rows: c.pyramid.map((p, i) => ({
        key: i,
        cells: [
          { text: String(i + 1), muted: true },
          p === PYRAMID_MAX
            ? { text: t('Max'), aux: aux(i, true) }
            : num(p, v => setPyramidAt(i, v), t('Set {0} reps', i + 1), { min: 1, aux: aux(i, false) }),
          // Bodyweight work has its one "Added" load below instead.
          bw ? null : num((c.pyramidWeight || [])[i] || 0, v => sync('pyramidWeight', i, v), t('Set {0} weight', i + 1), { decimal: true }),
          num((c.pyramidRest || [])[i] || 0, v => sync('pyramidRest', i, v), t('Set {0} rest (s)', i + 1)),
        ],
        remove: c.pyramid.length > 1 ? { label: t('Remove set {0}', i + 1), onClick: () => setC(x => ({ ...x, pyramid: x.pyramid.filter((_, j) => j !== i), pyramidRest: x.pyramidRest?.filter((_, j) => j !== i), pyramidWeight: x.pyramidWeight?.filter((_, j) => j !== i) })) } : undefined,
      })),
      add: {
        label: t('Add set'), disabled: c.pyramid.length >= MAX_PYRAMID_SETS,
        onClick: () => setC(x => ({
          ...x,
          pyramid: [...x.pyramid, x.pyramid[x.pyramid.length - 1]],
          // The new set copies the last one's rest too, like its target.
          pyramidRest: x.pyramidRest?.length ? [...x.pyramid.map((_, j) => x.pyramidRest[j] || 0), x.pyramidRest[x.pyramid.length - 1] || 0] : x.pyramidRest,
          pyramidWeight: x.pyramidWeight?.length ? [...x.pyramid.map((_, j) => x.pyramidWeight[j] || 0), x.pyramidWeight[x.pyramid.length - 1] || 0] : x.pyramidWeight,
        })),
      },
    }
  } else {
    // Rest-pause always trains as exactly two rows — a warm-up at this rep count, then one
    // rest-pause work set — so "Sets" has nothing left to mean and only invites a mismatch.
    const restPause = c.intensifier?.type === 'restpause'
    table = {
      columns: [t('Sets'), t('Reps'), weightHead, t('Rest')],
      rows: [{ key: 'all', cells: [
        restPause ? null : num(c.sets, field('sets'), triple ? t('Sets from') : t('Sets')),
        // A range is edited under Progression, where its two ends are.
        ranged ? { text: (c.repsMin ?? rangeNow.repsMin) + '–' + (c.reps ?? rangeNow.reps) } : num(c.reps, field('reps'), t('Reps')),
        // On bodyweight work the weight is the "Added" row below, once there is a belt to describe.
        bw ? null : num(c.weight, field('weight'), weightHead, { decimal: true }), restCell] }],
      add: restPause ? undefined : { label: t('Add set'), onClick: addSet('sets') },
    }
  }

  // ---- the intensifier chips. They combine the way the data does: the last set to failure goes with
  // a drop-set, rest-pause or back-off sets, and back-off with a drop-set. A pyramid shapes every
  // set itself, so it goes alone (and goes back to the flat sets, its list kept as a draft, when
  // another chip is chosen); a drop-set and rest-pause are one field, and rest-pause has one work
  // set, which leaves nothing to back off from. "None" clears them all. ----
  const restPauseOn = c.intensifier?.type === 'restpause'
  const intensifiers = [
    pyramid && 'pyramid',
    c.intensifier?.type,
    backoff && 'backoff',
    !cardio && !pyramid && c.lastToFailure === true && 'failure',
  ].filter(Boolean)
  const setIntensifiers = (next, tapped) => setC(x => {
    let chosen = tapped === '' ? [] : next.filter(Boolean)
    if (tapped && chosen.includes(tapped)) {
      const without = INTENSIFIER_CLASHES[tapped] || []
      chosen = chosen.filter(v => v === tapped || !without.includes(v))
    }
    const flat = isPyramid({ ...x, mode }) && !chosen.includes('pyramid')
      ? { ...x, ...flatFromPyramid(x.pyramid), pyramidDraft: x.pyramid, pyramid: undefined } : { ...x }
    const out = { ...flat, intensifier: undefined, lastToFailure: undefined, backoff: undefined }
    if (chosen.includes('pyramid')) return isPyramid({ ...x, mode }) ? out : { ...out, pyramid: x.pyramidDraft || pyramidFromFlat(out) }
    if (chosen.includes('failure')) out.lastToFailure = true
    if (chosen.includes('backoff')) out.backoff = true
    if (chosen.includes('dropset')) out.intensifier = { type: 'dropset', count: x.intensifier?.count || 1, pct: x.intensifier?.pct || 20 }
    // The activation set's own reps are whatever "Reps" above already says — a
    // rest-pause plan only adds two new numbers: the total extra reps wanted past
    // it, and the rest between the bursts that total gets split into.
    if (chosen.includes('restpause')) out.intensifier = { type: 'restpause', totalReps: x.intensifier?.totalReps || x.reps || 8, restSec: x.intensifier?.restSec || st.restPauseSec || 15 }
    return out
  })
  const intensifierOptions = [
    { value: '', label: t('None') },
    ...(!cardio ? [{ value: 'failure', label: t('Last set to failure') }] : []),
    ...(mode === 'reps' ? [{ value: 'dropset', label: t('Drop-set') }, { value: 'restpause', label: t('Rest-pause') }, { value: 'pyramid', label: t('Pyramid sets') }] : []),
    // Offered where there is a load to step down, and never over an assistance machine.
    ...(mode === 'reps' && !bw && !isAssisted({ ...c, id: ex.id }) ? [{ value: 'backoff', label: t('Back-off sets') }] : []),
  ]
  const backoffStep = progressionStepOf(c, mode, ex, st.unit)
  // "26 → 24 → 22 kg": what the sets will open at, from the weight and step typed above.
  const backoffPreview = backoff && c.weight > 0 && backoffStep > 0
    ? backoffWeights(c.weight, Math.max(1, Math.round(c.sets) || 1), backoffStep).map(fmtNum).join(' → ') + ' ' + st.unit
    : ''

  const secondaries = cardio ? [] : (ex.secondaries?.length ? ex.secondaries : smOf(ex)).filter(trainedBy(ex)).slice(0, 3)
  const still = useExerciseStill(ex, figureOf(st))
  const menu = [
    onReplace && { key: 'replace', icon: 'swap', label: t('Replace exercise'), detail: t('Similar exercises first'), onClick: () => drawerFlow(onReplace) },
    isCustomEx(ex) && { key: 'edit', icon: 'pencil', label: t('Edit or delete this exercise'), onClick: () => drawerFlow(() => customExSheet(ex)) },
    onDelete && { key: 'remove', icon: 'trash', tone: 'danger', label: t('Remove from routine'), detail: options?.removeUndo ? t('Undo for 8 s') : undefined, onClick: () => { close(); onDelete() } },
  ].filter(Boolean)

  return <BottomSheet type="full" title={<span className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</span>} chip={routine?.name || undefined} chipIcon="clipboard"
    footer={<DsButton block disabled={progressionStepInvalid} onClick={save}>{saveLabel || (existing ? t('Done') : t('Add to routine'))}</DsButton>}>
    <div className="g-cfg">
      <div className="g-cfg-top">
        {still ? <img src={still} alt="" width="64" height="64" /> : <span className="g-cfg-ph"><Icon name="dumbbell" className="g-icon" /></span>}
        <span className="g-cfg-nm">
          <b className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</b>
          <span>{t(MUSCLE_NAME[ex.tg] || ex.tg || ex.bp)} · {t(ex.eq)}</span>
        </span>
      </div>
      {/* The same tags the exercise detail sheet shows, secondaries included: choosing what goes
          into a plan is exactly when "what else does this hit" matters. Custom exercises and the
          newer metadata name muscles by the map's ids ("forearm", "gluteal"), which only
          MUSCLE_NAME turns into a translatable label. */}
      {(cardio || secondaries.length > 0) && <div className="g-cfg-tags">
        {cardio && <Tag icon="figureRun">{t('Cardio')}</Tag>}
        {secondaries.map((s, i) => <Tag key={i} tone="muted">{t(MUSCLE_NAME[s] || s)}</Tag>)}
      </div>}
      {descFor(ex) && <p className="g-cfg-note">{descFor(ex)}</p>}
      {!cardio && <div className="g-cfg-mode">
        <SegmentedControl label={t('Reps or time')} value={mode} onChange={setMode} options={[{ value: 'reps', label: t('Reps') }, { value: 'time', label: t('Time') }]} />
      </div>}

      <SetTable label={t('Sets')} columns={table.columns} rows={table.rows} add={table.add} />
      {pyramid && <>
        {/* Presets replace the list (and its rests and weights) in one tap; the sheet is not saved
            until Done. */}
        <ChipGroup scroll label={t('Pyramid sets')} value={null}
          onChange={k => setC(x => ({ ...x, pyramid: [...PYRAMID_PRESETS[k]], pyramidRest: undefined, pyramidWeight: undefined }))}
          options={PYRAMID_PRESETS.map((preset, k) => ({ value: k, label: pyramidLabel(preset) }))} />
        <p className="g-cfg-note">{t('A set left at 0 rest uses the exercise’s rest.')}</p>
        {!bw && <p className="g-cfg-note">{t('A set left at 0 weight starts from that set’s weight last time.')}</p>}
      </>}
      {restPauseOn && <p className="g-cfg-note">
        {t('Rest-pause always trains as one warm-up set at this rep count, then one rest-pause work set. "Sets" isn’t used here.')}
      </p>}
      {mode === 'time' && !bw && <p className="g-cfg-note">
        {t('A timer runs while you hold the set. Leave the weight at 0 for bodyweight holds.')}
      </p>}
      <p className="g-cfg-note">{t('Rest after each set of this exercise. 0:00 means your default rest.')}</p>

      {/* A stepper is too wide to sit in a list row next to a label — it squeezes the text to
          one word per line — so added weight gets the same full-width treatment as sets and
          reps, with its explanation underneath. */}
      {bw && <>
        <div className="row cfgrow g-cfg-steps">
          <Stepper label={t('Added ({0})', st.unit)} value={c.weight || 0} step={2.5}
            onChange={v => setC(x => ({ ...x, weight: v }))} />
        </div>
        <p className="g-cfg-note">{t('For dips or pull-ups with a belt. Progression then follows the weight.')}</p>
      </>}
      {/* The rep ceiling only means something when there is no load to add instead. */}
      {mode === 'reps' && bw && !(c.weight > 0) && <>
        <div className="row cfgrow g-cfg-steps">
          <Stepper label={t('Top of the range')} value={c.repsMax || 0} step={1} decimal={false}
            onChange={v => setC(x => ({ ...x, repsMax: v }))} />
        </div>
        <p className="g-cfg-note">
          {c.repsMax > 0
            ? t('Reps climb to {0}, then a set is added and the reps start over. At {1} sets it asks you to add weight instead.', c.repsMax, MAX_BW_SETS)
            : t('Reps climb by one whenever every set was clean. Set a ceiling to add sets instead of reps forever.')}
        </p>
      </>}

      {pyramid
        ? <p className="g-cfg-note">{t('Weight is up to you: pyramid sets are not progressed automatically.')}</p>
        : <ProgressionFields ex={ex} mode={mode} c={c} setC={setC} routine={routine} unit={st.unit} perSide={perSide} bw={bw} backoff={backoff} />}

      <h4 className="g-cfg-h">{t('Intensifier')}</h4>
      <ChipGroup multi label={t('Intensifier')} value={intensifiers.length ? intensifiers : ['']} onChange={setIntensifiers} options={intensifierOptions} />
      {c.intensifier?.type === 'dropset' && <div className="row cfgrow g-cfg-steps">
        <Stepper label={t('Drops')} value={c.intensifier.count} step={1} min={1} decimal={false}
          onChange={v => setC(x => ({ ...x, intensifier: { ...x.intensifier, count: v } }))} />
        <Stepper label={t('Weight drop (%)')} value={c.intensifier.pct} step={5} min={5} decimal={false}
          onChange={v => setC(x => ({ ...x, intensifier: { ...x.intensifier, pct: v } }))} />
      </div>}
      {restPauseOn && <div className="row cfgrow g-cfg-steps">
        <Stepper label={t('Rest-pause reps')} value={c.intensifier.totalReps} step={1} min={1} decimal={false}
          onChange={v => setC(x => ({ ...x, intensifier: { ...x.intensifier, totalReps: v } }))} />
        <Stepper label={t('Rest (s)')} value={c.intensifier.restSec} step={5} min={5} decimal={false}
          onChange={v => setC(x => ({ ...x, intensifier: { ...x.intensifier, restSec: v } }))} />
      </div>}
      {c.intensifier?.type && <p className="g-cfg-note">
        {c.intensifier.type === 'dropset'
          ? t('Every set becomes a drop-set: after the main set, {0} drop(s) with no rest, each about {1}% lighter.', c.intensifier.count, c.intensifier.pct)
          : t('Every set becomes rest-pause: {0} reps to start, then {1} more split into short bursts, {2}s rest before each, roughly halving each time.', c.reps || 0, c.intensifier.totalReps, c.intensifier.restSec)}
      </p>}
      {intensifiers.includes('failure') && <p className="g-cfg-note">{t('The last set goes until nothing is left, and counts as all-out effort unless you rate it.')}</p>}
      {intensifiers.includes('backoff') && <p className="g-cfg-note">
        {backoffPreview
          ? t('Sets open at {0}. The first set goes up when every set reaches its reps, and the rest follow it.', backoffPreview)
          : t('The first set goes up when every set reaches its reps, and the rest follow it.')}
      </p>}

      <div className="sect-b g-cfg-opts">
        {/* Planned warm-ups: the session used to start at the work weight and you added every
            warm-up by hand, every time. Rest-pause is excluded because it builds its own warm-up
            row, and cardio because an interval plan has no load to ramp. */}
        {!cardio && !restPauseOn && <div className="g-cfg-warm">
          <div className="row cfgrow">
            <Stepper label={t('Warm-up sets')} value={c.warmupSets || 0} step={1} decimal={false}
              onChange={v => setC(x => ({ ...x, warmupSets: Math.max(0, Math.min(MAX_PLANNED_WARMUPS, Math.round(v) || 0)) }))} />
          </div>
          <p className="g-cfg-note">
            {(c.warmupSets || 0) > 0
              ? t('Added before your work sets and left out of volume, records and progression. Each one closes half the gap to the work weight, never below the bar on a barbell lift, and you can still change any of them mid-session.')
              : t('Ramp-up sets added before the work sets, so you do not have to add them by hand each session.')}
          </p>
        </div>}
        {/* ---------- bodyweight + per side (issues #31/#32/#33) ---------- */}
        {!cardio && <Row icon="figureStrength" iconTint="var(--acc)" title={t('Bodyweight')}
          subtitle={bw ? (mode === 'time' ? t('No weight to enter. Just time the hold.') : t('No weight to enter. Just log the reps.')) : t('Ask for a weight on every set.')}>
          <Switch checked={bw} onChange={v => setC(x => ({ ...x, bodyweight: v, weight: v ? 0 : x.weight }))} />
        </Row>}
        {!cardio && <Row icon="sides" iconTint="var(--blue)" title={t('Per side')}
          subtitle={mode === 'time'
            ? (perSide
              ? tn('{0} set becomes {1}: one on each side, {2}s held every time.', '{0} sets become {1}: one on each side, {2}s held every time.', c.sets || 0, (c.sets || 0) * 2, c.sec || 0)
              : t('For side planks, single-arm holds and the like. Trains each side on its own.'))
            : (perSide ? t('You still log the total: {0} is {1} per side.', c.reps || 0, fmtNum(sideReps(c.reps))) : t('For lunges, single-arm rows and the like.'))}>
          {/* Reps: turning it on rounds the target up to an even number, since half of an odd total
              is a rep one side does not get. Time: nothing to round — a hold's whole duration
              happens twice, so only the flag changes (buildWorkSets doubles the planned sets). */}
          <Switch checked={perSide} onChange={v => setC(x => {
            if (mode === 'time') return { ...x, side: v || undefined }
            const next = { ...x, side: v || undefined, reps: v ? Math.ceil((x.reps || 0) / 2) * 2 : x.reps }
            return climbsRange(policyFor({ ...next, id: ex.id }, routine, 'reps'))
              ? { ...next, ...normalizeRepRange(next.reps, next.repsMin, v ? 2 : 1) }
              : next
          })} />
        </Row>}
        {options?.onSupersetChange && <Row icon="link" iconTint="var(--acc)" title={t('Superset with the exercise above')}>
          <Switch checked={inSuperset} onChange={v => { setInSuperset(v); options.onSupersetChange(v) }} />
        </Row>}
        {/* Workout drawers-M2 */}
        {options?.onPartChange && <>
          <h4 className="g-cfg-h" aria-hidden="true">{t('Part of the workout')}</h4>
          <SegmentedControl label={t('Part of the workout')} value={part}
            onChange={v => { setPart(v); options.onPartChange(v) }}
            options={[{ value: 'warmup', label: t('Warm-up') }, { value: 'main', label: t('Workout') }, { value: 'cooldown', label: t('Cool-down') }]} />
        </>}
      </div>

      {/* What a dumbbell weight means, for this routine's slot (cfg.dbLoad). Picking what the
          exercise already means drops the key, so the slot follows the exercise's default again. */}
      {isBellEx(ex) && !bw && mode !== 'cardio' && <>
        <h4 className="g-cfg-h">{t('Weight means')}</h4>
        <DbLoadPicker ex={ex} cfg={c} value={dbLoadFor(st, { ...c, id: ex.id })}
          onChange={v => setC(x => ({ ...x, dbLoad: v === dbLoadFor(st, ex.id) ? undefined : v }))} />
      </>}
      {/* How the weight is plate-loaded and what the bar weighs — per exercise, not per plan, so
          it sits apart from the config fields above and writes straight to S.barWeights/S.loadKind. */}
      {mode === 'reps' && <>
        <h4 className="g-cfg-h">{t('Plate loading')}</h4>
        <BarWeightEditor ex={ex} cfg={c} extra={t('Applies to this exercise everywhere, not just this plan.')} />
      </>}
      <textarea className="g-cfg-text" rows={3} maxLength={500}
        placeholder={t('Note (optional): loading cues, "bar only, then +1 plate/side each set", anything worth remembering')}
        aria-label={t('Note (optional): loading cues, "bar only, then +1 plate/side each set", anything worth remembering')}
        value={c.note || ''} onChange={e => setC(x => ({ ...x, note: e.target.value }))} />
      {/* The routine editor's counterpart to a workout's Swap (#110): another exercise in this
          slot, with the slot's sets, reps, weight, rule and note kept (lib/routines.js). What was
          changed on this sheet and not saved is left behind, as closing it would. */}
      {menu.length > 0 && <MenuList items={menu} label={t('Exercise options')} />}
    </div>
  </BottomSheet>
}
// `options` (opt-in): { superset, onSupersetChange(on), removeUndo }. `superset` is whether the exercise
// is linked to the one above; with `onSupersetChange` the sheet shows "Superset with the exercise
// above" and calls it as the switch moves (the caller owns the link). `removeUndo` says `onDelete`
// offers an Undo, which the Remove row names. A ninth parameter keeps the eight positional ones
// every caller already passes. `part` ('warmup' | 'main' | 'cooldown') with `onPartChange(part)`
// shows "Part of the workout" (Warm-up · Workout · Cool-down); like the superset switch it calls the
// handler as it moves and saves nothing itself.
export const exConfigSheet = (ex, existing, onSave, onDelete, routine, initial, onReplace, saveLabel, options) => ui().openSheet(close => <ExConfig ex={ex} existing={existing} initial={initial} onSave={onSave} onDelete={onDelete} onReplace={onReplace} routine={routine} saveLabel={saveLabel} options={options} close={close} />, { variant: 'ds' })

/* ============================ glyph picker ============================ */
// Grouped by what the glyph means for a training day, so picking one is a scan
// of four short rows rather than a hunt through twenty loose icons.
export const glyphPicker = (current, onPick) => {
  const cur = glyphOf(current)
  return ui().openSheet(close => <>
    <h3>{t('Pick an icon')}</h3>
    {GLYPH_GROUPS.map(g => (
      <div key={g.key} style={{ marginBottom: 14 }}>
        <div className="sect-t" style={{ padding: '0 2px 7px' }}>{t(g.key)}</div>
        <div className="glyph-grid">
          {g.items.map(n => (
            <button key={n} className={'glyph-cell' + (n === cur ? ' on' : '')}
              onClick={() => { close(); onPick(n) }} aria-label={n}>
              <Icon name={n} />
            </button>
          ))}
        </div>
      </div>
    ))}
    <div style={{ height: 4 }} />
  </>)
}

/* ============================ effort quick picker (RIR / RPE) ============================ */
// Rating a set used to mean walking a +/- stepper up the scale — eleven taps to log "5 reps
// left". This is the one-tap replacement: a colour-coded button per preset, plus a free field
// for the value between two presets. Presets are stored in RIR internally; a profile that logs
// RPE sees the same buttons labelled on its own scale (toScale), coloured identically — the
// colour is the effort, not the number, so 0 RIR and 10 RPE are both the "went to failure" end.
function EffortPicker({ kind, value, onPick, close }) {
  // Local mirror so the ticked preset and the exact field track typing live.
  const [v, setV] = useState(value ?? null)
  // The exact field used to write through on every change, and onPick concludes the set (issue
  // #64): it ticks the set, beeps and starts the rest. Since stepEffort(kind, null, 1) returns
  // the band's minimum, one tap of + — or typing the `1` of `10` — was a committed rating, fired
  // under the sheet you were still typing into, and on the last set of the last exercise it
  // stacked workoutCompleteSheet on top of the picker. So typing moves the mirror only, and the
  // rating is written once, when the sheet is closed: Done, the backdrop, a swipe or Escape. Closed,
  // not gone: the sheet is still playing its way out when the set row under it is live again. A
  // preset row still commits on the spot, which is what makes it one tap.
  const typed = useRef(value ?? null)
  const done = useRef(false)
  const set = nv => { typed.current = nv; setV(nv) }
  useSheetClosed(() => {
    if (done.current) return
    if (typed.current !== (value ?? null)) onPick(typed.current)
  })
  // `v` is in the profile's own scale (whatever sits on the set: s.rir or s.rpe). Compare in
  // RIR so the tick lands on the right preset on either scale, and so a typed RPE colours the
  // same as the RIR it equals.
  const curRir = rirOf(kind === 'rpe' ? { rpe: v } : { rir: v })
  const curColor = effortColor(curRir)
  const commit = nv => { done.current = true; close(); onPick(nv) }
  const pick = rir => commit(toScale(kind, rir))
  const hd = EFFORT[kind].hd
  // Same list the ⋯ menus use: a tinted square with the value where the icon goes, the sentence
  // as the row title, a tick on the current one. The exact field is the app's own stepper,
  // tinted like the logged cell in the set row, so the sheet and the row read as one thing.
  return <>
    <h3 style={{ marginBottom: 2 }}>{t('How hard was that set?')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('Tap how many reps you had left, or type an exact {0}.', hd)}</div>
    <div className="list menu-list effpick">
      {EFFORT_PRESETS.map(p => {
        const label = fmtNum(toScale(kind, p.rir)) + (p.tail ? '+' : '')
        const on = curRir != null && curRir === p.rir
        return <div key={p.rir} className={'item menu-item' + (on ? ' on' : '')} style={{ '--bc': p.color, '--bi': p.ink }}
          {...tappable(() => pick(p.rir))}>
          <span className="lrow-i effpick-n">{label}</span>
          <div className="grow"><div className="tt">{t(p.feel)}</div></div>
          <span className={'menu-on' + (on ? ' is-on' : '')}><Icon name="check" /></span>
        </div>
      })}
      <div className="item menu-item effpick-free">
        <div className="grow"><div className="tt">{t('Exact {0}', hd)}</div></div>
        <div className="stp effcell-stp"
          style={curColor ? { color: effortInk(curRir), background: `color-mix(in srgb, ${curColor} 20%, var(--surface-2))` } : undefined}>
          <button aria-label={t('Decrease')} onClick={() => set(stepEffort(kind, v, -1))}><Icon name="minus" /></button>
          <span className="val"><NumberField decimal nullable value={v ?? ''} placeholder="–"
            onChange={nv => set(capEffort(kind, nv))} /></span>
          <button aria-label={t('Increase')} onClick={() => set(stepEffort(kind, v, 1))}><Icon name="plus" /></button>
        </div>
      </div>
    </div>
    {v != null && <>
      <div style={{ height: 10 }} />
      {/* Only after the exact field has moved the value off what is stored: the preset rows
          close themselves, so this row exists for the one path that does not. */}
      {v !== (value ?? null) && <Button icon="check" onClick={() => commit(v)}>{t('Done')}</Button>}
      <Button variant="ghost" className="dim" icon="xmark" onClick={() => commit(null)}>{t('Clear rating')}</Button>
    </>}
    <div style={{ height: 4 }} />
  </>
}
// kind is 'rir' | 'rpe'; value is the set's current rating on that scale (or null); onPick
// receives the new value on that same scale (null to clear). The caller stores it exactly as
// weight/reps are stored — a null drops the key rather than writing a zero.
export const effortPickerSheet = (kind, value, onPick) =>
  ui().openSheet(close => <EffortPicker kind={kind} value={value} onPick={onPick} close={close} />)
