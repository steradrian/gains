// The new workout screen's model (core-M1 brief step 4 `view`): plain data and every string the
// screen shows or speaks, built from the store and the rest/hold timers. Pure, so it is tested
// without rendering. Fields still to build are listed in the core-M1 hand-back (core-M3).
import { exOr, figureOf, imgSrc, isCustomEx } from '../../lib/exercises.js'
import { supersetUnits, unitOf, modeOf, setLabel, setUnitsTotal, setsDoneActive, lastEntryFor, pinnedNoteFor, exNoteFor, workoutVolume } from '../../lib/history.js'
import { exerciseNameText, fmtDate, fmtNum, exCount } from '../../lib/format.js'
import { fmtRest } from '../../lib/duration.js'
import { t, tn } from '../../lib/i18n.js'
import { sessionHistory } from '../../lib/backfill.js'
import { loadKindFor, baseWeightFor, inventoryFor, rowLoad } from '../../lib/plates.js'
import { isWarmupRow, isSideSet, dropsOf } from '../../lib/workout-model.js'
import { usesBar } from '../../lib/bar.js'
import { partOf, partsOf } from '../../lib/workout-parts.js'
// Workout core-M3
import { isBw, isPerSide, repStep, effortOf, EFFORT, setsRepsOf } from '../../lib/history.js'
import { weightIncrement } from '../../lib/progression.js'
import { isPyramid, pyramidLabel } from '../../lib/pyramid.js'
import { ownedWeightsFor } from '../../lib/dumbbells.js'
import { speedUnitOf, toSpeed, fromSpeed } from '../../lib/speed.js'
import { clampIncline, hasIncline, inclineFits, INCLINE_STEP } from '../../lib/incline.js'
import { exerciseHistory, bestSetFor } from '../../lib/exercise-history.js'
import { best1RM } from '../../lib/onerm.js'
import { loadOfActive, levelsOf } from '../../lib/muscles.js'
import { beatsBest } from '../../lib/workout-finish.js'

// A catalogue exercise's still, or null; the same rule as views/train/use-train.js pictureOf,
// kept here so the workout's module graph does not load the Train screen.
const pictureOf = (S, id) => {
  const ex = exOr(id)
  return ex?.img && !isCustomEx(ex) ? imgSrc(ex, figureOf(S)) : null
}
const TONE = { warmup: 'warm', main: 'main', cooldown: 'cool' }
// A session this long folds every phase but the current one (W1.44).
export const FOLD_AT = 12

const done = e => e.sets.length > 0 && e.sets.every(s => s.done)
const nameOf = e => exerciseNameText(exOr(e.id))
const partName = p => (p === 'warmup' ? t('Warm-up') : p === 'cooldown' ? t('Cool-down') : t('Workout'))

/** Superset member labels by entry index: A1, A2, then B1… in session order. */
export function supersetLabels(entries) {
  const out = {}
  let letter = 0
  supersetUnits(entries).forEach(u => {
    if (u.length < 2) return
    const L = String.fromCharCode(65 + (letter++ % 26))
    u.forEach((idx, k) => { out[idx] = L + (k + 1) })
  })
  return out
}

/** "4 of 12", a superset "8–9 of 12": every exercise counts, warm-up and cool-down included. */
const spanOf = (unit, total) => (unit.length > 1
  ? t('{0}–{1} of {2}', unit[0] + 1, unit[unit.length - 1] + 1, total)
  : t('{0} of {1}', unit[0] + 1, total))

/** One logged set as text: "80 kg × 8", drops "80 × 8 + 60 × 6"; other modes as the history says them. */
export function setText(S, entry, s) {
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  if (mode !== 'reps' || !(s.w > 0)) return setLabel(entry.id, s, entry.target, S.speedUnit)
  const drops = dropsOf(s)
  if (drops.length) return [s, ...drops].map(d => fmtNum(d.w || 0) + ' × ' + (d.r || 0)).join(' + ')
  return fmtNum(s.w) + ' ' + S.unit + ' × ' + (s.r || 0)
}

