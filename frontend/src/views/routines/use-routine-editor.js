import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fmtRest } from '../../lib/duration.js'
import { activeProfile, exAvailable } from '../../lib/equipment.js'
import { exOr } from '../../lib/exercises.js'
import { durPart, exCount, exerciseNameText, fmtNum, uid } from '../../lib/format.js'
import { cleanupSg, defaultConfig, exLine, modeOf, moveRoutineEntry, supersetUnits } from '../../lib/history.js'
import { t, tn } from '../../lib/i18n.js'
import { levelsOf, loadOfRoutine } from '../../lib/muscles.js'
import { POLICY_NAME, policyFor, weightIncrement } from '../../lib/progression.js'
import { replaceSlotExercise } from '../../lib/routines.js'
import { speedUnitOf } from '../../lib/speed.js'
import { setSupersetMeta, supersetMeta } from '../../lib/superset-meta.js'
import { usualDuration } from '../../lib/train-stats.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { workoutControls } from '../../lib/workout-controls.js'
import { normaliseParts, partOf } from '../../lib/workout-parts.js'
import { exConfigSheet, exercisePicker, replaceExerciseSheet, routineMenuSheet, startFlow, supersetSheet } from '../../sheets.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { musclesLine } from '../train/use-train.js'
import { removeRoutineExercise, reorderRoutineUnit, useRoutineReorder } from './routine-reorder.js'
import { planWhereOf } from './use-routines.js'

/* ------------------------------------------------------------------ pure helpers -- */

/**
 * The line under an exercise's numbers that says how it moves up (board T5.0, "Up 2.5 kg when
 * every set hits 8"), from the rule in force (its own, else the routine's, lib/progression.js
 * policyFor). null when nothing moves it: the rule is off, a pyramid (never progressed), or the
 * routine is a deload one, whose workouts never count. A rule that adds load on a loaded lift
 * names the step and the reps; any other rule says its name.
 */
export function progressionLine(cfg, routine, unit) {
  if (!cfg || routine?.excludeFromProgression === true) return null
  const mode = modeOf(cfg)
  const policy = policyFor(cfg, routine, mode)
  if (policy === 'off') return null
  if ((policy === 'linear' || policy === 'double') && mode === 'reps' && cfg.weight > 0 && cfg.reps > 0) {
    const inc = weightIncrement(cfg, unit)
    if (inc > 0) return t('Up {0} when every set hits {1}', fmtNum(inc) + ' ' + unit, cfg.reps)
  }
  return t(POLICY_NAME[policy])
}

/** "6 exercises · 19 sets · about 55 min"; the time only from the routine's own past workouts. */
export function statsLineOf(S, routine) {
  const ex = routine?.ex || []
  const sets = ex.reduce((n, e) => n + (Number(e.sets) > 0 ? Number(e.sets) : 1), 0)
  const ms = ex.length ? usualDuration(S, routine.id) : null
  return [exCount(ex.length), ex.length ? tn('{0} set', '{0} sets', sets) : null, ms ? t('about {0}', durPart(ms)[0]) : null]
    .filter(Boolean).join(' · ')
}

/** "In your Plan · Sun, Thu" (the same words as the routine's row on T4.0), or "Not in your Plan". */
export function planLineOf(S, id) {
  const where = planWhereOf(S, id)
  return where != null ? t('In your Plan') + ' · ' + where : t('Not in your Plan')
}

/**
 * SavedIndicator's state from the store's sync status (useStore `sync.status`): saved when the
 * device holds what the server holds, or when there is no server (the phone is where it is
 * saved); syncing while a change waits on a reachable server; offline while it cannot be reached
 * or is not let in; error for a failure it answered with. The store keeps no count of the changes
 * waiting, so none is said.
 */
export function saveStateOf(sync) {
  switch (sync?.status) {
    case 'ok': case 'local': return 'saved'
    case 'pending': return 'syncing'
    case 'offline': case 'auth': case 'held': return 'offline'
    case 'error': return 'error'
    default: return 'idle'
  }
}

/**
 * Links exercise `i` to the one above (`on`) or takes it out of that superset, as "Superset with
 * the exercise above" in its settings does. Edits `ex` in place; false when nothing changed.
 */
