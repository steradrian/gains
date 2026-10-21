// @vitest-environment happy-dom
// T9.0 Training load: the segments and their deep links, the redirects to the schedule, the
// Activity card's taps and metric, Balance (period, week arrows, Show more, Hard sets, not
// trained), Fatigue, Strength and Effort, and where every tap goes. Ported from the old
// TrainingLoad, MuscleBalance and Heatmap page tests.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _setLangState } from '../../../lib/i18n-core.js'
import { MUSCLES } from '../../../lib/muscles.js'
import { click, useView } from '../../../ds/render.test-util.js'
import { DEF, useStore } from '../../../store/useStore.js'

const mocks = vi.hoisted(() => ({ search: '', nav: vi.fn(), heatmaps: [] }))
const sheets = vi.hoisted(() => ({ workoutDetailSheet: vi.fn(), openDay: vi.fn() }))
vi.mock('../../../sheets.jsx', () => sheets)
vi.mock('react-router-dom', async orig => ({
  ...(await orig()),
  useNavigate: () => mocks.nav,
  useLocation: () => ({ search: mocks.search, pathname: '/progress/load' }),
}))
vi.mock('../../../ds/Heatmap.jsx', () => ({
  default: props => { mocks.heatmaps.push(props); return React.createElement('div', { 'data-heatmap': true }) },
}))
vi.mock('../../../ds/BodyMap.jsx', () => ({
  default: props => React.createElement('div', { 'data-body-map': true, 'data-levels': JSON.stringify(props.levels) },
    React.createElement('button', { type: 'button', 'aria-label': 'map chest', onClick: () => props.onMuscle?.('chest') })),
}))

import TrainingLoadScreen from './TrainingLoadScreen.jsx'

const NOW = new Date(2026, 8, 30, 12).getTime()   // Wednesday 30 Sep 2026
const view = useView()
const q = s => view.host.querySelector(s)
const qa = s => [...view.host.querySelectorAll(s)]
const press = { id: 'press', n: 'Press', primaries: ['chest'], secondaries: ['triceps'], custom: true }
const completed = (d, muscle, sets, extra = {}) => ({
  id: `${d}-${muscle}`, d, start: new Date(`${d}T12:00:00`).getTime(),
  entries: [{ id: `custom-${muscle}`, exercise: { primaries: [muscle], secondaries: [] }, sets: Array.from({ length: sets }, () => ({ done: true, ...extra })) }],
})
const set = (extra = {}) => ({ done: true, w: 80, r: 8, ...extra })
const workout = (id, d, sets) => ({ id, d, start: new Date(`${d}T12:00:00`).getTime(), entries: [{ id: '0025', sets }] })

const show = (search = '', over = {}) => {
  mocks.search = search
  useStore.setState({ S: {
    ...structuredClone(DEF), unit: 'kg', body: 'male', effort: null, bodyweight: [], weekStart: 1, dayNotes: {},
    routines: [{ id: 'push', name: 'Push', ex: [{ id: press.id, sets: 2 }] }], customEx: [press], week: { 1: ['push'] }, workouts: [], ...over,
  } })
  view.render(<TrainingLoadScreen />)
}
const tabs = () => qa('.g-load > .g-sseg button').map(b => b.textContent)
const tab = () => q('.g-load > .g-sseg [aria-checked="true"]')?.textContent
const segButton = (label, scope = '.g-load > .g-sseg') => [...view.host.querySelectorAll(scope + ' button')].find(b => b.textContent === label)
const periodButton = label => segButton(label, '.g-load-sec > .g-sseg')
const button = text => qa('button').find(b => b.textContent.trim() === text)
const rows = () => qa('[data-muscle-volume]').map(r => r.dataset.muscleVolume)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.heatmaps.length = 0
  mocks.nav.mockClear()
  Object.values(sheets).forEach(fn => fn.mockClear())
})
afterEach(() => vi.useRealTimers())

