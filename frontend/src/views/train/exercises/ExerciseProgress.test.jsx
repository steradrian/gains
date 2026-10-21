// @vitest-environment happy-dom
// T7.0 Progress and T7.1 Past sets, /progress/strength on the stage: the exercise and its picker, the
// hero and its trend line, the range and metric switches, the chart and its fewer-than-two state, the
// tiles, the new bests, the calculator, the way into Structural balance, and ?view=sets. The picker
// sheet itself is covered in ExerciseProgress.picker.test.jsx.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { _setLangState } from '../../../lib/i18n-core.js'
import { fmtDate, fmtMonth } from '../../../lib/format.js'
import { estimate1RM } from '../../../lib/onerm.js'
import ExerciseProgress from './ExerciseProgress.jsx'

// The address is a small store: nav() to /progress/strength replaces its query and re-renders the
// page, as the router would, and `go()` changes it from outside, like a sheet's tab or Back.
const mocks = vi.hoisted(() => {
  const m = {
    charts: [], S: null, search: '', selectSheet: vi.fn(),
    exerciseDetailSheet: vi.fn(), workoutDetailSheet: vi.fn(), listeners: new Set(),
  }
  m.go = search => { m.search = search; m.listeners.forEach(f => f()) }
  m.nav = vi.fn(to => {
    const [path, query] = String(to).split('?')
    if (path === '/progress/strength') m.go(query ? '?' + query : '')
  })
  return m
})
vi.mock('../../../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('react-router-dom', async () => {
  const { useSyncExternalStore } = await import('react')
  const subscribe = f => { mocks.listeners.add(f); return () => mocks.listeners.delete(f) }
  return {
    useNavigate: () => mocks.nav,
    useLocation: () => ({ search: useSyncExternalStore(subscribe, () => mocks.search), pathname: '/progress/strength' }),
  }
})
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn(), isSwitching: () => false, switchTab: vi.fn(), popToRoot: vi.fn() }))
vi.mock('../../../sheets.jsx', () => ({ exerciseDetailSheet: mocks.exerciseDetailSheet, workoutDetailSheet: mocks.workoutDetailSheet }))
vi.mock('../../../components/ui.jsx', async importOriginal => ({ ...(await importOriginal()), selectSheet: mocks.selectSheet }))
// The kit's line, recorded by its props: the one line, its marks, or the per-set series.
vi.mock('../../../ds/LineChart.jsx', () => ({ default: props => { mocks.charts.push(props); return null } }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const BENCH = '0025'
const SQUAT = '0043'
const DEADLIFT = '0032'
const BIKE = '2138'
const DAY = 86400000
// A bench session `ago` days back, two working sets at weight w.
const session = (ago, w, extra = {}) => {
  const start = Date.now() - ago * DAY
  return {
    id: 'w' + ago, d: new Date(start).toISOString().slice(0, 10), start, end: start + 3600000, name: 'Push',
    entries: [{ id: BENCH, target: { id: BENCH, sets: 2, reps: 5 }, sets: [{ w, r: 5, done: true }, { w, r: 4, done: true, ...extra }] }],
  }
}
const cardio = (d, speeds) => ({
  id: d, d, start: Date.parse(d + 'T10:00:00Z'), end: Date.parse(d + 'T10:40:00Z'), name: 'Cardio',
  entries: [{ id: BIKE, target: { id: BIKE, sets: speeds.length, min: 20, speed: 8 }, sets: speeds.map(speed => ({ min: 20, speed, done: true })) }],
})
const SPREAD = () => [session(400, 100), session(200, 90), session(60, 70), session(10, 75), session(3, 80)]

let root, host
afterEach(() => {
  act(() => root.unmount()); host.remove()
  mocks.charts = []; mocks.search = ''
  for (const key of ['nav', 'selectSheet', 'exerciseDetailSheet', 'workoutDetailSheet']) mocks[key].mockClear()
})

function mount(workouts, settings = {}) {
  mocks.S = { body: 'male', effort: 'none', unit: 'kg', targetW: null, bodyweight: [], routines: [], exWeights: {}, ...settings, workouts }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<ExerciseProgress />))
}
// The exercise chart is the last one drawn.
const exChart = () => mocks.charts.at(-1)
const group = label => host.querySelector(`[role="radiogroup"][aria-label="${label}"]`)
const press = label => act(() => [...host.querySelectorAll('[role="radio"]')].find(b => b.textContent === label).click())
const on = label => [...group(label).querySelectorAll('[role="radio"][aria-checked="true"]')].map(b => b.textContent)
const labels = name => [...group(name).querySelectorAll('[role="radio"]')].map(b => b.textContent)
const title = () => host.querySelector('.g-snav-title')?.textContent
const hero = () => ({ big: host.querySelector('.g-xp-big')?.textContent, line: host.querySelector('.g-xp-line')?.textContent })
const tiles = () => [...host.querySelectorAll('.g-stat')].map(s => [...s.children].map(c => c.textContent))
const rowsOf = heading => {
  const at = [...host.querySelectorAll('.g-ssec h2')].find(h => h.textContent === heading)
  return at ? [...at.closest('.g-ssec').nextElementSibling.querySelectorAll('.g-grow')] : []
}