/**
 * The plate line under a set that loads plates, for the weight `w`. A bar reads "Bar 20 kg + 25 + 5
 * each side"; a plate-loaded machine set to per side has no bar to name, "25 + 5 per side"; a
 * single stack (a belt, a sled) reads "Load 25". Null when it does not apply: reps mode only.
 */
export function plateLineFor(S, entry, w) {
  if (S.showPlates === false) return null
  const cfg = { ...(entry.target || {}), id: entry.id }
  if (modeOf(cfg) !== 'reps') return null
  const load = rowLoad(loadKindFor(S, cfg), w, baseWeightFor(S, entry.id), inventoryFor(S))
  if (!load) return null
  const stack = load.plates.map(fmtNum).join(' + ')
  if (load.kind === 'single') return load.barOnly ? null : t('Load {0}', stack || '–')
  if (!usesBar(entry.id)) return load.barOnly || !stack ? null : t('{0} per side', stack)
  const bar = t('Bar {0}', fmtNum(baseWeightFor(S, entry.id)) + ' ' + S.unit)
  if (load.barOnly || !load.plates.length) return bar
  return t('{0} + {1} each side', bar, stack)
}

/**
 * The plate line for one logged row. A unilateral row logs each side's own weight and the bar is
 * the same for both legs, so the line uses the sides' weight while they agree (or only one side
 * has a number yet) and stays away once they differ. A saved workout being corrected (#203) has
 * nothing left to load, so its rows stay bare.
 */
export function plateLineForSet(S, entry, s, { editing = false } = {}) {
  if (editing || !s) return null
  let w = s.w
  if (isSideSet(s)) {
    const L = s.sides.L?.w || 0
    const R = s.sides.R?.w || 0
    if (L && R && L !== R) return null
    w = L || R
  }
  return w > 0 ? plateLineFor(S, entry, w) : null
}

