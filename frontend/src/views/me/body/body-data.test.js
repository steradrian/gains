import { describe, expect, it } from 'vitest'
import { axisDates, bodyOf, validWeighIns, waitingDays } from './body-data.js'
import { syncFingerprint } from '../../../lib/sync-changes.js'

const TODAY = '2026-10-18'
const S = (over = {}) => ({
  unit: 'kg', targetW: 78,
  bodyweight: [
    ['2026-09-06', 83.6], ['2026-09-13', 83.4], ['2026-09-20', 83.0], ['2026-09-27', 82.6],
    ['2026-10-04', 82.1], ['2026-10-11', 81.7], ['2026-10-18', 81.4],
  ].map(([d, w]) => ({ d, w })),
  ...over,
})

describe('bodyOf', () => {
  it('is empty with no weigh-ins, ignoring entries with no day or weight', () => {
    expect(bodyOf({ unit: 'kg', bodyweight: [] }, { today: TODAY })).toMatchObject({ empty: true, rows: [], count: 0, latest: null })
    expect(bodyOf({ bodyweight: [{ d: '2026-10-01', w: 0 }, { w: 80 }, null] }, { today: TODAY }).empty).toBe(true)
  })

  it('reads the latest, its change over 7 days and the way to the target', () => {
    const data = bodyOf(S(), { today: TODAY })
    expect(data.latest).toEqual({ d: '2026-10-18', w: 81.4, today: true })
    expect(data.weekChange).toBe(-0.3)
    expect(data.periodChange).toBe(-2.2)
    expect(data.toTarget).toEqual({ kind: 'lose', amount: 3.4 })
    expect(data.target).toBe(78)
  })

  it('lists the rows newest first with the change from the weigh-in before each', () => {
    const { rows, count } = bodyOf(S(), { today: TODAY })
    expect(count).toBe(7)
    expect(rows.map(r => [r.d, r.w, r.change, r.today])).toEqual([
      ['2026-10-18', 81.4, -0.3, true], ['2026-10-11', 81.7, -0.4, false], ['2026-10-04', 82.1, -0.5, false],
      ['2026-09-27', 82.6, -0.4, false], ['2026-09-20', 83.0, -0.4, false], ['2026-09-13', 83.4, -0.2, false],
      ['2026-09-06', 83.6, null, false],
    ])
  })

  it('follows the range: the list and the points shrink, and the first row still reads against the one outside', () => {
    const from = new Date('2026-10-01T12:00:00').getTime()
    const data = bodyOf(S(), { from, today: TODAY })
    expect(data.rows.map(r => r.d)).toEqual(['2026-10-18', '2026-10-11', '2026-10-04'])
    expect(data.points.map(p => p.d)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18'])
    expect(data.rows.at(-1).change).toBe(-0.5)
    expect(data.periodChange).toBe(-0.7)
    expect(data.weekChange).toBe(-0.3)
  })

  it('has no week change without a weigh-in 7 days back, and no period change from one point', () => {
    const data = bodyOf(S({ bodyweight: [{ d: '2026-10-15', w: 80 }, { d: '2026-10-18', w: 79.5 }] }), { today: TODAY })
    expect(data.weekChange).toBeNull()
    const one = bodyOf(S({ bodyweight: [{ d: '2026-10-18', w: 80 }] }), { today: TODAY })
    expect(one.periodChange).toBeNull()
    expect(one.rows[0].change).toBeNull()
  })

  it('says the latest is not today, and reaches the target', () => {
    const data = bodyOf(S({ targetW: 81.4 }), { today: '2026-10-20' })
    expect(data.latest.today).toBe(false)
    expect(data.toTarget).toEqual({ kind: 'reached', amount: 0 })
  })

  it('goes gaining when the target is above, and has none without a target', () => {
    expect(bodyOf(S({ targetW: 85 }), { today: TODAY }).toTarget).toEqual({ kind: 'gain', amount: 3.6 })
    expect(bodyOf(S({ targetW: null }), { today: TODAY })).toMatchObject({ target: null, toTarget: null })
  })

  it('reads the unit from the state', () => {
    expect(bodyOf(S({ unit: 'lb' }), { today: TODAY }).unit).toBe('lb')
  })
})

describe('validWeighIns', () => {
  it('sorts oldest first whatever the stored order', () => {
    const out = validWeighIns({ bodyweight: [{ d: '2026-10-02', w: 80 }, { d: '2026-10-01', w: 81 }] })
    expect(out.map(b => b.d)).toEqual(['2026-10-01', '2026-10-02'])
  })
})

describe('axisDates', () => {
  it('spreads four days from the first point to the last', () => {
    const points = [{ d: '2026-09-06' }, { d: '2026-09-27' }, { d: '2026-10-18' }]
    expect(axisDates(points)).toEqual(['2026-09-06', '2026-09-20', '2026-10-04', '2026-10-18'])
  })

  it('has no axis for one point or one day, and fewer ticks for a short span', () => {
    expect(axisDates([{ d: '2026-10-18' }])).toEqual([])
    expect(axisDates([{ d: '2026-10-18' }, { d: '2026-10-18' }])).toEqual([])
    expect(axisDates([{ d: '2026-10-17' }, { d: '2026-10-18' }])).toEqual(['2026-10-17', '2026-10-18'])
  })
})

describe('waitingDays', () => {
  it('lists the days added or changed since the copy the server agreed on', () => {
    const was = S()
    const fp = syncFingerprint(was)
    const now = S({ bodyweight: [...was.bodyweight.slice(0, 6), { d: '2026-10-18', w: 81.0 }, { d: '2026-10-19', w: 80.9 }] })
    expect(waitingDays(now, fp).sort()).toEqual(['2026-10-18', '2026-10-19'])
  })

  it('has nothing to say without a fingerprint', () => {
    expect(waitingDays(S(), null)).toEqual([])
  })
})