describe('Training load: segments and deep links', () => {
  it('opens on Balance under the Activity card, with Balance, Fatigue and Strength', () => {
    show()
    expect(q('.g-spage-title').textContent).toBe('Training load')
    expect(q('[data-heatmap]')).not.toBeNull()
    expect(tabs()).toEqual(['Balance', 'Fatigue', 'Strength'])
    expect(tab()).toBe('Balance')
  })

  it.each([
    ['activity', 'Balance'], ['muscles', 'Balance'], ['fatigue', 'Fatigue'], ['strength', 'Strength'], ['nonsense', 'Balance'],
  ])('opens ?view=%s on %s', (v, label) => {
    show('?view=' + v, { workouts: [workout('w', '2026-09-10', [set()])] })
    expect(tab()).toBe(label)
  })

  it('opens ?view=effort on Balance when there is no effort to read', () => {
    show('?view=effort')
    expect(tab()).toBe('Balance')
  })

  it('switches in place and replaces the URL, keeping other params', () => {
    show('?x=1')
    click(segButton('Fatigue'))
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/load?x=1&view=fatigue', { replace: true })
    expect(tab()).toBe('Fatigue')
    click(segButton('Balance'))
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/load?x=1&view=muscles', { replace: true })
  })

  it.each(['?view=plan', '?focus=weekly-volume', '?focus=weekly-volume&x=1'])('sends %s to the schedule, replacing it', search => {
    show(search)
    expect(mocks.nav).toHaveBeenCalledTimes(1)
    expect(mocks.nav).toHaveBeenCalledWith('/train/schedule', { replace: true })
    expect(q('.g-load')).toBeNull()
  })

  it('does not redirect a plain link', () => {
    show('?view=muscles')
    expect(mocks.nav).not.toHaveBeenCalled()
  })

  it('says the workouts and their time since the first one under the title', () => {
    const w = { id: 'a', d: '2026-05-12', start: new Date('2026-05-12T10:00:00').getTime(), end: new Date('2026-05-12T10:52:00').getTime(), entries: [] }
    show('', { workouts: [w] })
    expect(q('.g-spage-sub').textContent).toBe('1 workout · 52 min since May')
  })
})

describe('Training load: Activity', () => {
  it('opens one workout, and the day for several or a noted day', () => {
    const only = workout('only', '2026-09-10', [set()])
    show('', { workouts: [only, workout('a', '2026-09-11', [set()]), workout('b', '2026-09-11', [set()])] })
    mocks.heatmaps.at(-1).onDay('2026-09-10')
    expect(sheets.workoutDetailSheet).toHaveBeenCalledWith(only)
    mocks.heatmaps.at(-1).onDay('2026-09-11')
    expect(sheets.openDay).toHaveBeenCalledWith('2026-09-11')
    mocks.heatmaps.at(-1).onDay('2026-09-12')
    expect(sheets.openDay).toHaveBeenLastCalledWith('2026-09-12')
    expect(sheets.workoutDetailSheet).toHaveBeenCalledTimes(1)
  })

  it('reads the metric from the profile and keeps a change on it', () => {
    show('', { heatmapMetric: 'vol' })
    expect(mocks.heatmaps.at(-1).legend).toEqual({ less: 'Less volume', more: 'More volume' })
    click(segButton('Time', '.g-load-sec .g-sseg'))
    expect(useStore.getState().S.heatmapMetric).toBe('time')
    expect(mocks.heatmaps.at(-1).legend).toEqual({ less: 'Less time', more: 'More time' })
  })

  it('draws a year by week in five shades, with month labels and every cell said', () => {
    show('', { workouts: [workout('w', '2026-09-10', [set()])] })
    const props = mocks.heatmaps.at(-1)
    expect(props).toMatchObject({ byWeek: true, levels: 5, tone: 'stage' })
    expect(props.values.length).toBe(props.days.length)
    expect(props.days.every(d => typeof d.label === 'string' && d.label.length > 0)).toBe(true)
    expect(props.months.length).toBeGreaterThan(0)
  })
})