export function buildWorkoutView({ S, A, timer = null, work = null, sync = null, events = {}, now = Date.now() }) {
  const entries = A.entries || []
  const editing = !!A.editingWorkoutId
  const backfill = !!A.backfill
  const total = entries.length
  const units = supersetUnits(entries)
  const cur = total ? Math.min(Math.max(Number.isInteger(A.cur) ? A.cur : 0, 0), total - 1) : 0
  const unit = total ? unitOf(units, cur) : []
  const labels = supersetLabels(entries)
  const runs = partsOf(entries)
  const allFinished = total > 0 && entries.every(done)
  const unitIdx = units.findIndex(u => u === unit)

  // Top bar.
  const offlineOn = !!sync?.offline
  const top = {
    name: A.name,
    start: (editing || backfill) ? null : A.start,
    dateLine: editing ? t('Editing · {0}', fmtDate(A.d, true)) : backfill ? fmtDate(A.d, true) : null,
    finishLabel: editing ? t('Save') : (!total && !A.routineIds?.length) ? t('Discard') : t('Finish'),
    offline: offlineOn ? { on: true, waiting: sync?.waiting ?? null } : null,
  }

  // Phase progress: one segment per part that has entries; a long session folds all but the current.
  const curRun = runs.find(r => cur >= r.from && cur <= r.to)
  const fold = total >= FOLD_AT
  const progress = {
    phases: runs.map(r => {
      const list = entries.slice(r.from, r.to + 1)
      const n = list.filter(done).length
      return {
        tone: TONE[r.part], part: r.part, count: r.count, done: n,
        state: n === r.count ? 'done' : r === curRun ? 'current' : 'todo',
        expanded: !fold || r === curRun,
      }
    }),
    index: cur,
    done: entries.filter(done).length,
    partial: entries.filter(e => !done(e) && e.sets.some(s => s.done)).length,
    total,
  }

  const position = total ? spanOf(unit, total) : null
  const phaseLabel = allFinished ? t('All done') : unit.length > 1 ? t('Superset') : total ? partName(partOf(entries[cur])) : null

  // The hero: the exercise on screen.
  const entry = entries[cur] || null
  const H = sessionHistory(S)
  let hero = null, current = null, doneRows = [], review = null
  if (entry) {
    const run = curRun
    const inRun = run ? cur - run.from + 1 : 1
    const partLine = run && unit.length > 1
      ? t('{0} · {1}–{2} of {3}', partName(run.part), unit[0] - run.from + 1, unit[unit.length - 1] - run.from + 1, run.count)
      : t('{0} · {1} of {2}', partName(run?.part || 'main'), inRun, run?.count || total)
    const last = lastEntryFor(H, entry.id, entry.rid)
    hero = {
      idx: cur,
      exId: entry.id,
      name: nameOf(entry),
      label: labels[cur] || null,
      dots: entry.sets.map(s => (s.done ? 'done' : 'todo')),
      newToYou: !last ? t('New to you · how to') : null,
      note: (entry.sets.some(s => !s.done) && pinnedNoteFor(S, entry.id)) || exNoteFor(S, entry.id) || null,
      partLine,
      done: done(entry),
    }
    doneRows = entry.sets.map((s, i) => ({ s, i })).filter(x => x.s.done).map(({ s, i }, k) => {
      const text = setText(S, entry, s)
      return { i, n: k + 1, text, warmup: isWarmupRow(s), label: t('{0}, {1}. Edit', k + 1, text) }
    })
    const open = entry.sets.findIndex(s => !s.done)
    const work = entry.sets.filter(s => !isWarmupRow(s))
    if (open >= 0) {
      const s = entry.sets[open]
      const workN = work.indexOf(s) + 1
      const lastSet = open === entry.sets.length - 1
      const restSec = entry.target?.restSec > 0 ? entry.target.restSec : S.restSec
      const partnerIdx = unit.length > 1 ? unit[(unit.indexOf(cur) + 1) % unit.length] : null
      const roundEnds = unit.length > 1 && unit.indexOf(cur) === unit.length - 1
      const lastRow = last?.sets?.find(x => !isWarmupRow(x))
      current = {
        idx: cur, i: open,
        warmup: isWarmupRow(s),
        setLine: isWarmupRow(s) ? t('Warm-up') : t('Set {0} of {1}', workN, work.length),
        last: lastRow ? t('Last time {0}', setText(S, last, lastRow)) : null,
        first: !last ? t('First time') : null,
        plateLine: plateLineForSet(S, entry, s, { editing }),
        doneLabel: unit.length > 1 && !roundEnds ? t('Done · go to {0}', labels[partnerIdx])
          : unit.length > 1 ? t('Done · rest {0} after both', fmtRest(restSec))
            : lastSet ? t('Done · last set') : t('Done set'),
        restChip: restSec > 0 && !editing && !backfill ? t('{0} rest', fmtRest(restSec)) : null,
      }
    } else {
      const vol = workoutVolume({ entries: [entry] })
      review = {
        line: [t('Done'), tn('{0} set', '{0} sets', entry.sets.length), vol > 0 ? fmtNum(vol) + ' ' + S.unit : null].filter(Boolean).join(' · '),
        hint: t('Tap a set to fix it, or add one more.'),
        back: null,
      }
    }
  }

  // A superset on screen.
  const superset = unit.length > 1 ? (() => {
    const restSec = Math.max(0, ...unit.map(k => entries[k].target?.restSec || 0)) || S.restSec
    const rounds = Math.max(...unit.map(k => entries[k].sets.length))
    const round = Math.min(rounds, Math.min(...unit.map(k => entries[k].sets.filter(s => s.done).length)) + 1)
    return {
      a: unit[0], b: unit[1], active: cur,
      note: t('Superset · go straight to {0}, rest {1} after both', labels[unit[1]], fmtRest(restSec)),
      round: t('round {0} of {1}', round, rounds),
    }
  })() : null

  // The rest bar; none in the editor or a past workout.
  const restLabel = timer?.kind === 'switch' ? t('Switch sides') : superset ? t('Round rest') : t('Rest')
  const rest = timer && !editing && !backfill ? {
    left: timer.left, total: timer.total,
    progress: timer.total ? Math.max(0, Math.min(1, 1 - timer.left / timer.total)) : 0,
    label: restLabel,
    // What the footer says under the clock: the label, or Paused while the rest is held.
    shown: timer?.paused ? t('Paused') : restLabel,
    paused: !!timer.paused,
    ready: timer.ready ? t('Ready') : null,
    go: current ? t('Go · set {0}', current.i + 1) : null,
  } : null

  // The footer's neighbours.
  const neighbour = (u, say) => (u ? { idx: u[0], name: nameOf(entries[u[0]]), image: pictureOf(S, entries[u[0]].id), say: say(nameOf(entries[u[0]])) } : null)
  const footer = {
    prev: neighbour(units[unitIdx - 1], n => t('Previous: {0}', n)),
    next: neighbour(units[unitIdx + 1], n => t('Next: {0}', n)),
  }

  // Trained so far and every set done (W1.9).
  const setsDone = setsDoneActive(A)
  const exDone = entries.filter(e => e.sets.some(s => s.done)).length
  const trainedSoFar = { line: t('{0} · {1}', exCount(exDone), tn('{0} set', '{0} sets', setsDone)) }
  const bests = events.bests || 0
  // The session's length so far, "51:40" (minutes and seconds).
  const secs = A.start ? Math.max(0, Math.round((now - A.start) / 1000)) : 0
  const clock = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')
  const allDone = allFinished ? {
    line: [exCount(total), clock, bests ? tn('{0} new best', '{0} new bests', bests) : null].filter(Boolean).join(' · '),
    rows: entries.map((e, idx) => ({
      idx, name: nameOf(e),
      text: partOf(e) === 'warmup' ? t('{0} · {1}', t('Warm-up'), tn('{0} set', '{0} sets', e.sets.length))
        : partOf(e) === 'cooldown' ? t('{0} · {1}', t('Cool-down'), t('done'))
          : tn('{0} set', '{0} sets', e.sets.length),
    })),
  } : null

  // The cool-down offer, once: after the last working set, when there is a cool-down to do.
  const hasCool = runs.some(r => r.part === 'cooldown')
  const mainDone = entries.filter(e => partOf(e) === 'main').every(done)
  const offer = hasCool && mainDone && entries.some(e => partOf(e) === 'main') && !A.offered?.cooldown && !A.skipped?.cooldown
    && entries.filter(e => partOf(e) === 'cooldown').some(e => !done(e)) ? 'cooldown' : null

  return {
    top, progress, position, phaseLabel, hero, doneRows, current, superset, review, rest, footer,
    trainedSoFar, allDone, offer,
    takeover: events.takeover || null,
    newBest: events.newBest || null,
    empty: total === 0,
    editing, backfill,
    hold: work && !editing ? { left: work.left, of: work.total, side: work.owner ? entries[work.owner.idx]?.sets?.[work.owner.i]?.side || null : null, paused: !!work.paused } : null,
    totals: { sets: setUnitsTotal(entries), done: setsDone },
  }
}

