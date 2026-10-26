// MacroFactor exports one .xlsx: the sets in "Workout Log", the weigh-ins in "Quick Export", and
// sheets Gains has no use for (food, muscle-group totals, the program). Headers as in a real export.
import { describe, expect, it } from 'vitest'
import { readXlsx } from './xlsx.js'
import { parseImportSheets, mergeImport } from './import-csv.js'
import { makeXlsx } from './xlsx.test-util.js'

const LOG = ['Date', 'Workout Duration', 'Workout', 'Exercise', 'Exercise Base Weight (kg)', 'Set Type', 'Weight (kg)', 'Reps', 'RIR', 'Duration', 'Distance short (m)', 'Distance long (km)']
const QUICK = ['Date', 'Expenditure', 'Trend Weight (kg)', 'Weight (kg)', 'Calories (kcal)', 'Steps']
const set = (d, workout, exercise, type, w, reps, rir = '', base = '', secs = 5451) => [d, secs, workout, exercise, base, type, w, reps, rir, '', '', '']

const workbook = (log, quick = [[{ date: 46316 }, 3223, 80.29, 81.45, '', 6862], [{ date: 46317 }, 3223, 80.41, '', '', 13111]]) => makeXlsx([
  { name: 'Quick Export', rows: [QUICK, ...quick] },
  { name: 'Food Log', rows: [['Date', 'Time', 'Food Name', 'Serving Size', 'Serving Weight (g)', 'Calories (kcal)']] },
  { name: 'Muscle Groups - Volume', rows: [['Date', 'Chest (kg)'], [{ date: 46315 }, 6269]] },
  { name: 'Active Program', rows: [['Program: Advanced Full Body', 'Cycles: 5'], ['Cycle 1', 'Exercise', 'Notes']] },
  { name: 'Workout Log', rows: [LOG, ...log] },
])

const A = 'Advanced Full Body (Workout A)'
const parse = async (book, opts = {}) => parseImportSheets(await readXlsx(book), { unit: 'kg', customEx: [], ...opts })