describe('Training load: Balance', () => {
  const plan12 = { routines: [{ id: 'push', name: 'Push', ex: [{ id: 'press', sets: 12 }] }] }

  it('says "No workouts yet" with nothing logged and nothing planned', () => {
    show('', { routines: [], week: {} })
    expect(q('.g-sempty b').textContent).toBe('No workouts yet')
    expect(q('[data-body-map]')).toBeNull()
  })

  it('shows the map and the plan’s rows for a plan with no workouts yet', () => {
    show()
    expect(q('[data-body-map]')).not.toBeNull()
    expect(rows()).toEqual(['chest', 'triceps'])
  })

  it('reads this week against the plan, with the spoken comparison', () => {
    show('', { ...plan12, workouts: [completed('2026-09-30', 'chest', 8), completed('2026-09-30', 'biceps', 3)] })
    expect(q('.g-load-period').textContent).toContain('This week')
    expect(q('[aria-label="Next week"]').disabled).toBe(true)
    const chest = q('[data-muscle-volume="chest"]')
    expect(chest.querySelector('.g-load-val').textContent).toBe('8/12 · 67%')
    expect(chest.querySelector('.g-sr').textContent).toBe('Completed 8 sets · Planned 12 sets')
    expect(q('[data-muscle-volume="biceps"] .g-load-val').textContent).toBe('3 sets')
  })

  it('shows four rows, then all of them with Show more, and back with Show less', () => {
    show('', { ...plan12, workouts: ['biceps', 'upper-back', 'chest', 'calves', 'deltoids'].map((m, i) => completed('2026-09-30', m, 8 - i)) })
    expect(rows()).toHaveLength(4)
    const more = q('.g-load-more')
    expect(more.textContent).toBe('Show more')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    click(more)
    expect(rows()).toEqual(['biceps', 'upper-back', 'chest', 'calves', 'deltoids', 'triceps'])
    expect(q('.g-load-more').textContent).toBe('Show less')
    click(q('.g-load-more'))
    expect(rows()).toHaveLength(4)
  })

  it('leaves Show more out with four rows or fewer', () => {
    show('', { workouts: [completed('2026-09-30', 'chest', 4)] })
    expect(q('.g-load-more')).toBeNull()
  })

  it('steps back a week by the arrows, reading what was done, then forward to this week', () => {
    show('', { weekStart: 0, workouts: [completed('2026-09-27', 'biceps', 1), completed('2026-09-20', 'quadriceps', 4)] })
    expect(q('[data-weekly-volume-comparison]').dataset.week).toBe('2026-09-27')
    click(q('[aria-label="Previous week"]'))
    expect(q('[data-weekly-volume-comparison]').dataset.week).toBe('2026-09-20')
    expect(q('.g-load-period').textContent).not.toContain('This week')
    expect(rows()).toEqual(['quadriceps'])
    expect(q('.g-load-list').textContent).not.toContain('/')
    expect(q('[aria-label="Next week"]').disabled).toBe(false)
    click(q('[aria-label="Next week"]'))
    expect(q('[data-weekly-volume-comparison]').dataset.week).toBe('2026-09-27')
  })

  it('says an empty earlier week has nothing, keeping the map and the arrows', () => {
    show('', { workouts: [completed('2026-09-30', 'biceps', 3)] })
    click(q('[aria-label="Previous week"]'))
    expect(q('[data-body-map]')).not.toBeNull()
    expect(q('.g-sempty b').textContent).toBe('No workouts in this period yet.')
  })

  it('lists the muscles not trained as chips that open the muscle', () => {
    show('', { workouts: [completed('2026-09-30', 'biceps', 3)] })
    expect(q('.g-load-missed h3').textContent).toBe('Not trained in this period')
    click(button('Chest'))
    expect(mocks.nav).toHaveBeenCalledWith('/progress/load/muscle/chest')
  })

  it('says every muscle got some work instead, when it did', () => {
    show('', { workouts: MUSCLES.map(m => completed('2026-09-30', m, 1)) })
    expect(q('.g-load-missed')).toBeNull()
    expect(qa('.g-load-note').map(n => n.textContent)).toContain('Every muscle group got some work in this period.')
  })

  it('opens the muscle from a row and from the map', () => {
    show('', { workouts: [completed('2026-09-30', 'biceps', 3)] })
    click(q('[data-muscle-volume="biceps"]'))
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/load/muscle/biceps')
    click(q('[aria-label="map chest"]'))
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/load/muscle/chest')
  })

  describe('a window and Hard sets', () => {
    const rated = (d, muscle, sets, rir) => completed(d, muscle, sets, { rir })

    it('names the window and offers the Hard sets chip when it has sets rated hard', () => {
      show('', { workouts: [rated('2026-09-20', 'chest', 3, 0), rated('2026-09-20', 'biceps', 2, 5)] })
      expect(button('Hard sets')).toBeUndefined()
      click(periodButton('30d'))
      expect(q('.g-load-period').textContent).toBe('Last 30 days')
      expect(q('[aria-label="Previous week"]')).toBeNull()
      const chip = button('Hard sets')
      expect(chip.getAttribute('aria-pressed')).toBe('false')
      expect(rows()).toEqual(['chest', 'biceps'])
      click(chip)
      expect(button('Hard sets').getAttribute('aria-pressed')).toBe('true')
      expect(rows()).toEqual(['chest'])
      expect(q('.g-load-cap').textContent).toContain('by hard sets')
      expect(q('.g-load-missed h3').textContent).toBe('No hard sets in this period')
    })

    it('does not offer it when no set is rated hard', () => {
      show('', { workouts: [rated('2026-09-20', 'biceps', 2, 5)] })
      click(periodButton('90d'))
      expect(button('Hard sets')).toBeUndefined()
    })

    it('lets a window expand past four rows too', () => {
      show('', { workouts: ['biceps', 'upper-back', 'chest', 'calves', 'deltoids'].map((m, i) => completed('2026-09-20', m, 8 - i)) })
      click(periodButton('All'))
      expect(q('.g-load-period').textContent).toBe('All time')
      click(q('.g-load-more'))
      expect(rows()).toHaveLength(5)
    })
  })
})

