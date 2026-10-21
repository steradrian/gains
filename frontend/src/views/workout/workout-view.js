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
import { isWarmupRow, dropsOf } from '../../lib/workout-model.js'
import { partOf, partsOf } from '../../lib/workout-parts.js'

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

/** The plate line under a barbell set: "Bar 20 kg + 25 + 5 each side". Null when it does not apply. */
export function plateLineFor(S, entry, w) {
  if (S.showPlates === false) return null
  const load = rowLoad(loadKindFor(S, { ...(entry.target || {}), id: entry.id }), w, baseWeightFor(S, entry.id), inventoryFor(S))
  if (!load || load.kind !== 'pairs') return null
  const bar = t('Bar {0}', fmtNum(baseWeightFor(S, entry.id)) + ' ' + S.unit)
  if (load.barOnly || !load.plates.length) return bar
  return t('{0} + {1} each side', bar, load.plates.map(fmtNum).join(' + '))
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
        plateLine: s.w > 0 ? plateLineFor(S, entry, s.w) : null,
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
  const rest = timer && !editing && !backfill ? {
    left: timer.left, total: timer.total,
    progress: timer.total ? Math.max(0, Math.min(1, 1 - timer.left / timer.total)) : 0,
    label: superset ? t('Round rest') : t('Rest'),
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