describe('Progress: the hero, the metric and the date range', () => {
  it('leads with the estimated 1RM when the exercise has one, and the top set when it does not', () => {
    mount(SPREAD())
    expect(on('Chart')).toEqual(['1RM'])
    expect(hero().line).toContain('Best estimated 1RM')
    expect(parseFloat(hero().big)).toBeGreaterThan(100)
    act(() => root.unmount()); host.remove()
    mount([cardio('2026-09-01', [8, 9.66]), cardio('2026-09-08', [16.09])])
    expect(group('Chart')).toBeNull()
    expect(hero().line).toContain('Top speed')
  })

  it('starts on All and cuts the top-set line to the picked range, the best staying all-time', () => {
    mount(SPREAD())
    expect(on('Range')).toEqual(['All'])
    press('Top')
    expect(exChart().values).toEqual([100, 90, 70, 75, 80])

    press('1M')
    expect(exChart().values).toEqual([75, 80])
    press('3M')
    expect(exChart().values).toEqual([70, 75, 80])
    expect(hero().big).toBe('100 kg')
    expect(hero().line).toContain('Best set')
  })

  it('starts on the ?range= of the address', () => {
    mocks.search = '?range=30'
    mount(SPREAD())
    expect(on('Range')).toEqual(['1M'])
    press('Top')
    expect(exChart().values).toEqual([75, 80])
  })

  it('applies to the other chart modes too', () => {
    mount(SPREAD())
    const all = exChart().values.length
    press('1M')
    expect(all).toBe(5)
    expect(exChart().values).toHaveLength(2)
    press('Per set')
    const chart = exChart()
    expect(chart.values).toHaveLength(2)
    expect(chart.series.length).toBeGreaterThan(1)
    expect(chart.series.every(s => s.values.filter(v => v != null).length === 2)).toBe(true)
  })

  it('writes a picked range to the address with replace, keeping ex', () => {
    mocks.search = '?ex=' + BENCH
    mount(SPREAD())
    press('1M')
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?ex=' + BENCH + '&range=30', { replace: true })
    press('All')
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?ex=' + BENCH + '&range=0', { replace: true })
  })
})

describe('Progress: the hero line says what the window did', () => {
  const rise = () => [session(80, 70), session(40, 72), session(5, 76)]

  it('up 6 kg in 3 months for the top set', () => {
    mocks.search = '?range=90'
    mount(rise())
    press('Top')
    expect(hero().line).toBe('Best set · up 6 kg in 3 months')
  })

  it('down, when the window fell', () => {
    mocks.search = '?range=90'
    mount([session(80, 76), session(5, 70)])
    press('Top')
    expect(hero().line).toBe('Best set · down 6 kg in 3 months')
  })

  it('says since the first month on All, from the line itself', () => {
    mount(SPREAD())
    press('Top')
    expect(hero().line).toBe('Best set · down 20 kg since ' + fmtMonth(session(400, 100).d, true, { yearIfOld: true }))
    // more than a year back, so the month carries its year
    expect(hero().line).toMatch(/\d{4}$/)
  })

  it('is left out with fewer than two points in the window, and when nothing moved', () => {
    mount([session(5, 80)])
    expect(hero().line).toBe('Best set')
    act(() => root.unmount()); host.remove()
    mocks.search = '?range=90'
    mount([session(80, 80), session(5, 80)])
    press('Top')
    expect(hero().line).toBe('Best set')
  })
})