describe('a MacroFactor export', () => {
  it('reads the Workout Log as workouts, named and timed, with the weigh-ins along', async () => {
    const p = await parse(workbook([
      set('2026-10-20', A, 'Chin-Up', 'Warm-Up Set', 0, 8),
      set('2026-10-20', A, 'Chin-Up', 'Standard Set', 10, 8, 2),
    ]))
    expect(p).toMatchObject({ kind: 'workouts', source: 'MacroFactor', sets: 2, warmups: 1, rirSets: 1, fileUnit: 'kg' })
    expect(p.workouts).toHaveLength(1)
    const [w] = p.workouts
    expect(w).toMatchObject({ d: '2026-10-20', name: A })
    expect(Math.round((w.end - w.start) / 60000)).toBe(91)
    expect(w.entries[0].sets).toEqual([
      { w: 0, r: 8, done: true, phase: 'warmup' },
      { w: 10, r: 8, done: true, rir: 2 },
    ])
    // Only the Quick Export's own weigh-in, not its trend line and not the set weights.
    expect(p.bodyweight).toMatchObject({ kind: 'bodyweight', source: 'MacroFactor', bodyweight: [{ d: '2026-10-21', w: 81.5 }] })
  })

  it('takes the superset out of the name and groups the exercises by it', async () => {
    const p = await parse(workbook([
      set('2026-10-20', A, 'Pec Fly Machine ∈ SS1', 'Standard Set', 40, 10, 2),
      set('2026-10-20', A, 'Barbell Curl ∈ SS1', 'Standard Set', 30, 10, 2),
      set('2026-10-20', A, 'Pec Fly Machine ∈ SS1', 'Standard Set', 40, 9, 1),
      set('2026-10-20', A, 'Plank', 'Standard Set', 0, 1),
    ]))
    const [a, b, c] = p.workouts[0].entries
    expect(a.sets).toHaveLength(2)
    expect(a.sg).toBeTruthy()
    expect(b.sg).toBe(a.sg)
    expect(c.sg).toBeUndefined()
    expect(p.unmatchedNames.join(' ')).not.toContain('∈')
  })

  it('counts the bar or sled into the load, the way MacroFactor’s own volume does', async () => {
    const p = await parse(workbook([set('2026-10-20', A, 'Smith Machine Overhead Press', 'Standard Set', 40, 11, 3, 11.3)]))
    expect(p.workouts[0].entries[0].sets[0].w).toBe(51.3)
  })

  it('marks a Failure Set as taken to failure', async () => {
    const p = await parse(workbook([set('2026-10-22', A, 'Barbell Curl', 'Failure Set', 30, 10, 0)]))
    expect(p.workouts[0].entries[0].sets[0]).toMatchObject({ failure: true, rir: 0 })
  })

  it('keeps two workouts on one day apart by their names', async () => {
    const p = await parse(workbook([
      set('2026-10-20', A, 'Barbell Curl', 'Standard Set', 30, 10),
      set('2026-10-20', 'Evening', 'Barbell Curl', 'Standard Set', 30, 10),
    ]))
    expect(p.workouts.map(w => w.name)).toEqual([A, 'Evening'])
  })

  it('converts to the profile’s unit', async () => {
    const p = await parse(workbook([set('2026-10-20', A, 'Barbell Curl', 'Standard Set', 30, 10)]), { unit: 'lb' })
    expect(p.converted).toBe(true)
    expect(p.workouts[0].entries[0].sets[0].w).toBe(66.1)
    expect(p.bodyweight.bodyweight[0].w).toBe(179.6)
  })

  it('with no workouts logged is a body-weight file', async () => {
    const p = await parse(workbook([]))
    expect(p).toMatchObject({ kind: 'bodyweight', source: 'MacroFactor', bodyweight: [{ d: '2026-10-21' }] })
  })

  it('never reads the sets’ weights as weigh-ins, even when no set could be read', async () => {
    const p = await parse(workbook([set('not a date', A, 'Barbell Curl', 'Standard Set', 30, 10)], []))
    expect(p).toMatchObject({ error: 'unrecognised' })
  })

  it('reads every sheet of sets, not just the first, as one history', async () => {
    const book = makeXlsx([
      { name: 'Workout Log', rows: [LOG, set('2026-10-20', A, 'Barbell Curl', 'Standard Set', 30, 10)] },
      { name: 'Workout Log (2)', rows: [LOG, set('2026-10-27', A, 'Barbell Curl', 'Standard Set', 32.5, 10)] },
      { name: 'Quick Export', rows: [QUICK, [{ date: 46316 }, 3223, 80.29, 81.45, '', 6862]] },
    ])
    const p = await parse(book)
    expect(p.workouts.map(w => w.d)).toEqual(['2026-10-20', '2026-10-27'])
    expect(p.sets).toBe(2)
    expect(p.bodyweight.bodyweight).toHaveLength(1)
  })

  it('with neither is not recognised', async () => {
    expect(await parse(workbook([], [[{ date: 46316 }, 3223, 80.29, '', '', 6862]]))).toMatchObject({ error: 'unrecognised' })
  })

  it('merges into the history: workouts, then the weigh-ins, existing days left alone', async () => {
    const p = await parse(workbook([set('2026-10-20', A, 'Barbell Curl', 'Standard Set', 30, 10)]))
    const S = { workouts: [], bodyweight: [{ d: '2026-10-21', w: 80, t: 0 }], customEx: [], exWeights: {} }
    expect(mergeImport(S, p).added).toBe(1)
    expect(mergeImport(S, p.bodyweight)).toEqual({ added: 0, skipped: 1 })
    expect(S.workouts).toHaveLength(1)
    expect(S.bodyweight).toEqual([{ d: '2026-10-21', w: 80, t: 0 }])
  })
})
