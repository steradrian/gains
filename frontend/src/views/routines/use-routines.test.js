// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { routinesOf } from './use-routines.js'

vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const clone = v => JSON.parse(JSON.stringify(v))
const routine = (id, name, n = 6, extra = {}) => ({ id, name, emoji: null, ex: Array.from({ length: n }, () => ({ id: '0025' })), ...extra })
// Board T4.0: Push A on Sun and Thu, Pull A on Wed, Legs on Mon and Sat; Upper A imported, Arms
// never trained.
const boards = (over = {}) => Object.assign(clone(DEF), {
  weekStart: 0,
  routines: [
    routine('push', 'Push A'), routine('pull', 'Pull A'), routine('legs', 'Legs'),
    routine('upper', 'Upper A', 7, { importedFrom: 'Upper Lower' }), routine('arms', 'Arms', 5),
  ],
  week: { 0: ['push'], 4: ['push'], 3: ['pull'], 1: ['legs'], 6: ['legs'] },
  dayPlan: {}, queue: null, rotation: null, scheduleMode: 'week',
  workouts: [{ id: 'w1', d: '2026-10-01', start: 1, routineIds: ['push'], entries: [] }],
}, over)
const subs = g => g.rows.map(r => r.name + ' — ' + r.sub)

describe('routinesOf (T4.0)', () => {
  it('groups the routines as the board draws them, each group in S.routines order', () => {
    const v = routinesOf(boards())
    expect(v.sub).toBe('5 routines · 3 in your Plan')
    expect(v.groups.map(g => g.title)).toEqual(['In your Plan', 'Not in your Plan'])
    expect(subs(v.groups[0])).toEqual(['Push A — 6 exercises · Sun, Thu', 'Pull A — 6 exercises · Wed', 'Legs — 6 exercises · Mon, Sat'])
    expect(subs(v.groups[1])).toEqual(['Upper A — 7 exercises · imported from Upper Lower', 'Arms — 5 exercises · not done yet'])
    expect(v.freestyle).toEqual({ title: 'No routine', name: 'Freestyle', sub: 'Start a workout and pick exercises as you go' })
    expect(v.all.map(r => r.id)).toEqual(['push', 'pull', 'legs', 'upper', 'arms'])
  })

  it('reads the days in the order the person’s week runs', () => {
    const v = routinesOf(boards({ weekStart: 1 }))
    expect(v.groups[0].rows[0].sub).toBe('6 exercises · Thu, Sun')
  })

  it('a routine only in the loop is in the Plan while the Plan runs as a loop, and not under a fixed week', () => {
    const loop = { rotation: { id: 'rot', sequence: ['arms'] }, scheduleMode: 'rotation' }
    const v = routinesOf(boards(loop))
    expect(subs(v.groups[0])).toContain('Arms — 5 exercises · in your loop')
    expect(v.sub).toBe('5 routines · 4 in your Plan')
    expect(routinesOf(boards({ ...loop, scheduleMode: 'week' })).sub).toBe('5 routines · 3 in your Plan')
  })

  it('“not done yet” only with no workout from it, and “imported” only with importedFrom', () => {
    const s = boards({
      routines: [routine('a', 'A', 2), routine('b', 'B', 2, { importedFrom: null }), routine('c', 'C', 2)],
      week: {},
      workouts: [{ id: 'w', d: '2026-10-01', start: 1, routineIds: ['x'], entries: [{ id: '0025', rid: 'c' }] }],
    })
    expect(subs(routinesOf(s).groups[0])).toEqual(['A — 2 exercises · not done yet', 'B — 2 exercises · imported', 'C — 2 exercises'])
  })

  it('T4.4: the imported routines come first under “Added from”, each new, and leave the other groups', () => {
    const v = routinesOf(boards(), { imported: { ids: ['upper', 'arms'], from: 'Upper Lower' } })
    expect(v.groups.map(g => g.title)).toEqual(['Added from Upper Lower', 'In your Plan'])
    expect(subs(v.groups[0])).toEqual(['Upper A — 7 exercises · new', 'Arms — 5 exercises · new'])
    expect(routinesOf(boards(), { imported: { ids: ['arms'] } }).groups[0].title).toBe('Just added')
  })

  it('T4.1: nothing to group with no routines', () => {
    const v = routinesOf(boards({ routines: [], week: {} }))
    expect(v.empty).toBe(true)
    expect(v.groups).toEqual([])
    expect(v.sub).toBe(null)
  })

  it('a row carries up to three pictures and says when it is empty', () => {
    const v = routinesOf(boards({ routines: [routine('e', 'Empty', 0), routine('f', 'Full', 5)], week: {} }))
    const [empty, full] = v.all
    expect(empty).toMatchObject({ empty: true, thumbs: [] })
    expect(full.thumbs).toHaveLength(3)
  })
})