/* === Workout core-M3: the view fields core-M1 left to build (its hand-back, Part 2) === */

const sentence = s => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)
const cfgOf = entry => ({ ...(entry.target || {}), id: entry.id })

/** "Set 2": a row's number among the working sets (a per-side timed pair is one). */
function setNumberOf(sets, i) {
  const s = sets[i]
  if (!s || isWarmupRow(s)) return 1
  const k = sets.filter(x => !isWarmupRow(x)).indexOf(s)
  return s.side === 'L' || s.side === 'R' ? Math.floor(k / 2) + 1 : k + 1
}

/**
 * The plan the exercise was built from (issue #275), on one quiet line under the hero's meta:
 * "Plan: 2 × 10", with "· today 3 × 10" when progression moved the sets or reps and "· reps from
 * your last session" when they were carried. A pyramid reads as its targets. Null for an entry
 * with no plan (freestyle, or started before plans were kept) and for cardio.
 */
export function planLineOf(entry) {
  const planned = entry.planned
  const today = entry.target || {}
  const mode = modeOf(cfgOf(entry))
  if (!planned || mode === 'cardio') return null
  if (isPyramid(today)) return t('Plan: {0}', pyramidLabel(today.pyramid))
  const timed = mode === 'time'
  const todaySets = today.sets || planned.sets || 1
  const inPlan = timed
    ? today.sec == null || today.sec === planned.sec
    : today.reps == null || (planned.repsMin > 0 ? today.reps >= planned.repsMin && today.reps <= planned.reps : today.reps === planned.reps)
  const note = todaySets !== (planned.sets || 1) || !inPlan
    ? t('today {0}', setsRepsOf({ mode, sets: todaySets, reps: today.reps, sec: today.sec }))
    : entry.carried ? t('reps from your last session') : null
  return t('Plan: {0}', setsRepsOf({ ...planned, mode })) + (note ? ' · ' + note : '')
}

