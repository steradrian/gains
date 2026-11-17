import { describe, expect, it } from 'vitest'
import { parseImport, mergeImport } from './import-csv.js'
import { importOutcome, hevyOutcome, workoutStats } from './import-outcome.js'

// What the Import done screen reports (board St1Imported) comes from the import itself: days the
// history already had are left alone by mergeImport, so their sets are not "imported".
const HEAD = 'Date,Exercise,Weight,Reps'
const row = (d, ex = 'Bench Press', w = 60, r = 5) => `${d},${ex},${w},${r}`
const csv = (...rows) => [HEAD, ...rows].join('\n')
const parse = text => parseImport(text, { unit: 'kg', customEx: [] })
const emptyState = () => ({ workouts: [], bodyweight: [], customEx: [], exWeights: {} })

// The merge, the way sheets/import.jsx runs it.
function runImport(S, parsed) {
  const haveDays = new Set((parsed.kind === 'bodyweight' ? S.bodyweight : S.workouts).map(x => x.d))
  const known = new Set(S.customEx.map(c => c.id))
  const res = mergeImport(S, parsed)
  const newNames = S.customEx.filter(c => !known.has(c.id)).map(c => c.n)
  return importOutcome({ parsed, haveDays, res, newNames })
}

describe('importOutcome', () => {
  it('counts the workouts, sets, matched exercises and the exercises that became the person’s own', () => {
    const S = emptyState()
    const parsed = parse(csv(row('2026-01-02'), row('2026-01-02', 'Bench Press', 62, 5), row('2026-01-03', 'Zzyzx Grip Trainer Thing', 10, 8)))
    const out = runImport(S, parsed)
    expect(out).toMatchObject({ kind: 'workouts', imported: 2, sets: 3, leftAlone: 0 })
    expect(out.matched).toBe(1)
    expect(out.newNames).toEqual(['zzyzx grip trainer thing'])
    expect(out.from).toBe('2026-01-02')
    expect(out.to).toBe('2026-01-03')
  })

  it('importing the same file twice leaves its days alone and imports nothing', () => {
    const S = emptyState()
    const parsed = parse(csv(row('2026-01-02'), row('2026-01-03')))
    runImport(S, parsed)
    const again = runImport(S, parsed)
    expect(again).toMatchObject({ imported: 0, sets: 0, matched: 0, leftAlone: 2 })
    expect(S.workouts).toHaveLength(2)
  })

  it('a day the history already had keeps its workout, and its sets are not counted', () => {
    const S = emptyState()
    runImport(S, parse(csv(row('2026-01-02'))))
    const out = runImport(S, parse(csv(row('2026-01-02', 'Bench Press', 80, 3), row('2026-01-04'))))
    expect(out).toMatchObject({ imported: 1, sets: 1, leftAlone: 1 })
    expect(S.workouts.find(w => w.d === '2026-01-02').entries[0].sets[0].w).toBe(60)
  })

  it('a body-weight file counts weigh-ins and the days it left alone', () => {
    const parsed = { kind: 'bodyweight', source: 'Apple Health', from: '2026-01-01', to: '2026-01-03', bodyweight: [{ d: '2026-01-01', w: 80 }, { d: '2026-01-03', w: 81 }] }
    const S = { bodyweight: [{ d: '2026-01-01', w: 79 }], workouts: [], customEx: [] }
    expect(runImport(S, parsed)).toMatchObject({ kind: 'bodyweight', source: 'Apple Health', imported: 1, leftAlone: 1 })
  })
})

describe('hevyOutcome', () => {
  it('reports each part that was switched on, and leaves the workout numbers at zero for a part left off', () => {
    const parsed = parse(csv(row('2026-02-01'), row('2026-02-02')))
    const payload = { workouts: parsed, routines: { routines: [] }, bodyweight: { bodyweight: [], from: null, to: null } }
    const out = hevyOutcome({ payload, haveDays: new Set(['2026-02-02']), added: { workouts: 1, routines: 0, weighIns: 0 }, newNames: [] })
    expect(out).toMatchObject({ kind: 'hevy', source: 'Hevy', imported: 1, sets: 1, leftAlone: 1 })
    const off = hevyOutcome({ payload, haveDays: new Set(), added: { workouts: 0, routines: 2, weighIns: 0 } })
    expect(off).toMatchObject({ imported: 0, routines: 2, sets: 0, leftAlone: 0 })
  })
})

describe('workoutStats', () => {
  it('counts a day with two sessions once among the days left alone', () => {
    const parsed = parse(csv(row('2026-01-02'), row('2026-01-02', 'Squat')))
    expect(workoutStats(parsed, new Set(['2026-01-02'])).leftAlone).toBe(1)
  })
})