export function linkToAbove(ex, i, on) {
  if (!Array.isArray(ex) || i < 1 || !ex[i] || !ex[i - 1]) return false
  const cur = ex[i], prev = ex[i - 1]
  const linked = !!cur.sg && cur.sg === prev.sg
  if (on === linked) return false
  if (linked) delete cur.sg
  else { const gid = prev.sg || ('sg' + uid()); prev.sg = gid; cur.sg = gid }
  cleanupSg(ex)
  return true
}

/**
 * Takes back what one Add put in (T5.4's Undo): each added entry, the last match first, wherever it
 * is now. One that was changed since is no longer what was added and stays. Edits `ex` in place;
 * returns how many went.
 */
export function removeAdded(ex, added) {
  if (!Array.isArray(ex)) return 0
  let gone = 0
  for (const entry of [...added].reverse()) {
    const want = JSON.stringify(entry)
    for (let i = ex.length - 1; i >= 0; i--) {
      if (JSON.stringify(ex[i]) === want) { ex.splice(i, 1); gone++; break }
    }
  }
  if (gone) cleanupSg(ex)
  return gone
}

/**
 * A superset's header line (board T5.0, "SUPERSET · 90 S REST AFTER BOTH"): its name, or
 * "Superset", and its rest between rounds when it has one.
 */
export function supersetLineOf(ex, unit) {
  const meta = supersetMeta(ex, unit)
  const rest = meta.rest > 0
    ? (unit.length === 2 ? t('{0} rest after both', fmtRest(meta.rest)) : t('{0} rest after each round', fmtRest(meta.rest)))
    : null
  return { title: meta.name || t('Superset'), detail: rest }
}

/**
 * What the editor shows for routine `r` (board T5.0), from the store's state `S`:
 *
 *   { plan, muscles, levels, stats, missing, units: [{ key, indices, superset, title, detail }],
 *     rows: [{ index, ex, title, sub, line, note, badge, warning, up, down, leavesUp, leavesDown }] }
 *
 * `missing` is the equipment warning's words, or null. A row's `up`/`down` say whether the move
 * buttons can move it (lib/history.js moveRoutineEntry); `leavesUp`/`leavesDown` that the move
 * takes it out of its superset. An exercise whose id no longer resolves is shown rather than
 * skipped: hidden, it was an entry you could neither see nor delete, but that still turned up in
 * the workout.
 */
export function editorOf(S, r) {
  const ex = r.ex || []
  const units = supersetUnits(ex)
  const grouped = units.filter(u => u.length > 1)
  const inSS = new Set(grouped.flat())
  // Each superset gets a letter and each member its place in the round (A1, A2, B1…), so the
  // order you do them in reads off the list (#293).
  const pos = new Map()
  grouped.forEach((u, k) => u.forEach((idx, n) => pos.set(idx, String.fromCharCode(65 + (k % 26)) + (n + 1))))
  const profile = activeProfile(S)
  const missingCount = profile ? ex.filter(e => !exAvailable(S, exOr(e.id))).length : 0
  const speed = speedUnitOf(S)
  return {
    plan: planLineOf(S, r.id),
    muscles: musclesLine([r]),
    levels: levelsOf(loadOfRoutine(r)),
    stats: statsLineOf(S, r),
    missing: missingCount > 0 ? t('{0} of {1} exercises need equipment outside "{2}"', missingCount, ex.length, profile.name) : null,
    units: units.map(u => ({ key: u[0], indices: u, superset: u.length > 1, ...(u.length > 1 ? supersetLineOf(ex, u) : {}) })),
    rows: ex.map((e, i) => {
      const item = exOr(e.id)
      const linkedPrev = i > 0 && !!e.sg && ex[i - 1].sg === e.sg
      return {
        index: i, ex: item, title: exerciseNameText(item),
        sub: exLine(e, S.unit, speed),
        line: progressionLine(e, r, S.unit),
        note: e.note || null,
        badge: pos.has(i) ? { text: pos.get(i), label: t('Superset position {0}', pos.get(i)) } : null,
        warning: profile && !exAvailable(S, item) ? t('Needs {0}, which isn’t in your active profile', t(item.eq)) : null,
        up: !!moveRoutineEntry(ex, i, -1),
        down: !!moveRoutineEntry(ex, i, 1),
        // At a superset's edge an arrow takes the exercise out of it rather than past a neighbour.
        leavesUp: inSS.has(i) && !linkedPrev,
        leavesDown: inSS.has(i) && ex[i + 1]?.sg !== e.sg,
      }
    }),
  }
}

/* ------------------------------------------------------------------------- hook -- */