describe('Training load: Fatigue and Strength', () => {
  const recent = (ago, n, extra = {}) => ({ id: 'r' + ago, d: '2026-09-30', start: NOW - ago, unit: 'kg', entries: [{ id: '0025', sets: Array.from({ length: n }, () => set({ unit: 'kg', ...extra })) }] })

  it('Fatigue: the note, the legend, the muscles carrying fatigue with their % and state', () => {
    show('?view=fatigue', { workouts: [recent(3600000, 8, { rir: 0 })] })
    expect(q('.g-load-note').textContent).toBe('Fatigue shows how recently each muscle was trained. High means rest.')
    expect(q('.g-load-legend').textContent).toBe('FatiguedRecoveringReady')
    const chest = q('[data-muscle-volume="chest"]')
    expect(chest.querySelector('.g-load-val').textContent).toMatch(/^\d+%$/)
    expect(chest.querySelector('.g-glist-body span').textContent).toBe('Fatigued')
    click(chest)
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/load/muscle/chest')
  })

  it('Fatigue: says when every muscle is ready', () => {
    show('?view=fatigue')
    expect(qa('.g-load-note').map(n => n.textContent)).toContain('Every muscle is ready.')
  })

  it('Strength: the map, the muscles losing strength, and the lifts that open their progress', () => {
    show('?view=strength', { workouts: [workout('old', '2026-09-10', [set({ unit: 'kg' })])] })
    expect(q('.g-load-note').textContent).toBe('Strength shows retained muscle strength. Train again to reset it.')
    const losing = q('[data-muscle-volume="chest"]')
    expect(losing.querySelector('.g-load-val').textContent).toBe('1 set')
    expect(losing.querySelector('.g-glist-body span').textContent).toBe('Weeks since training: 2')
    const lift = q('.g-xrow')
    expect(lift.textContent).toContain('Losing strength · ')
    expect(lift.querySelector('.g-load-val').textContent).toMatch(/kg$/)
    click(lift)
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?ex=0025')
  })

  it('Strength: a lift done this week reads Completed', () => {
    show('?view=strength', { workouts: [workout('new', '2026-09-29', [set({ unit: 'kg' })])] })
    expect(q('.g-xrow').textContent).toContain('Completed · ')
  })

  it('Strength: says so when nothing has an estimated 1RM', () => {
    show('?view=strength')
    expect(qa('.g-load-note').map(n => n.textContent)).toContain('No exercises with an estimated 1RM yet.')
  })
})

describe('Training load: Effort', () => {
  const rated = () => [workout('rated', '2026-09-30', Array.from({ length: 6 }, () => set({ rir: 2 })))]

  it('is offered only with effort to read', () => {
    show('', { workouts: [workout('bw', '2026-09-10', [{ done: true, w: 0, r: 10 }])] })
    expect(tabs()).not.toContain('Effort')
  })

  it('is a fourth segment for rated history, and opens the Effort card', () => {
    show('', { workouts: rated() })
    expect(tabs()).toEqual(['Balance', 'Fatigue', 'Strength', 'Effort'])
    click(segButton('Effort'))
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/load?view=effort', { replace: true })
    const head = q('.g-load-effort h2')
    expect(head.textContent.startsWith('Effort')).toBe(true)
    expect(head.textContent).not.toContain('estimated')
  })

  it('reads short in German', async () => {
    const de = (await import('../../../locales/de.js')).default
    _setLangState('de', de, null, null)
    try {
      show('', { workouts: rated() })
      expect(tabs().at(-1)).toBe('Einsatz')
    } finally { _setLangState('en', {}, null, null) }
  })

  it('opens directly on ?view=effort', () => {
    show('?view=effort', { workouts: rated() })
    expect(tab()).toBe('Effort')
  })

  it('says a window with no rated sets has none, and All finds them', () => {
    show('?view=effort', { workouts: [workout('old', '2020-01-01', Array.from({ length: 6 }, () => set({ rir: 2 })))] })
    expect(q('.g-load-effort .g-sempty b').textContent).toBe('No rated sets in this period.')
    expect(q('.g-load-effort').textContent).not.toContain('average effort')
    click(segButton('All', '.g-load-effort .g-sseg'))
    expect(q('.g-load-effort .g-sempty')).toBeNull()
    expect(q('.g-load-effort').textContent).toContain('average effort')
  })

  it('badges estimated numbers on unrated imported history', () => {
    show('?view=effort', { workouts: [workout('unrated', '2026-09-30', Array.from({ length: 6 }, () => set()))] })
    expect(q('.g-load-effort h2').textContent).toContain('estimated')
    expect(q('.g-load-effort').textContent).toContain('0 rated')
  })
})
