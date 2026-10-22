import { useEffect, useMemo } from 'react'
import { useStore } from '../../../store/useStore.js'
import { nutritionAvailable } from '../../../lib/nutrition/api.js'
import { draftOf, macroGrams, writesFor } from '../../../lib/nutrition/goals.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { restoreChange } from '../../../lib/recent-changes.js'
import { targetsFor, weeksTo } from '../../../lib/me/goal-calc.js'
import { applySnapshot, recordGoalChange, snapshotOf } from '../../../lib/me/goal-changes.js'
import { calcInputs, profileOf } from '../../../lib/me/goal-profile.js'
import { applyWrites, planChange, useProfileWrites } from '../../../lib/me/goal-writes.js'

// My goal's state and actions (no UI). Every action resolves { ok, changed, undo, ... }:
//   ok false   { error, rolledBack, stuck } a write failed; what was written was put back unless
//              `rolledBack` is false, and `stuck` names the keys that could not be.
//   undo()     puts the previous values back (the toast's Undo). It runs the journal's restore, so
//              the Recent changes entry is marked restored and cannot be restored a second time.
//   recomputed / skipped   whether the daily targets were rewritten, and which goals differ by
//              weekday and were left alone.
// Without NutriTrace (`status` 'no-nutrition') only `setTargetWeight` exists.

const noUndo = async () => ({ ok: true })
let busy = false

// Body details and Daily movement write profile keys the hub refuses until it is deployed with them
// (PROFILE_WRITES_LIVE in lib/me/goal-writes.js): refused here, before anything is sent.
const gatedRefusal = () => ({ ok: false, changed: false, undo: null, error: Object.assign(new Error('Body details cannot be saved yet'), { code: 'profile-unsupported' }) })

const gramsOf = settings => {
  const d = draftOf(settings)
  return { calories: d.kcal, proteinG: macroGrams(d.macros.proteins, 'proteins', d.kcal), carbsG: macroGrams(d.macros.carbohydrates, 'carbohydrates', d.kcal), fatG: macroGrams(d.macros.fat, 'fat', d.kcal) }
}

// The server's settings as they are now (goals is one setting holding every nutrient, so a write
// merges into the current one), or null with the error.
async function freshSettings() {
  const data = await useNutrition.getState().loadSettings({ force: true })
  const { status, error } = useNutrition.getState().settings
  return status === 'error' || !data ? { error } : { data }
}

// Writes, journals, and hands back the Undo.
async function commit({ what, from, to, writes, targetW = null, extra, result = {} }) {
  if (!writes.length && !targetW) return { ok: true, changed: false, undo: noUndo, ...result }
  const written = writes.length ? await applyWrites(writes) : { ok: true, order: [] }
  if (!written.ok) return { ok: false, changed: false, undo: null, error: written.error, rolledBack: written.rolledBack, stuck: written.stuck }
  if (targetW) useStore.getState().update(s => { s.targetW = targetW.after })
  const snapshot = snapshotOf(written, targetW)
  const id = recordGoalChange(what, from, to, snapshot, extra)
  const undo = () => (id ? restoreChange(id) : applySnapshot(snapshot, 'restore'))
  return { ok: true, changed: true, undo, ...result }
}

// One change at a time: a second tap while a write is in flight is refused, not interleaved.
async function exclusive(run) {
  if (busy) return { ok: false, changed: false, undo: null, error: Object.assign(new Error('busy'), { code: 'busy' }) }
  busy = true
  try { return await run() } finally { busy = false }
}

const change = (what, from, to, spec) => exclusive(async () => {
  const fresh = await freshSettings()
  if (!fresh.data) return { ok: false, changed: false, undo: null, error: fresh.error }
  const plan = planChange(fresh.data, useStore.getState().S, spec.change)
  return commit({ what, from, to, writes: plan.writes, targetW: spec.targetW?.(), extra: spec.extra, result: { recomputed: plan.recomputed, skipped: plan.skipped, targets: plan.targets } })
})