/**
 * Everything the routine editor (board T5.0) shows and does, for the routine in the URL:
 * `editorOf`'s lines and rows, `routine`, `saved` (SavedIndicator's state), `swipe` (Settings ›
 * Swipe actions), `fresh` (`?new=1`, T5.6: the routine was just made), `running` (a workout is
 * on), `reorder` (the drag, routine-reorder.js), and the intents:
 *
 *   add(exs)            the picker's choices with the quick-add defaults, and T5.4's toast whose
 *                        Undo takes exactly those out
 *   pick()              opens the picker, several at a time (owner question 7)
 *   configure(i)        the exercise's settings (T5.5): Remove with Undo, Replace, the superset row
 *   replace(i)          T5.7, keeping the slot's numbers
 *   remove(i)           with Undo
 *   move(i, dir)        one place (the move buttons)
 *   drop(from, slot)    a dragged unit, supersets whole
 *   toggleSuperset(i, on), editSuperset(first), rename(name), menu(), start()
 *
 * Every write lands at once (no Save). T5.6 is read from `new` once, as the editor opens, and the
 * param is dropped from the address right then, by replace, so Back or a reload does not open the
 * new state again; the first edit ends it. (Dropped on the first edit instead, the replace could
 * land while a sheet's history entry was on top and leave the `?new=1` entry behind under it.)
 */