/** The hero's meta line: "Barbell · 3 × 8 · 2:00 rest", "Timed · 2 × 0:30 a side", "… · done". */
export function heroMeta(S, entry, { editing = false } = {}) {
  const cfg = cfgOf(entry)
  const ex = exOr(entry.id)
  const mode = modeOf(cfg)
  const work = entry.sets.filter(s => !isWarmupRow(s))
  const perSideTime = mode === 'time' && isPerSide(cfg)
  const n = perSideTime ? Math.ceil(work.length / 2) : work.length
  const kind = mode === 'time' ? t('Timed') : mode === 'cardio' ? t('Cardio')
    : isBw(cfg) && !work.some(s => s.w > 0) ? t('Body weight') : sentence(ex?.eq ? t(ex.eq) : '')
  const plan = editing ? tn('{0} set', '{0} sets', n) : n ? setsRepsOf({ ...cfg, sets: n }) + (perSideTime ? ' ' + t('a side') : '') : null
  const rest = !editing && entry.target?.restSec > 0 && mode !== 'time' ? t('{0} rest', fmtRest(entry.target.restSec)) : null
  const finished = !editing && entry.sets.length > 0 && entry.sets.every(s => s.done) ? t('done') : null
  return [kind, plan, finished || rest].filter(Boolean).join(' · ')
}

/**
 * The steppers for one set by its mode (owner question 12): `fields` is `[{ f, label, value, step,
 * decimals, hint, lessLabel, moreLabel, weight?, owned?, view?, store?, side }]`; `bodyweight` is a
 * body-weight lift with no load, where the "Tap to add weight" tile takes the weight's place.
 * `side` ('L' | 'R') reads one side of a per-side row.
 */