describe('Progress: fewer than two sessions', () => {
  it('says to log it twice instead of drawing a line', () => {
    mount([session(5, 80)])
    expect(host.textContent).toContain('Log it twice to see a trend.')
    expect(mocks.charts).toHaveLength(0)
  })

  it('shows a hint instead of the chart when the range holds fewer than two workouts', () => {
    mount([session(400, 100), session(200, 90), session(5, 80)])
    press('Top')
    press('1M')
    expect(host.textContent).toContain('Fewer than two workouts in this period. Pick a longer one.')
    expect(host.textContent).not.toContain('Log it twice')
    mocks.charts = []
    press('1Y')
    expect(host.textContent).not.toContain('Fewer than two workouts')
    expect(exChart().values).toEqual([90, 80])
  })
})

describe('Progress: chart name and short segment labels', () => {
  afterEach(() => _setLangState('en', {}, null, null))

  it('names the chart with what it plots, and gives it the readouts', () => {
    mount(SPREAD())
    press('Top')
    expect(exChart().label).toBe('Best set weight per workout')
    expect(exChart().unit).toBe('kg')
    expect(exChart().pointLabels).toHaveLength(5)
    expect(exChart().pointLabels.at(-1)).toBe(fmtDate(session(3, 80).d, true) + ': 80 kg')
    expect(exChart().labels.length).toBeGreaterThan(1)
    press('1RM')
    expect(exChart().label).toBe('Estimated 1RM per workout')
  })

  it.each([['de', 'Einsatz', 'Je Satz'], ['ru', 'Усилие', 'Подход'], ['pl', 'Wysiłek', 'Seria']])(
    'in %s the segments read short and keep the full words as their names', async (lang, effort, perSet) => {
      const pack = (await import(`../../../locales/${lang}.js`)).default
      _setLangState(lang, pack, null, null)
      const rated = ago => session(ago, 80, { max: true, r: 12, rir: 1 })
      mount([rated(20), rated(10), rated(3)])
      const buttons = [...group(pack['Chart'] ?? 'Chart').querySelectorAll('[role="radio"]')]
      const byValue = label => buttons.find(b => b.textContent === label)
      expect(byValue(effort).getAttribute('aria-label')).toBe(pack['Effort'])
      expect(byValue(perSet).getAttribute('aria-label')).toBe(pack['Per set'])
    })
})

describe('Progress: metric segment and hero', () => {
  it('labels the metrics Top, Per set, 1RM and, with Max sets and effort logged, Max and Effort', () => {
    mount(SPREAD())
    expect(labels('Chart')).toEqual(['Top', 'Per set', '1RM'])
    act(() => root.unmount()); host.remove()
    const rated = ago => session(ago, 80, { max: true, r: 12, rir: 1 })
    mount([rated(20), rated(10), rated(3)])
    expect(labels('Chart')).toEqual(['Top', 'Per set', '1RM', 'Effort', 'Max'])
  })

  it('has no metric switch when there is only one metric', () => {
    mount([cardio('2026-09-01', [8, 9.66]), cardio('2026-09-08', [16.09])])
    expect(group('Chart')).toBeNull()
    expect(group('Range')).toBeTruthy()
  })

  it('reads the top set in the hero on Top, the estimated 1RM on 1RM and the most reps on Max', () => {
    const rated = (ago, w) => session(ago, w, { max: true, r: 12, rir: 1 })
    mount([rated(20, 80), rated(10, 85), rated(3, 90)])
    press('Top')
    expect(hero().big).toBe('90 kg')
    expect(hero().line).toContain('Best set')

    press('1RM')
    expect(hero().line).toContain('Best estimated 1RM')
    expect(hero().big).toMatch(/ kg$/)
    expect(parseFloat(hero().big)).toBeGreaterThan(90)
    expect(host.textContent).toContain('An estimate, not a tested max.')

    press('Max')
    expect(hero().big).toBe('12 reps')
    expect(hero().line).toContain('Most reps in a Max set')
    expect(host.textContent).toContain('Most reps in a Max set per workout')
  })

  it('draws the per-set lines as series of the kit chart, with the key and a readout per session', () => {
    mount(SPREAD())
    press('Per set')
    expect(on('Chart')).toEqual(['Per set'])
    expect(host.querySelectorAll('.g-xp-keys .set-key').length).toBeGreaterThan(0)
    expect(exChart().label).toContain('one line per set number')
    expect(exChart().series[0].color).toBe('var(--blue)')
    expect(exChart().series[0].values).toHaveLength(5)
    expect(exChart().pointLabels).toHaveLength(5)
    expect(exChart().marks).toBeUndefined()
  })

  it('carries the effort of each top set as a mark on the line, and says what a fuller dot means', () => {
    const rated = ago => session(ago, 80, { max: true, r: 12, rir: 1 })
    mount([rated(20), rated(10), rated(3)])
    press('Top')
    expect(exChart().marks).toHaveLength(3)
    expect(exChart().marks.some(m => m != null)).toBe(true)
    expect(host.textContent).toContain('A fuller dot means less left in the tank.')
    press('1RM')
    expect(exChart().marks).toBeUndefined()
    expect(host.textContent).not.toContain('A fuller dot')
  })
})

