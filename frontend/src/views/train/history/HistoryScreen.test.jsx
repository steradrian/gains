// @vitest-environment happy-dom
// T8.0 History and T8.2 its empty state: the count since the first workout, the month, the weeks
// with their workouts and day notes, and where each tap goes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../../ds/render.test-util.js'
import { DEF, useStore } from '../../../store/useStore.js'

const sheets = vi.hoisted(() => ({
  workoutDetailSheet: vi.fn(), openDay: vi.fn(), logPastWorkoutSheet: vi.fn(), startChooserSheet: vi.fn(), dayNoteSheet: vi.fn(),
}))
vi.mock('../../../sheets.jsx', () => sheets)

import HistoryScreen from './HistoryScreen.jsx'

const view = useView()
const q = s => view.host.querySelector(s)
const qa = s => [...view.host.querySelectorAll(s)]
const at = (iso, h = 17) => new Date(iso + 'T' + String(h).padStart(2, '0') + ':00:00').getTime()
const session = (id, d, name, more = {}) => ({ id, d, name, start: at(d), end: at(d) + 52 * 60000, vol: 9600, prs: [], entries: [], ...more })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T12:00:00'))   // a Wednesday
  Object.values(sheets).forEach(fn => fn.mockClear())
})
afterEach(() => vi.useRealTimers())

const show = (over = {}) => {
  useStore.setState({ S: { ...structuredClone(DEF), unit: 'kg', weekStart: 1, workouts: [], dayNotes: {}, ...over } })
  view.render(<HistoryScreen />)
}

describe('History, nothing logged (T8.2)', () => {
  it('says so, and offers to start a workout or log a past one', () => {
    show()
    expect(q('.g-sempty b').textContent).toBe('No workouts yet')
    expect(q('.g-mg')).toBeNull()
    const [start, past] = qa('.g-sempty-btn')
    expect(start.textContent).toBe('Start a workout')
    click(start)
    expect(sheets.startChooserSheet).toHaveBeenCalledTimes(1)
    click(past)
    expect(sheets.logPastWorkoutSheet).toHaveBeenCalledTimes(1)
  })
})

describe('History (T8.0)', () => {
  const workouts = [
    session('w1', '2026-08-04', 'Legs', { vol: 12400 }),
    session('w2', '2026-10-13', 'Pull A', { vol: 8200 }),
    session('w3', '2026-10-19', 'Push A', { prs: ['a', 'b'] }),
    session('w4', '2026-10-21', 'Pull A', { start: at('2026-10-21', 7), end: at('2026-10-21', 8) }),
    session('w5', '2026-10-21', 'Arms', { start: at('2026-10-21', 18), end: at('2026-10-21', 19) }),
  ]

  it('heads with the count since the month of the first workout, and logs a past one from the bar', () => {
    show({ workouts })
    expect(q('.g-spage-title').textContent).toBe('History')
    expect(q('.g-spage-sub').textContent).toBe('5 workouts since August')
    click(q('.g-snav-end [aria-label="Log a past workout"]'))
    expect(sheets.logPastWorkoutSheet).toHaveBeenCalledTimes(1)
  })

  it('lists the weeks newest first, each with its count and rows, the volume by Train\'s rule', () => {
    show({ workouts })
    const weeks = qa('.g-hist-week')
    expect(weeks.map(w => w.querySelector('.g-ssec h2').textContent)).toEqual(['This week', 'Last week', expect.stringMatching(/^Week of 3 Aug$/)])
    expect(weeks[0].querySelector('.g-ssec').textContent).toBe('This week3 workouts')
    expect(weeks.map(w => w.querySelectorAll('.g-hist-row').length)).toEqual([3, 1, 1])
    // newest first, the later of two on one day first
    const lines = qa('.g-hist-row .g-glist-body')
    expect(lines.map(l => l.querySelector('b').textContent)).toEqual(['Arms', 'Pull A', 'Push A', 'Pull A', 'Legs'])
    expect(lines[2].textContent).toBe('Push AMon 19 Oct · 52 min · 9,600 kg · 2 new bests')
    expect(lines[4].textContent).toBe('LegsTue 4 Aug · 52 min · 12.4 t')
    click(qa('.g-hist-row')[2])
    expect(sheets.workoutDetailSheet).toHaveBeenCalledWith(workouts[2])
  })

  it('keeps a day off with a note in its week, as a row that opens the note', () => {
    show({ workouts, dayNotes: { '2026-10-16': { tag: 'sick', text: 'Flu', _ts: 1 } } })
    const last = qa('.g-hist-week')[1]
    expect(last.querySelector('.g-ssec').textContent).toBe('Last week1 workout')
    const rows = [...last.querySelectorAll('.g-hist-row')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Sick', 'Pull A'])
    expect(rows[0].textContent).toContain('Fri 16 Oct · Flu')
    click(rows[0])
    expect(sheets.dayNoteSheet).toHaveBeenCalledWith('2026-10-16')
  })

  it('marks the trained days of the month and names each day for a screen reader', () => {
    show({ workouts })
    expect(q('.g-mg-top b').textContent).toBe('October 2026')
    const day = n => qa('.g-mg-cell')[n - 1]
    expect(day(19).getAttribute('aria-label')).toBe('Mon 19 Oct, 1 workout')
    expect(day(21).getAttribute('aria-label')).toBe('Wed 21 Oct, 2 workouts')
    expect(day(20).getAttribute('aria-label')).toBe('Tue 20 Oct')
    expect(day(19).querySelector('.g-mring-val')).not.toBeNull()
    expect(day(20).querySelector('.g-mring')).toBeNull()
    expect(day(21).classList.contains('g-mg-on')).toBe(true)
    expect(qa('.g-mg-head').map(h => h.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('a day with one workout opens it; several, or none, open the day', () => {
    show({ workouts })
    const day = n => qa('.g-mg-cell')[n - 1]
    click(day(19))
    expect(sheets.workoutDetailSheet).toHaveBeenCalledWith(workouts[2])
    click(day(21))
    expect(sheets.openDay).toHaveBeenLastCalledWith('2026-10-21')
    click(day(23))
    expect(sheets.openDay).toHaveBeenLastCalledWith('2026-10-23')
  })

  it('turns the month', () => {
    show({ workouts })
    click(q('.g-mg-nav[aria-label="Previous month"]'))
    expect(q('.g-mg-top b').textContent).toBe('September 2026')
    click(q('.g-mg-nav[aria-label="Next month"]'))
    click(q('.g-mg-nav[aria-label="Next month"]'))
    expect(q('.g-mg-top b').textContent).toBe('November 2026')
  })

  it('shows no All / Workouts / Activities switch while there is no activity source', () => {
    show({ workouts })
    expect(q('[role="radiogroup"]')).toBeNull()
    expect(view.host.textContent).not.toContain('Activities')
  })
})