export function setFields(S, entry, i, side = null) {
  const s = entry.sets[i]
  if (!s) return { fields: [], bodyweight: false }
  const cfg = cfgOf(entry)
  const mode = modeOf(cfg)
  const row = side && s.sides ? s.sides[side] : s
  const field = (f, label, step, extra = {}) => ({
    f, label, step, side,
    value: extra.view ? (row[f] != null ? extra.view(row[f]) : 0) : (Number(row[f]) || 0),
    decimals: step % 1 ? 1 : 0, lessLabel: t('Less {0}', label), moreLabel: t('More {0}', label), hint: null, ...extra,
  })
  if (mode === 'cardio') {
    const unit = speedUnitOf(S)
    const list = [
      field('min', t('min'), 1),
      field('speed', unit === 'mph' ? 'mph' : 'km/h', 0.5, { view: v => toSpeed(v, unit), store: v => fromSpeed(v, unit) }),
    ]
    if (inclineFits(exOr(entry.id)) || entry.sets.some(hasIncline)) list.push(field('incline', '%', INCLINE_STEP, { hint: t('incline'), store: clampIncline }))
    return { fields: list, bodyweight: false }
  }
  if (mode === 'time') return { fields: [field('sec', t('Seconds'), 5), field('w', S.unit, 2.5, { weight: true })], bodyweight: false }
  const warm = isWarmupRow(s)
  const step = weightIncrement(cfg, S.unit)
  const owned = ownedWeightsFor(S, cfg)
  const bodyweight = isBw(cfg) && !(Number(row.w) > 0)
  const last = lastEntryFor(sessionHistory(S), entry.id, entry.rid)
  const k = entry.sets.filter(x => isWarmupRow(x) === warm).indexOf(s)
  const lastRow = last?.sets?.filter(x => isWarmupRow(x) === warm)[k]
  const lastReps = lastRow ? (side && lastRow.sides ? lastRow.sides[side]?.r : lastRow.r) : undefined
  const weight = field('w', isBw(cfg) ? t('Added ({0})', S.unit) : S.unit, step, {
    weight: true, owned, hint: owned ? null : t('{0} {1} steps', fmtNum(step), S.unit),
  })
  const reps = field('r', t('Reps'), repStep(cfg), { hint: lastReps != null && lastReps === row.r ? t('same as last time') : null })
  return { fields: bodyweight ? [reps] : [weight, reps], bodyweight }
}