describe('Progress: cardio speed', () => {
  const rides = [cardio('2026-09-01', [8, 9.66]), cardio('2026-09-08', [16.09])]

  it('charts and names the best speed in mph for a pound profile', () => {
    mount(rides, { unit: 'lb' })
    expect(exChart().unit).toBe('mph')
    expect(exChart().values).toEqual([6, 10])
    expect(hero().big).toBe('10 mph')
    expect(hero().line).toContain('Top speed')
  })

  it('keeps km/h for a kg profile, and the sets read in the history view', () => {
    mount(rides, { unit: 'kg' })
    expect(exChart().unit).toBe('km/h')
    expect(exChart().values).toEqual([9.66, 16.09])
    expect(hero().big).toBe('16.1 km/h')
    act(() => root.unmount()); host.remove()
    mocks.search = '?view=sets'
    mount(rides, { unit: 'lb' })
    expect(host.textContent).toContain('20 min @ 10 mph')
  })

  it('offers no calculator and no volume tile for cardio', () => {
    mount(rides)
    expect(host.querySelector('.g-xp-light')).toBeNull()
    expect(tiles().map(t => t[0])).toEqual(['Best set', 'Sessions'])
  })
})

describe('Progress: ?ex= deep link', () => {
  const both = () => [session(5, 80), { ...session(2, 120), entries: [{ id: SQUAT, sets: [{ w: 120, r: 5, done: true }] }] }]

  it('opens on the exercise in the address', () => {
    mocks.search = '?ex=' + BENCH
    mount(both())
    expect(title()).toBe('Barbell Bench Press')
    press('Top')
    expect(hero().big).toBe('80 kg')
  })

  it('opens on the heaviest exercise without ?ex=', () => {
    mount(both())
    expect(title()).toBe('Barbell Full Squat')
    press('Top')
    expect(hero().big).toBe('120 kg')
    expect(host.textContent).not.toContain('No sets logged')
  })

  it('stays on a catalogue exercise with no sessions and says so instead of charting another', () => {
    mocks.search = '?ex=' + DEADLIFT
    mount(both())
    expect(title()).toBe('Barbell Deadlift')
    const empty = host.querySelector('.g-sempty')
    expect(empty.textContent).toContain('No sets logged yet')
    expect(empty.textContent).not.toContain('Deadlift')
    expect(empty.textContent).toContain('Log it in a workout and its curve shows up here.')
    expect(host.textContent).not.toContain('Barbell Full Squat')
    expect(host.querySelector('.g-xp-big')).toBeNull()
    expect(group('Range')).toBeNull()
    expect(group('Chart')).toBeNull()
  })

  it('shows the same empty state for an id that is not in the catalogue, without printing the raw id', () => {
    mocks.search = '?ex=not-a-lift'
    mount(both())
    expect(title()).toBe('Unknown exercise')
    expect(host.querySelector('.g-sempty').textContent).toContain('No sets logged yet')
    expect(host.textContent).not.toContain('not-a-lift')
    expect(host.querySelector('.g-xp-big')).toBeNull()
  })

  it('says No sessions logged yet in the History view of an exercise with none', () => {
    mocks.search = '?ex=' + DEADLIFT + '&view=sets'
    mount(both())
    expect(on('Exercise views')).toEqual(['History'])
    expect(host.textContent).toContain('No sessions logged yet')
    expect(host.querySelector('.g-ps-card')).toBeNull()
  })

  it('offers How to on a catalogue exercise, and nothing on an unknown id', () => {
    mocks.search = '?ex=' + DEADLIFT
    mount(both())
    act(() => host.querySelector('button[aria-label="How to"]').click())
    expect(mocks.exerciseDetailSheet).toHaveBeenCalledWith(expect.objectContaining({ id: DEADLIFT }))
    act(() => root.unmount()); host.remove()
    mocks.search = '?ex=not-a-lift'
    mount(both())
    expect(host.querySelector('button[aria-label="How to"]')).toBeNull()
  })

  it('shows No lifts yet with no workouts, whatever ?ex= says', () => {
    mocks.search = '?ex=' + DEADLIFT
    mount([])
    expect(host.textContent).toContain('No lifts yet')
    expect(host.textContent).not.toContain('No sets logged yet')
  })

  it('keeps the picker on an unlogged exercise and switches to a logged one', () => {
    mocks.search = '?ex=' + DEADLIFT
    mount(both())
    act(() => host.querySelector('.g-xp-pick').click())
    expect(mocks.selectSheet).toHaveBeenCalledTimes(1)
    const { options, onChange } = mocks.selectSheet.mock.calls[0][0]
    expect(options.map(o => o.value).sort()).toEqual([BENCH, SQUAT])
    act(() => onChange(BENCH))
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?ex=' + BENCH, { replace: true })
    expect(title()).toBe('Barbell Bench Press')
    expect(host.querySelector('.g-sempty')).toBeNull()
    press('Top')
    expect(hero().big).toBe('80 kg')
  })
})