export function useRoutineEditor() {
  const nav = useNavigate()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [fresh, setFresh] = useState(() => params.get('new') === '1')
  const S = useStore(s => s.S)
  const sync = useStore(s => s.sync)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const r = S.routines.find(x => x.id === id)
  // A routine that is not there (deleted from its own menu or on another device, an old link): its
  // page steps off the history back to the list when that is under it, else the list takes its
  // place; never stacked on it.
  useEffect(() => { if (!r) leaveTo('/train/routines') }, [!!r])
  // No sheet is open as the editor mounts, so this replace takes the editor's own entry.
  useEffect(() => {
    if (params.get('new') !== '1') return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [])
  // Editing here has no explicit "save": every change persists at once. A single auto-backup on
  // the way out (not per keystroke) covers the whole editing session, deletion included: the
  // menu's Delete removes the routine as the editor leaves, before it unmounts.
  useEffect(() => () => useStore.getState().autoBackupNow(), [])

  // The live routine's exercises, for an intent that runs after a sheet: a sync can land meanwhile.
  const liveEx = () => useStore.getState().S.routines.find(x => x.id === id)?.ex || []
  const edit = fn => {
    update(s => { const ex = s.routines.find(x => x.id === id)?.ex; if (ex) fn(ex) })
    setFresh(false)
  }
  const reorder = useRoutineReorder(r, r?.ex || [], (sourceIndex, targetSlot) => {
    edit(exercises => { reorderRoutineUnit(exercises, sourceIndex, targetSlot) })
  })
  if (!r) return { routine: null, reorder }

  const name = r.name
  const add = exs => {
    if (!exs?.length) return
    const added = exs.map(ex => ({ id: ex.id, ...defaultConfig(ex.id) }))
    edit(x => { x.push(...structuredClone(added)) })
    const msg = exs.length === 1
      ? t('Added {0} to {1}', exerciseNameText(exs[0]), name)
      : tn('Added {0} exercise to {1}', 'Added {0} exercises to {1}', exs.length, name)
    toast(msg, { action: t('Undo'), onAction: () => update(s => { removeAdded(s.routines.find(x => x.id === id)?.ex, added) }) })
  }
  const pick = () => exercisePicker(ex => add([ex]), {
    routine: name,
    multi: { label: n => tn('Add {0} exercise to {1}', 'Add {0} exercises to {1}', n, name), onAdd: add },
  })
  const remove = i => { if (removeRoutineExercise(id, i)) setFresh(false) }
  // Replace (#110): the drawer chooses what goes into slot `i`, and the slot keeps its sets, reps,
  // weight and the rest (lib/routines.js replaceSlotExercise). A row of the drawer replaces at
  // once; a pick from Search all that was not "+" opens the new exercise's settings at those
  // numbers first. A slot that is no longer the exercise the drawer was opened on is left alone.
  const replace = i => {
    const openedOn = r.ex[i]?.id
    if (!openedOn) return
    replaceExerciseSheet(openedOn, (ex, quick) => {
      // The slot and the history as they are now, not as this render saw them: a sync can land
      // while the drawer is open, and the new exercise's weight comes from its own sessions.
      const live = useStore.getState().S
      const slot = live.routines.find(x => x.id === id)?.ex[i]
      if (!slot || slot.id !== openedOn) return
      // The exercise that is already in the slot: nothing to replace, and no toast that says so.
      if (quick && ex.id === openedOn) return
      const commit = fn => {
        let done = false
        edit(x => { if (x[i] && x[i].id === openedOn) { x[i] = fn(x[i]); done = true } })
        if (done) toast(t('Replaced with “{0}”', exerciseNameText(ex)))
      }
      if (quick) { commit(current => replaceSlotExercise(current, ex.id, live, id)); return }
      const next = replaceSlotExercise(slot, ex.id, live, id)
      exConfigSheet(ex, next, cfg => commit(current => ({ id: ex.id, sg: current.sg, ...cfg })), null, r, null, null, t('Replace'))
    }, { routine: name })
  }
  const toggleSuperset = (i, on) => edit(ex => { linkToAbove(ex, i, on) })
  // T5.5 is opened on slot `i`, and everything it does (Done, Remove, Replace, the superset row)
  // acts on that slot only while it still holds the exercise the sheet was opened on, as Replace
  // does: a sync that reorders the routine meanwhile would otherwise get A's settings written
  // under B, or B removed.
  const configure = i => {
    const e = r.ex[i]
    if (!e) return
    const openedOn = e.id
    const holds = () => liveEx()[i]?.id === openedOn
    const linkedPrev = i > 0 && !!e.sg && r.ex[i - 1].sg === e.sg
    // Workout drawers-M2: "Part of the workout" is kept on the slot, and a slot moved into another
    // part leaves its superset; the list is put back in warm-up, workout, cool-down order on save.
    let part = partOf(e)
    exConfigSheet(exOr(e.id), e,
      cfg => edit(x => {
        if (x[i]?.id !== openedOn) return
        const moved = part !== partOf(x[i])
        const keepSg = x[i].sg && !moved
        x[i] = { id: x[i].id, ...(keepSg ? { sg: x[i].sg, sgName: x[i].sgName, sgRest: x[i].sgRest } : {}), ...cfg, ...(part !== 'main' ? { part } : {}) }
        if (part === 'main') delete x[i].part
        cleanupSg(x)
        if (moved) x.splice(0, x.length, ...normaliseParts(x))
      }),
      () => { if (holds()) remove(i) }, r, null, () => { if (holds()) replace(i) }, undefined,
      { removeUndo: true, superset: linkedPrev, onSupersetChange: i > 0 ? on => { if (holds()) toggleSuperset(i, on) } : undefined, part, onPartChange: p => { part = p } })
  }
  // The arrows move one exercise (#377): inside its superset, out of it at the edge, and past a
  // whole neighbouring unit otherwise (lib/history.js moveRoutineEntry). Drag moves supersets whole.
  // Returns where the exercise is now (unchanged when it only left its superset), or null when it
  // could not move, so the editor can keep the keyboard on it.
  const move = (i, dir) => {
    // Guard before update so a stale/boundary activation cannot trigger persistence or cleanup.
    const preview = moveRoutineEntry(r.ex, i, dir)
    if (!preview) return null
    edit(ex => {
      const reordered = moveRoutineEntry(ex, i, dir)
      if (!reordered) return
      ex.splice(0, ex.length, ...reordered)
      cleanupSg(ex)
    })
    const at = preview.indexOf(r.ex[i])
    return at < 0 ? i : at
  }
  const editSuperset = first => {
    const sg = r.ex[first]?.sg
    if (!sg) return
    const unit = supersetUnits(r.ex).find(u => u.includes(first))
    supersetSheet(supersetMeta(r.ex, unit), meta => edit(ex => { setSupersetMeta(ex, sg, meta) }))
  }
  const rename = value => {
    update(s => { const routine = s.routines.find(x => x.id === id); if (routine) routine.name = String(value).trim() || t('Routine') })
    setFresh(false)
  }

  return {
    ...editorOf(S, r),
    routine: r,
    fresh,
    running: !!S.active,
    saved: saveStateOf(sync),
    swipe: workoutControls(S).swipeSets,
    reorder,
    add, pick, configure, replace, remove, move,
    drop: (from, slot) => edit(ex => { reorderRoutineUnit(ex, from, slot) }),
    toggleSuperset, editSuperset, rename,
    menu: () => routineMenuSheet(id),
    start: () => (S.active ? nav('/train/workout') : startFlow([id])),
  }
}
