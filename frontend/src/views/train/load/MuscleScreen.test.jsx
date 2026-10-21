// @vitest-environment happy-dom
// T9.6 a muscle: the tiles (this week against the target, the last 4 weeks, fatigue with when it
// is ready), this week's exercises, Try next, and the redirect for a slug that is no muscle.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXIDX } from '../../../lib/exercises.js'
import { click, useView } from '../../../ds/render.test-util.js'
import { DEF, useStore } from '../../../store/useStore.js'

const mocks = vi.hoisted(() => ({ nav: vi.fn(), params: {} }))
const sheets = vi.hoisted(() => ({ exerciseDetailSheet: vi.fn() }))
vi.mock('../../../sheets.jsx', () => sheets)
vi.mock('react-router-dom', async orig => ({ ...(await orig()), useNavigate: () => mocks.nav, useParams: () => mocks.params }))
vi.mock('../../../ds/BodyMap.jsx', () => ({ default: props => React.createElement('div', { 'data-body-map': props.selected }) }))

import MuscleScreen from './MuscleScreen.jsx'

const NOW = new Date(2026, 8, 30, 12).getTime()   // Wednesday 30 Sep 2026
const view = useView()
const q = s => view.host.querySelector(s)
const qa = s => [...view.host.querySelectorAll(s)]
const at = d => new Date(d + 'T12:00:00').getTime()
const reps = (n, extra = {}) => Array.from({ length: n }, () => ({ done: true, w: 80, r: 8, unit: 'kg', ...extra }))

const show = (slug, workouts = [], how = 'prop') => {
  useStore.setState({ S: { ...structuredClone(DEF), unit: 'kg', body: 'male', weekStart: 1, workouts } })
  mocks.params = how === 'route' ? { slug } : {}
  view.render(how === 'route' ? <MuscleScreen /> : <MuscleScreen slug={slug} />)
}
const tiles = () => qa('.g-stat').map(s => [...s.children].map(c => c.textContent))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.nav.mockClear()
  sheets.exerciseDetailSheet.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('a muscle (T9.6)', () => {
  const week = [
    { id: 'm', d: '2026-09-28', start: at('2026-09-28'), unit: 'kg', entries: [
      { id: '0025', sets: reps(4) },
      { id: 'dips', exercise: { n: 'Dips', muscleWeights: { triceps: 1, chest: 0.4 } }, sets: reps(3) },
    ] },
    { id: 'old', d: '2026-09-15', start: at('2026-09-15'), unit: 'kg', entries: [{ id: '0025', sets: reps(2) }] },
  ]

  it('is titled by the muscle, from the route', () => {
    show('chest', week, 'route')
    expect(q('.g-snav, .g-spage').textContent).toContain('Chest')
    expect(q('[data-body-map]').dataset.bodyMap).toBe('chest')
  })

  it('reads this week against the common target, the last 4 weeks, and its fatigue', () => {
    show('chest', week)
    const [thisWeek, four, fatigue] = tiles()
    expect(thisWeek).toEqual(['This week', '5.2 sets', 'of 10 to 12'])
    expect(four).toEqual(['Last 4 weeks', '7.2 sets', '1.8 a week'])
    expect(fatigue[0]).toBe('Fatigue')
    expect(fatigue[1]).toMatch(/^\d+%$/)
  })

  it('says when a resting muscle is ready', () => {
    show('chest', [{ id: 'f', d: '2026-09-30', start: NOW - 3600000, unit: 'kg', entries: [{ id: '0025', sets: reps(10, { rir: 0 }) }] }])
    expect(tiles()[2][2]).toMatch(/^rest until /)
  })

  it('says Ready, with no "until", for a rested muscle', () => {
    show('calves', week)
    expect(tiles()[2]).toEqual(['Fatigue', '0%', 'Ready'])
  })

  it('lists this week’s exercises, the main ones by sets and day, a secondary by what it counted', () => {
    show('chest', week)
    const rows = qa('.g-load-sec')[0].querySelectorAll('.g-xrow')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('4 sets · ')
    expect(rows[1].textContent).toContain('Dips')
    expect(rows[1].textContent).toContain('1.2 sets counted · secondary')
    click(rows[0])
    expect(sheets.exerciseDetailSheet).toHaveBeenCalledWith(EXIDX['0025'])
  })

  it('says when nothing trained it this week', () => {
    show('calves', week)
    expect(q('.g-load-note').textContent).toBe('Nothing trained it this week yet.')
  })

  it('suggests exercises not done yet, each opening its drawer', () => {
    show('chest', week)
    const next = qa('.g-load-sec')[1]
    expect(next.querySelector('h2').textContent).toBe('Try next')
    const rows = next.querySelectorAll('.g-xrow')
    expect(rows).toHaveLength(3)
    expect([...rows].every(r => r.textContent.includes('Chest · '))).toBe(true)
    click(rows[0])
    expect(sheets.exerciseDetailSheet).toHaveBeenCalledTimes(1)
    expect(sheets.exerciseDetailSheet.mock.calls[0][0].id).not.toBe('0025')
  })

  it('sends a slug that is no muscle back to Training load, replacing it', () => {
    show('wings', [], 'route')
    expect(mocks.nav).toHaveBeenCalledWith('/progress/load', { replace: true })
    expect(q('.g-load')).toBeNull()
  })
})