describe('Progress: tiles, new bests, calculator and structural balance', () => {
  // Records at 75 and 80; the 72 in between is not one.
  const climb = () => [session(60, 70), session(40, 75), session(20, 72), session(5, 80)]

  it('draws the best set, the sessions since the first month and the last workout\'s volume', () => {
    mount(climb())
    expect(tiles()).toEqual([
      ['Best set', '80 kg', '× 5 · ' + fmtDate(session(5, 80).d, true)],
      ['Sessions', '4', 'since ' + fmtMonth(session(60, 70).d, true)],
      ['Volume', '720 kg', 'last workout'],
    ])
  })

  it('lists the sessions that beat the best before them, newest first, and a tap opens the History view', () => {
    mount(climb())
    const rows = rowsOf('New bests')
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['80×5', '75×5'])
    expect(rows[0].textContent).toContain('est. 1RM')
    act(() => rows[0].click())
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?view=sets', { replace: true })
    expect(on('Exercise views')).toEqual(['History'])
    expect(host.querySelector('.g-ps')).toBeTruthy()
  })

  it('has no New bests before anything was beaten', () => {
    mount([session(10, 80), session(5, 75)])
    expect(rowsOf('New bests')).toEqual([])
  })

  it('places the estimated 1RM calculator under the bests, for a loaded exercise', () => {
    mount(climb())
    expect(host.querySelector('.g-xp-light')?.textContent).toContain('Estimated 1RM')
  })

  it('opens Structural balance from its row', () => {
    mount(SPREAD())
    const row = [...host.querySelectorAll('.g-grow')].find(r => r.textContent.includes('Structural balance'))
    act(() => row.click())
    expect(mocks.nav).toHaveBeenCalledWith('/progress/strength/balance')
  })
})