// Exported for Set edit (exercise-drawers.jsx, Workout drawers-M2).
export const EFFORT_OPTIONS = {
  rir: () => [{ value: 0, label: t('0 · failure') }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4+' }],
  rpe: () => [6, 7, 8, 9, 10].map(v => ({ value: v, label: String(v) })),
}

/** "17.5 × 12 · 12 · 11": one past session's sets, the weight said again only when it changes. */
export const sessionLine = (exId, mode, sets, target, speedUnit) => sets.map((s, k) => {
  if (mode !== 'reps' || !(s.w > 0)) return setLabel(exId, s, target, speedUnit)
  return k && s.w === sets[k - 1].w ? String(s.r || 0) : fmtNum(s.w) + ' × ' + (s.r || 0)
}).join(' · ')

/**
 * Adds what the new screen still needed to `buildWorkoutView`'s model: the phase bar inside the
 * open phase, the hero's meta and dots, the current set's fields, effort and the planned sets after
 * it, the done rows' names and NEW BEST, the review's way back (`origin`, the exercise you came
 * from, kept by the hook), the history below the fold, the timed hold's ring, Trained so far's
 * muscle levels and, on a timed exercise, what comes next in its part.
 */
export function extendWorkoutView(view, { S, A, work = null, origin = null }) {
  if (!view) return view
  const entries = A.entries || []
  const editing = !!A.editingWorkoutId
  const H = sessionHistory(S)
  const labels = supersetLabels(entries)
  const entry = view.hero ? entries[view.hero.idx] : null
  const out = { ...view }

  // The phase bar counts the open phase from its own first segment.
  const run = partsOf(entries).find(r => view.progress.index >= r.from && view.progress.index <= r.to)
  out.progress = {
    ...view.progress,
    phases: view.progress.phases.map(p => ({ ...p, state: p.state === 'current' ? 'now' : p.state === 'todo' ? 'waiting' : p.state, name: partName(p.part) })),
    run: run ? (() => {
      const curEntry = entries[view.progress.index]
      return {
        index: view.progress.index - run.from,
        done: entries.slice(run.from, run.to + 1).filter(done).length,
        partial: curEntry?.sets.length ? curEntry.sets.filter(s => s.done).length / curEntry.sets.length : 0,
      }
    })() : { index: 0, done: 0, partial: 0 },
    label: t('All exercises'),
  }

  if (entry) {
    const open = entry.sets.findIndex(s => !s.done)
    const sup = !!view.superset
    const mode = modeOf(cfgOf(entry))
    out.hero = {
      ...view.hero,
      image: pictureOf(S, entry.id),
      meta: heroMeta(S, entry, { editing }),
      plan: planLineOf(entry),
      dots: entry.sets.map((s, k) => (s.done ? 'done' : k === open ? 'now' : 'todo')),
      dotsLabel: view.current ? view.current.setLine : null,
      howLabel: t('{0}, how to', view.hero.name),
      moreLabel: t('{0}, options', view.hero.name),
    }

    // NEW BEST on the heaviest done working set that beats the best before this session.
    let bestI = -1
    if (!editing && !A.backfill) entry.sets.forEach((s, k) => { if (beatsBest(S, entry, s) && (bestI < 0 || s.w > entry.sets[bestI].w)) bestI = k })
    out.doneRows = view.doneRows.map(r => ({
      ...r,
      name: sup ? t('Round {0}', r.n) : r.warmup ? t('Warm-up') : t('Set {0}', setNumberOf(entry.sets, r.i)),
      label: sup ? t('Round {0}, {1}. Edit', r.n, r.text) : r.label,
      best: r.i === bestI,
    }))
    out.bestLabel = t('NEW BEST')
    if (sup) {
      const { a, b } = view.superset
      out.superset = {
        ...view.superset,
        tags: [labels[a], labels[b]], names: [nameOf(entries[a]), nameOf(entries[b])],
        activeKey: view.hero.idx === b ? 'b' : 'a', ariaLabel: t('Superset'),
      }
    }

    if (view.current) {
      const s = entry.sets[view.current.i]
      const side = s.sides ? (!s.sides.L?.done ? 'L' : 'R') : null
      const { fields, bodyweight } = setFields(S, entry, view.current.i, side)
      const kind = effortOf(S)
      const prevI = view.current.i - 1
      const prev = entry.sets[prevI]
      const sideWord = side === 'L' ? t('Left') : side === 'R' ? t('Right') : null
      out.current = {
        ...view.current,
        setLine: [sup ? t('{0} · {1}', labels[view.hero.idx], view.superset.round) : view.current.setLine, sideWord].filter(Boolean).join(' · '),
        side, fields, bodyweight,
        timed: mode === 'time',
        startLabel: mode === 'time' ? t('Start · {0}', fmtRest(s.sec || 45)) : null,
        effort: EFFORT[kind] && mode === 'reps' && prev?.done && !isWarmupRow(prev) ? {
          i: prevI, field: EFFORT[kind].f, value: prev[EFFORT[kind].f] ?? null, options: EFFORT_OPTIONS[kind](),
          label: t('How hard was set {0}?', setNumberOf(entry.sets, prevI)),
        } : null,
        upcoming: entry.sets.map((x, k) => ({ x, k })).filter(({ x, k }) => !x.done && k > view.current.i).map(({ x, k }) => ({
          i: k, name: isWarmupRow(x) ? t('Warm-up') : t('Set {0}', setNumberOf(entry.sets, k)), text: setText(S, entry, x),
          label: t('{0}, {1}. Edit', setNumberOf(entry.sets, k), setText(S, entry, x)),
        })),
        loadLabel: t('Load'), bodyweightLabel: t('Body weight'), loadHint: t('Tap to add weight'),
        restLabel: t('Change rest time'), addSetLabel: t('Add set'),
      }
    }

    if (view.review) {
      const from = origin && origin.idx !== view.hero.idx && entries[origin.idx]?.id === origin.id ? entries[origin.idx] : null
      const openAt = from ? from.sets.findIndex(s => !s.done) : -1
      out.review = {
        ...view.review,
        back: from && openAt >= 0 ? {
          idx: origin.idx,
          label: t('Back to {0} · set {1}', nameOf(from), setNumberOf(from.sets, openAt)),
          short: t('Back to {0}', nameOf(from)),
        } : null,
      }
    }

    // Below the fold: the last 3 times, the best and e1RM; or the first-time block.
    const hist = exerciseHistory(H, entry.id, { limit: 3 })
    if (hist.sessions.length) {
      const best = bestSetFor(H, entry.id, mode)
      const e1 = mode === 'reps' ? best1RM(H, entry.id) : null
      out.history = {
        title: t('{0}, last 3 times', view.hero.name),
        allLabel: t('All'),
        rows: hist.sessions.map(x => ({ id: x.id, date: fmtDate(x.d, true), text: sessionLine(entry.id, x.mode, x.sets, x.target, S.speedUnit) })),
        best: best ? t('Best: {0}', setText(S, { ...entry, target: best.target || entry.target }, best.set)) : null,
        bestSub: [e1 ? t('Est. 1RM {0}', fmtNum(Math.round(e1.est)) + ' ' + S.unit) : null, best ? fmtDate((e1 && e1.d) || best.d, true) : null].filter(Boolean).join(' · ') || null,
        first: null,
      }
    } else {
      out.history = {
        title: t('{0}, first time', view.hero.name),
        allLabel: null, rows: [], best: null, bestSub: null,
        first: [t('Nothing to compare with yet. From the next time on, this shows your last 3 times.'), partOf(entry) === 'warmup' ? t('Warm-ups never earn new bests.') : null].filter(Boolean).join(' '),
      }
    }

    // A timed exercise lists what comes next in its part (W1.41).
    const curRun = partsOf(entries).find(r => view.hero.idx >= r.from && view.hero.idx <= r.to)
    out.upNext = mode === 'time' && curRun && view.hero.idx < curRun.to ? {
      title: t('Next'),
      rows: entries.slice(view.hero.idx + 1, curRun.to + 1).map((e, k) => ({ idx: view.hero.idx + 1 + k, name: nameOf(e), text: heroMeta(S, e).split(' · ').slice(1).join(' · ') })),
    } : null
  } else {
    out.history = null
    out.upNext = null
  }

  // The timed hold's ring (W1.41, W1.42).
  if (view.hold) {
    const owner = work?.owner ? entries[work.owner.idx] : null
    const s = owner?.sets?.[work.owner.i]
    const perSide = !!s && (s.side === 'L' || s.side === 'R')
    const holds = owner ? owner.sets.filter(x => !isWarmupRow(x)) : []
    const rounds = perSide ? Math.ceil(holds.length / 2) : holds.length
    const round = s ? (perSide ? Math.floor(holds.indexOf(s) / 2) : holds.indexOf(s)) + 1 : 1
    const sideWord = view.hold.side === 'L' ? t('Left side') : view.hold.side === 'R' ? t('Right side') : null
    const left = Math.max(0, view.hold.left)
    out.hold = {
      ...view.hold,
      idx: work?.owner?.idx ?? null,
      sideLabel: sideWord,
      // An opted-in hold runs past its target with a negative left: "+0:03" and an empty ring.
      leftText: view.hold.left < 0 ? '+' + fmtRest(-view.hold.left) : fmtRest(left),
      detail: [t('of {0}', fmtRest(view.hold.of)), rounds > 1 ? t('round {0} of {1}', round, rounds) : null].filter(Boolean).join(' · '),
      progress: view.hold.of ? Math.min(1, Math.max(0, 1 - left / view.hold.of)) : 0,
      tone: owner ? TONE[partOf(owner)] : 'main',
      ringLabel: [sideWord, tn('{0} second left', '{0} seconds left', left)].filter(Boolean).join(', '),
      pauseLabel: t('Pause'), resumeLabel: t('Resume'),
      switchLabel: view.hold.side === 'L' ? t('Switch side') : null,
      doneLabel: view.hold.side === 'L' ? null : t('Done'),
      note: view.hold.side === 'L' ? t('A soft chime and a buzz at 0:00, then the right side starts on its own.') : null,
    }
  }

  // Trained so far (Trained today on W1.9): the muscles of the working sets ticked so far.
  out.trainedSoFar = { ...view.trainedSoFar, title: t('Trained so far'), levels: levelsOf(loadOfActive(A)), less: t('Less'), more: t('More') }
  if (view.allDone) out.allDone = { ...view.allDone, title: t('Every set done'), listTitle: t('{0} today', A.name || t('Workout')), trainedTitle: t('Trained today') }
  return out
}