const actionsFor = () => ({
  setGoal: goal => {
    const from = profileOf(useNutrition.getState().settings.data, useStore.getState().S).goal
    return change('goal', from, goal, { change: { goal } })
  },

  setBodyDetails: ({ heightCm, birthYear, sex }) => {
    if (!useProfileWrites.getState().live) return gatedRefusal()
    const p = profileOf(useNutrition.getState().settings.data, useStore.getState().S)
    const patch = Object.fromEntries(Object.entries({ heightCm, birthYear, sex }).filter(([, v]) => v !== undefined))
    return change('body', { heightCm: p.heightCm, birthYear: p.birthYear, sex: p.sex }, { heightCm: heightCm ?? p.heightCm, birthYear: birthYear ?? p.birthYear, sex: sex ?? p.sex }, { change: patch })
  },

  setMovement: level => {
    if (!useProfileWrites.getState().live) return gatedRefusal()
    const from = profileOf(useNutrition.getState().settings.data, useStore.getState().S).movement
    return change('movement', from, level, { change: { activity: level } })
  },

  // Exactly what the Goals page's own save would write (`snapshot`: the settings the draft was made from).
  saveTargets: (draft, snapshot = null) => exclusive(async () => {
    const fresh = await freshSettings()
    if (!fresh.data) return { ok: false, changed: false, undo: null, error: fresh.error }
    const writes = writesFor(fresh.data, draft, snapshot ?? fresh.data)
    const to = gramsOf({ ...fresh.data, ...Object.fromEntries(writes) })
    return commit({ what: 'targets', from: gramsOf(fresh.data), to, writes })
  }),

  // "Target reached" -> Keep my weight: the goal becomes keep and the target is today's weight.
  keepWeight: async () => {
    const S = useStore.getState().S
    const p = profileOf(useNutrition.getState().settings.data, S)
    if (!p.current || p.current.fromOnboarding) return { ok: false, changed: false, undo: null, error: Object.assign(new Error('no weigh-in'), { code: 'no-weight' }) }
    const weigh = [...(S.bodyweight || [])].find(b => b.d === p.current.date)
    const after = Math.round(Number(weigh?.w) * 10) / 10
    return change('goal', p.goal, 'keep', {
      change: { goal: 'keep' },
      targetW: () => ({ before: S.targetW ?? null, after }),
      extra: { target: after, unit: p.unit },
    })
  },
})

// Works without NutriTrace: S.targetW alone. `weight` null removes the target.
async function setTargetWeight(weight) {
  const S = useStore.getState().S
  const after = weight == null ? null : Math.round(Number(weight) * 10) / 10
  if (after != null && !(after > 0)) return { ok: false, changed: false, undo: null, error: Object.assign(new Error('invalid weight'), { code: 'invalid' }) }
  const before = S.targetW ?? null
  return commit({
    what: 'target', from: before, to: after, writes: [], targetW: before === after ? null : { before, after },
    extra: { unit: S.unit === 'lb' ? 'lb' : 'kg' },
  })
}

export function useGoal() {
  const user = useStore(s => s.user)
  const S = useStore(s => s.S)
  const settings = useNutrition(s => s.settings)
  const available = nutritionAvailable(user)
  const profileLive = useProfileWrites(s => s.live)

  useEffect(() => { if (available) useNutrition.getState().loadSettings() }, [available])

  const status = !available ? 'no-nutrition'
    : settings.status === 'ready' || (settings.data && settings.status !== 'loading') ? 'ready'
    : settings.status === 'error' ? 'error'
    : 'loading'

  const profile = useMemo(() => profileOf(available ? settings.data : null, S), [available, settings.data, S])
  const targets = useMemo(() => {
    const inputs = available ? calcInputs(profile) : null
    return inputs ? targetsFor(inputs) : null
  }, [available, profile])
  const actions = useMemo(() => (available
    ? { ...actionsFor(), setTargetWeight, reload: () => useNutrition.getState().loadSettings({ force: true }) }
    : { setTargetWeight }), [available])

  const weeksLeft = profile.current && profile.targetKg != null ? weeksTo(profile.current.weightKg, profile.targetKg, targets?.weeklyChangeKg) : null
  return {
    status,
    profile,
    goal: profile.goal,
    target: profile.target,
    burn: targets?.burn ?? null,
    targets,
    startWeight: profile.start,
    current: profile.current,
    weeksLeft,
    profileLive,
    actions,
  }
}