describe('Past sets: ?view=sets', () => {
  it('opens on the History view, every session newest first, and a card opens its workout', () => {
    mocks.search = '?view=sets'
    const workouts = [session(400, 100), session(300, 95), ...SPREAD()]
    mount(workouts)
    expect(on('Exercise views')).toEqual(['History'])
    expect(host.querySelector('.g-xp-hero')).toBeNull()
    expect(group('Range')).toBeNull()
    const cards = [...host.querySelectorAll('.g-ps-card')]
    expect(cards).toHaveLength(7)
    expect([...cards[0].querySelectorAll('.g-ps-sets b')].map(b => b.textContent)).toEqual(['80×5', '80×4'])
    expect(cards[0].querySelector('.g-ps-head b').textContent).not.toBe(cards[1].querySelector('.g-ps-head b').textContent)
    expect(cards[0].textContent).toContain('Push')

    act(() => cards[1].click())
    expect(mocks.workoutDetailSheet).toHaveBeenCalledWith(workouts.find(w => w.id === 'w10'))
  })

  it('switches views with replace, and drops view= when going back to Progress', () => {
    mocks.search = '?ex=' + BENCH
    mount(SPREAD())
    press('History')
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?ex=' + BENCH + '&view=sets', { replace: true })
    expect(host.querySelector('.g-ps')).toBeTruthy()
    press('Progress')
    expect(mocks.nav).toHaveBeenLastCalledWith('/progress/strength?ex=' + BENCH, { replace: true })
    expect(host.querySelector('.g-xp-hero')).toBeTruthy()
  })

  it('keeps the exercise picker and How to on the History view', () => {
    mocks.search = '?view=sets'
    mount(SPREAD())
    act(() => host.querySelector('.g-xp-pick').click())
    expect(mocks.selectSheet).toHaveBeenCalledTimes(1)
    act(() => host.querySelector('button[aria-label="How to"]').click())
    expect(mocks.exerciseDetailSheet).toHaveBeenCalledWith(expect.objectContaining({ id: BENCH }))
  })
})

describe('Progress: no history', () => {
  it('says there are no lifts yet and offers nothing else', () => {
    mount([])
    expect(host.textContent).toContain('No lifts yet')
    expect(group('Range')).toBeNull()
    expect(group('Exercise views')).toBeNull()
    expect(host.querySelector('button[aria-label="How to"]')).toBeNull()
    expect(host.textContent).not.toContain('Structural balance')
  })
})

// Train review fixes (group 3): records, the 1RM, the address and the hero's wording.
const ASSISTED = '0017' // assisted pull-up, a leverage machine
const PULLUP = '0652' // pull-up, body weight
// A session of `id` `ago` days back with the given work sets.
const of = (id, ago, sets, extra = {}) => {
  const start = Date.now() - ago * DAY
  return {
    id: id + '-' + ago, d: new Date(start).toISOString().slice(0, 10), start, end: start + 3600000, name: 'Pull',
    entries: [{ id, target: { id, sets: sets.length, reps: 8 }, sets: sets.map(([w, r]) => ({ w, r, done: true })), ...extra }],
  }
}

describe('Progress: a legacy record that kept only its top weight', () => {
  // Two sessions logged before sets were kept: 60, then 70, which is a new best with no set to name.
  const legacy = () => [
    { ...of(BENCH, 20, []), entries: [{ id: BENCH, target: { id: BENCH, mode: 'reps' }, sets: [], topW: 60 }] },
    { ...of(BENCH, 5, []), entries: [{ id: BENCH, target: { id: BENCH, mode: 'reps' }, sets: [], topW: 70 }] },
  ]

  it('renders Progress, naming the record by its top set', () => {
    mount(legacy())
    expect(hero().big).toBe('70 kg')
    expect(rowsOf('New bests').map(r => r.querySelector('b').textContent)).toEqual(['Top set 70 kg'])
  })

  it('marks the top-set line New best in the History view', () => {
    mocks.search = '?view=sets'
    mount(legacy())
    const tail = host.querySelector('.g-ps-card .g-ps-tail')
    expect(tail.textContent).toBe('Top set 70 kg New best')
    expect(tail.querySelector('.g-ps-pr')).toBeTruthy()
  })
})

describe('Progress: follows the address while mounted', () => {
  const both = () => [...SPREAD(), { ...session(2, 120), id: 'sq', entries: [{ id: SQUAT, sets: [{ w: 120, r: 5, done: true }] }] }]

  it('switches to History, back to Progress and to another exercise when the address changes', () => {
    mocks.search = '?ex=' + BENCH
    mount(both())
    expect(host.querySelector('.g-xp-hero')).toBeTruthy()
    act(() => mocks.go('?ex=' + BENCH + '&view=sets'))
    expect(on('Exercise views')).toEqual(['History'])
    expect(host.querySelector('.g-ps')).toBeTruthy()
    act(() => mocks.go('?ex=' + BENCH))
    expect(host.querySelector('.g-xp-hero')).toBeTruthy()
    act(() => mocks.go('?ex=' + SQUAT))
    expect(title()).toBe('Barbell Full Squat')
    act(() => mocks.go('?ex=' + BENCH + '&range=30'))
    expect(title()).toBe('Barbell Bench Press')
    expect(on('Range')).toEqual(['1M'])
  })

  it('opens another exercise on its own default chart, not the one picked on the last', () => {
    mocks.search = '?ex=' + BENCH
    mount(both())
    press('Top')
    expect(on('Chart')).toEqual(['Top'])
    act(() => mocks.go('?ex=' + SQUAT))
    act(() => mocks.go('?ex=' + BENCH))
    expect(on('Chart')).toEqual(['1RM'])
  })
})

describe('Progress: the default chart needs two estimates', () => {
  // Sets past the estimate's rep cap have no 1RM: only the last session has one.
  const highReps = () => [of(BENCH, 30, [[50, 15]]), of(BENCH, 20, [[50, 15]]), of(BENCH, 10, [[55, 8]])]

  it('opens on Top when only one session has an estimated 1RM', () => {
    mount(highReps())
    expect(on('Chart')).toEqual(['Top'])
    expect(exChart().values).toEqual([50, 50, 55])
    expect(host.textContent).not.toContain('Log it twice')
  })

  it('says why 1RM is short, and where the line is, when 1RM is picked', () => {
    mount(highReps())
    press('1RM')
    expect(host.textContent).toContain('Fewer than two estimated 1RMs. Pick Top to see every workout.')
    expect(host.textContent).not.toContain('Log it twice')
  })
})

describe('Progress: bodyweight lifts have no 1RM', () => {
  it('offers no 1RM for a belt-loaded pull-up, and reads the best set as the belt with its unit', () => {
    mount([of(PULLUP, 20, [[5, 8], [5, 8]]), of(PULLUP, 5, [[10, 8], [10, 6]])])
    expect(labels('Chart')).not.toContain('1RM')
    expect(hero().line).toContain('Best set')
    expect(host.textContent).not.toContain('est. 1RM')
    expect(tiles()[0]).toEqual(['Best set', '+10 kg', '× 8 · ' + fmtDate(of(PULLUP, 5, []).d, true)])
  })

  it('reads an unloaded best set as its reps, with "reps" under it', () => {
    mount([of(PULLUP, 20, [[0, 10]]), of(PULLUP, 5, [[0, 12]])])
    expect(tiles()[0]).toEqual(['Best set', '12', 'reps · ' + fmtDate(of(PULLUP, 5, []).d, true)])
  })
})

describe('Progress: assistance machines', () => {
  it('says more help, not up, when the help went up, and less help when it went down', () => {
    mocks.search = '?range=90'
    mount([of(ASSISTED, 80, [[30, 8]]), of(ASSISTED, 5, [[40, 8]])])
    expect(hero().line).toBe('Best set · 10 kg more help in 3 months')
    act(() => root.unmount()); host.remove()
    mount([of(ASSISTED, 80, [[40, 8]]), of(ASSISTED, 5, [[30, 8]])])
    expect(hero().line).toBe('Best set · 10 kg less help in 3 months')
  })

  it('lists the session that needed least help as the new best', () => {
    mount([of(ASSISTED, 30, [[30, 8]]), of(ASSISTED, 20, [[40, 8]]), of(ASSISTED, 10, [[20, 8]])])
    expect(rowsOf('New bests').map(r => r.querySelector('b').textContent)).toEqual(['20×8'])
  })
})

describe('Progress: the per-set chart', () => {
  it('labels each point by set, with the unit', () => {
    mount(SPREAD())
    press('Per set')
    expect(exChart().pointLabels.at(-1)).toBe(fmtDate(session(3, 80).d, true) + ' · Set 1: 80 kg × 5 · Set 2: 80 kg × 4')
  })

  it('anchors the hover on the highest drawn set, not on a set past the five drawn', () => {
    const six = ago => of(BENCH, ago, [[80, 5], [80, 5], [80, 5], [80, 5], [80, 5], [120, 5]])
    mount([six(10), six(3)])
    press('Per set')
    expect(exChart().values).toEqual([estimate1RM(80, 5), estimate1RM(80, 5)])
    expect(exChart().pointLabels[0]).not.toContain('Set 6')
  })
})
