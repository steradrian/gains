// @vitest-environment happy-dom
// Today (PR-01, views/today/) and the + sheet's logging rows, against NutriTrace faked
// at the fetch boundary (lib/nutrition/fake-nutritrace.js: NutriTrace's real shapes, merge and
// the hub's rules). The diary itself is Nutrition's (FoodHub.diary.test.jsx).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO, isoOf } from '../lib/format.js'
import { dateLocale } from '../lib/i18n.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { __test as diaryIndex, useDiaryIndex } from '../lib/nutrition/diary-index.js'
import { useHubSync, resetSyncThrottle } from '../lib/nutrition/sync.js'
import { closeSearch, useSearch } from '../lib/search/session.js'
import { createFakeNutriTrace, emptyDay, fixtureActivity, fixtureActivitySum, fixtureDay, fixtureFoods, fixtureSettings, fixtureSyncStatus } from '../lib/nutrition/fake-nutritrace.js'
import { workoutKcalMessage, reportWorkoutKcal } from '../lib/nutrition/workout-kcal.js'
import Home from './Home.jsx'
import DayNav from '../components/DayNav.jsx'
import PortionSheet from '../components/PortionSheet.jsx'
import QuickKcalSheet from '../components/QuickKcalSheet.jsx'
import RootHeader from '../components/RootHeader.jsx'
import { openPlusSheet } from '../components/PlusSheet.jsx'
import { bwSheet, calendarSheet } from '../sheets.jsx'
import { weighInTime } from '../lib/bodyweight.js'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useLocation: () => ({ pathname: '/home' }) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
const shiftDay = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoOf(d) }
const yesterday = shiftDay(-1)
const tomorrow = shiftDay(1)
// The week starts where yesterday falls in today's week, whichever weekday today is.
const WEEK_START = new Date().getDay() === 1 ? 0 : 1
let nt, host, root

// The sheets useUI opens, rendered where the test can reach them.
function Sheets() {
  const sheets = useUI(s => s.sheets)
  // a drawer's sub-panels are drawn as sheets of their own here
  return sheets.flatMap(s => [s, ...(s.panels || [])]).map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
const mount = async el => { await act(async () => { root.render(<>{el}<Sheets /></>) }); await settle() }
const settle = async (ms = 0) => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const text = () => host.textContent
const button = (label, scope = host) => [...scope.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const click = async el => { await act(async () => { el.click() }); await settle() }
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)
const puts = () => nt.writes().filter(r => r.method === 'PUT')
const typeInto = async (input, value) => {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}
// Today's parts.
const slides = () => [...host.querySelectorAll('.g-rc-slide')]
const ring = i => {
  const s = slides()[i]
  return { top: [...s.querySelectorAll('.g-sring-top')].map(e => e.textContent), big: s.querySelector('.g-sring-in b').textContent, pill: s.querySelector('.g-rc-pill')?.textContent ?? null }
}
const actions = () => [...host.querySelectorAll('.g-gact')].map(b => b.textContent)
const action = label => [...host.querySelectorAll('.g-gact')].find(b => b.textContent === label)
const tiles = () => [...host.querySelectorAll('.g-tile')].map(b => [b.querySelector('b').textContent, b.querySelector('.g-tile-body > span').textContent])
const tile = name => [...host.querySelectorAll('.g-tile')].find(b => b.querySelector('b').textContent === name)
const sections = () => [...host.querySelectorAll('.g-ssec')].map(s => s.textContent)
// The Nutrition drawer (T1.3).
const ndTab = () => [...lastSheet().querySelectorAll('.g-seg button')].find(b => b.getAttribute('aria-pressed') === 'true').textContent
const ndTotal = () => ['.g-nd-num', '.g-nd-of', '.g-nd-left'].map(c => lastSheet().querySelector(c)?.textContent ?? null)
const ndRows = () => [...lastSheet().querySelectorAll('.g-nd-row')].map(r => [r.querySelector('.g-nd-name').textContent, r.querySelector('.g-nd-sub').textContent,
  r.querySelector('.g-nd-pct')?.textContent ?? r.querySelector('.g-nd-add')?.getAttribute('aria-label') ?? null])
const diaryReads = iso => nt.requests.filter(r => r.path === `/nt/api/diary/${iso}`).length
// A day on the week strip, by its name (WeekStrip's aria-label leads with the date).
const day = iso => host.querySelector(`.wk-d[aria-label^="${new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}"]`)

function useFake(opts = {}) {
  nt = createFakeNutriTrace({
    days: { [TODAY]: fixtureDay(TODAY) },
    activity: { [TODAY]: fixtureActivity(TODAY) },
    activitySum: { [TODAY]: fixtureActivitySum(TODAY) },
    ...opts,
  })
  vi.stubGlobal('fetch', nt.fetch)
}

beforeEach(() => {
  useFake()
  navigate.mockClear()
  localStorage.clear()
  useStore.setState(s => ({
    user: { id: 3, name: 'Ana' },
    pushState: vi.fn(async () => {}),
    S: { ...s.S, routines: [], workouts: [], bodyweight: [{ d: yesterday, w: 80.4, t: 1 }], dayPlan: {}, week: {}, active: null, checkIn: false, unit: 'kg', weekStart: WEEK_START },
  }))
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useHubSync.getState().reset()
  diaryIndex.restore()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  resetSyncThrottle()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('Today', () => {
  it('the rings say how the day is going: energy left with what was eaten, then protein, carbs and fat left', async () => {
    await mount(<Home />)
    // 2200 target − (228 oats + 450 quick) eaten
    expect(slides().map(s => s.getAttribute('aria-label'))).toEqual([
      'Calories: Left today 1,522 of 2,200 kcal, 190 burned · 678 eaten. Open details',
      'Protein: Protein left 152 g of 160 g, 8 g eaten. Open details',
      'Carbs: Carbs left 129 g of 165 g, 36 g eaten. Open details',
      'Fat: Fat left 66 g of 70 g, 4 g eaten. Open details',
    ])
    expect(ring(0)).toEqual({ top: ['Left today', 'of 2,200 kcal'], big: '1,522', pill: expect.stringMatching(/678 eaten$/) })
    expect(ring(1)).toEqual({ top: ['Protein left', 'g of 160 g'], big: '152', pill: '8 g eaten' })
    // The day's detail is the Nutrition drawer (T1.3): a ring opens it on its own tab.
    expect(host.querySelector('.kcal-card')).toBeNull()
    await click(slides()[1])
    expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Nutrition today')
    expect(ndTab()).toBe('Protein')
    expect(ndTotal()).toEqual(['8', 'of 160 g eaten', '152 left'])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('over the target the energy ring closes, and an amber arc and the number say how far over', async () => {
    nt.state.days[TODAY].items.push({ uuid: 'big', meal: 2, addedAt: `${TODAY}T19:00:00.000Z`, type: 'quick_calories', name: 'Quick Calories', nutrition: { calories: 2000 } , food_server_id: null })
    await mount(<Home />)
    expect(ring(0)).toMatchObject({ top: ['Over today', 'kcal over 2,200'], big: '478', pill: expect.stringMatching(/2,678 eaten$/) })
    expect(slides()[0].querySelector('.g-sring-over')).toBeTruthy()
  })

  it('a day that does not load says so and retries, never showing numbers it does not have', async () => {
    nt.failNext('GET', `/nt/api/diary/${TODAY}`, 'offline')
    await mount(<Home />)
    expect(host.querySelector('[role="alert"]').textContent).toContain('The diary did not load: no connection.')
    expect(host.querySelector('.g-rcb[aria-busy="true"]')).toBeTruthy()
    expect(host.querySelector('.g-sring-in b')).toBeNull()
    // Nothing below the rings reads as an empty day: no water amount, no meal tiles, no dead +.
    expect(sections()).toEqual([])
    expect(host.querySelector('.g-tile, .g-water')).toBeNull()
    expect(actions()).toEqual([])
    await click(button('Try again'))
    expect(ring(0).big).toBe('1,522')
    expect(sections()).toContain('Water250 of 2,500 ml')
  })

  it('past midnight with the app still open, food and water both log to the day on screen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T23:59:00`))
    try {
      await mount(<Home />)
      vi.setSystemTime(new Date(`${tomorrow}T00:01:00`))
      await click(action('Log food'))
      expect(useDiarySelection.getState().day()).toBe(TODAY)
      await act(async () => { useUI.getState().closeAll() })
      await settle()
      await click(tile('Snacks'))
      expect(useDiarySelection.getState().day()).toBe(TODAY)
      await act(async () => { useUI.getState().closeAll() })
      await settle()
      await click(action('Water'))
      expect(puts().at(-1).path).toBe(`/nt/api/diary/${TODAY}`)
    } finally { vi.useRealTimers() }
  })

  it('a first day waits for the diary index before it is one: no Up next, no First steps until then', async () => {
    useFake({ days: { [TODAY]: emptyDay(TODAY) } })
    useStore.setState(s => ({ S: { ...s.S, bodyweight: [] } }))
    // A saved copy says complete, but this session has not synced it yet: it may be behind.
    useDiaryIndex.setState({ complete: true, synced: false })
    await mount(<Home />)
    expect(host.querySelector('.today .today-sk-row')).toBeTruthy()
    expect(host.querySelector('.g-grow, .g-fstep')).toBeNull()
    expect(tiles().map(t => t[0])).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks'])
    await act(async () => { useDiaryIndex.setState({ synced: true }) })
    expect(host.querySelector('.today-sk-row')).toBeNull()
    expect(sections()[0]).toBe('First steps1 of 4')
  })

  it('the four actions: Log food, Scan, Water and Weigh-in, each the flow the app already runs', async () => {
    // Gym check-in stays on Training: it is not one of Today's four.
    useStore.setState(s => ({ S: { ...s.S, checkIn: true } }))
    await mount(<Home />)
    expect(actions()).toEqual(['Log food', 'Scan', 'Water', 'Weigh-in'])
    await click(action('Scan'))
    expect(lastSheet().querySelector('.scan-sheet h3').textContent).toBe('Scan a barcode')
    await act(async () => { useUI.setState({ sheets: [] }) })
    await click(action('Weigh-in'))
    await click(button('Save weigh-in', lastSheet()))
    expect(useStore.getState().S.bodyweight.find(b => b.d === TODAY)).toBeTruthy()
    expect(useUI.getState().toastMsg).toBe('Saved 80.4 kg to Today')
    expect(useUI.getState().toastAction).toBeTruthy()
  })

  it('Water logs a glass to today with Undo, and so does the + after the glasses', async () => {
    await mount(<Home />)
    expect(sections()).toContain('Water250 of 2,500 ml')
    expect(host.querySelectorAll('.g-water-g i.on')).toHaveLength(1)
    await click(action('Water'))
    expect(puts()).toHaveLength(1)
    expect(puts()[0].body.water.map(w => w.amount)).toEqual([250, 250])
    expect(sections()).toContain('Water500 of 2,500 ml')
    expect(host.querySelectorAll('.g-water-g i.on')).toHaveLength(2)
    expect(useUI.getState().toastMsg).toBe('Added 250 ml of water to Today')
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    expect(sections()).toContain('Water250 of 2,500 ml')
    // Spoken in the person's water unit, as the Nutrition tab's quick-adds are.
    expect(host.querySelector('.g-water').getAttribute('aria-label')).toBe('Water, 250 ml of 2,500 ml')
    await click(button('Add a glass of water, 250 ml'))
    expect(puts().at(-1).body.water.map(w => w.amount)).toEqual([250, 250])
  })

  it('Log food opens the picker for today and the meal of the hour, though Nutrition had an earlier day picked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:10:00`))
    try {
      useDiarySelection.getState().setDate(yesterday)
      await mount(<Home />)
      await click(action('Log food'))
      expect(lastSheet().querySelector('.g-bs .g-bs-chip').textContent).toBe('Today · Lunch')
      expect(useDiarySelection.getState().day()).toBe(TODAY)
    } finally { vi.useRealTimers() }
  })

  it('the meals as tiles: logged with their energy, the meal of the hour to add now, the rest empty', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T19:10:00`))
    try {
      await mount(<Home />)
      expect(tiles()).toEqual([['Breakfast', '228 kcal'], ['Lunch', '450 kcal'], ['Dinner', 'Add now'], ['Snacks', 'Nothing yet']])
      expect(tile('Breakfast').querySelector('[aria-label="Logged"]')).toBeTruthy()
      expect(tile('Dinner').classList.contains('g-tile-now')).toBe(true)
      // A logged meal opens the day (T1.3); an empty one logs to that meal (T1.4).
      await click(tile('Breakfast'))
      expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Nutrition today')
      useUI.getState().closeAll()
      await settle()
      await click(tile('Snacks'))
      expect(lastSheet().querySelector('.g-bs-chip').textContent).toBe('Today · Snacks')
    } finally { vi.useRealTimers() }
  })

  it('See day opens the day in the Nutrition drawer: the total against the target, the meals, what was burned', async () => {
    await mount(<Home />)
    await click(button('See day'))
    expect(navigate).not.toHaveBeenCalled()
    expect(ndTab()).toBe('Calories')
    expect(ndTotal()).toEqual(['678', 'of 2,200 kcal eaten', '1,522 left'])
    expect(ndRows()).toEqual([
      ['Breakfast', '228 kcal', '34%'], ['Lunch', '450 kcal', '66%'],
      ['Dinner', 'Nothing yet', 'Add Dinner'], ['Snacks', 'Nothing yet', 'Add Snacks'],
      ['Burned 190 kcal', 'Not added to your target', null],
    ])
    expect(lastSheet().querySelectorAll('.g-nd-bar > span')).toHaveLength(2)
    await click([...lastSheet().querySelectorAll('.g-seg button')].find(b => b.textContent === 'Fat'))
    expect(ndTab()).toBe('Fat')
    expect(ndRows().map(r => r[0])).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks'])
    // A meal with nothing yet logs to it: the drawer gives way to Log food for that meal.
    await click(button('Add Dinner', lastSheet()))
    expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Log food')
    expect(lastSheet().querySelector('.g-bs-chip').textContent).toBe('Today · Dinner')
  })

  it('the Nutrition drawer with nothing logged: every meal has a +, and the total reads 0 of the target', async () => {
    useFake({ days: { [TODAY]: emptyDay(TODAY) } })
    await mount(<Home />)
    await click(button('See day'))
    for (const tab of ['Calories', 'Protein', 'Carbs', 'Fat']) {
      await click([...lastSheet().querySelectorAll('.g-seg button')].find(b => b.textContent === tab))
      expect(ndTotal()[0]).toBe('0')
      expect(ndRows().slice(0, 4).map(r => r[2])).toEqual(['Add Breakfast', 'Add Lunch', 'Add Dinner', 'Add Snacks'])
      expect(lastSheet().querySelectorAll('.g-nd-bar > span')).toHaveLength(0)
    }
    expect(ndTotal()).toEqual(['0', 'of 70 g eaten', '70 left'])
  })

  it('a first day: every meal empty, the energy ring at the whole target', async () => {
    useFake({ days: { [TODAY]: emptyDay(TODAY) } })
    await mount(<Home />)
    expect(tiles().every(([, sub]) => sub === 'Nothing yet' || sub === 'Add now')).toBe(true)
    expect(ring(0).big).toBe('2,200')
  })

  it('always today: no day picker, and a day picked on another tab is neither shown nor read', async () => {
    useDiarySelection.getState().setDate(yesterday)
    await mount(<Home />)
    expect(host.querySelector('.month-bar-l, .wk-d')).toBeNull()
    expect(ring(0).big).toBe('1,522')
    expect(diaryReads(yesterday)).toBe(0)
    // The other tabs keep their day until Today logs something.
    expect(useDiarySelection.getState().day()).toBe(yesterday)
  })

  it('rolls over to the new day the next time the app comes to the front, not while it is on screen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T23:59:00`))
    try {
      await mount(<Home />)
      vi.setSystemTime(new Date(`${tomorrow}T00:01:00`))
      await settle(10)
      expect(diaryReads(tomorrow)).toBe(0)
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
      await settle()
      expect(diaryReads(tomorrow)).toBeGreaterThan(0)
    } finally { vi.useRealTimers() }
  })

  it('the bell counts the unread notifications in its name and shows the dot; none read, none shown', async () => {
    const at = n => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(18, 0, 0, 0); return d.getTime() }
    const lift = (id, n, w) => ({ id, d: shiftDay(-n), start: at(n), end: at(n) + 3600000, entries: [{ id: '0025', sets: [{ w, r: 1, done: true }] }] })
    useStore.setState(s => ({ S: { ...s.S, workouts: [lift('w1', 10, 90), lift('w2', 3, 96)], notifRead: { at: 0, ids: [] } } }))
    await mount(<Home />)
    const bell = host.querySelector('.g-bell')
    expect(bell.getAttribute('aria-label')).toMatch(/^Notifications, [1-9]\d* unread$/)
    expect(bell.querySelector('.g-sdot')).toBeTruthy()
    await act(async () => { useStore.setState(s => ({ S: { ...s.S, notifRead: { at: Date.now(), ids: [] } } })) })
    expect(bell.getAttribute('aria-label')).toBe('Notifications')
    expect(bell.querySelector('.g-sdot')).toBeNull()
  })

  it('the header: the avatar opens Profile, the bell Notifications, the pill the app\'s search', async () => {
    await mount(<Home />)
    await click(button('Settings'))
    expect(navigate).toHaveBeenCalledWith('/me')
    await click(button('Notifications'))
    expect(navigate).toHaveBeenCalledWith('/home/notifications')
    const field = host.querySelector('.g-spill-field input')
    await act(async () => { field.focus() })
    expect(useSearch.getState()).toMatchObject({ open: true, tab: 'home' })
    // The header stays where it is: its pill is the field, focused, and the bell is the ×.
    expect(host.querySelector('.g-shdr.g-shdr-pin')).toBeTruthy()
    expect(document.activeElement).toBe(field)
    expect(button('Close search')).toBeTruthy()
    await act(async () => { closeSearch() })
    await settle()
    expect(button('Notifications')).toBeTruthy()
  })

  it('the avatar carries the hub sync warning, with its reason in its name', async () => {
    await mount(<Home />)
    expect(host.querySelector('.g-sbtn .g-sdot')).toBeNull()
    await act(async () => { useHubSync.setState({ status: fixtureSyncStatus('needs_confirmation') }) })
    expect(host.querySelector('.g-sbtn .g-sdot')).toBeTruthy()
    expect(button('Settings, Nutrition sync needs attention')).toBeTruthy()
  })

  it('without nutrition (a guest, the phone build): one ring for the week, the week\'s marks, no food', async () => {
    useStore.setState({ user: null })
    await mount(<Home />)
    expect(slides().map(s => s.getAttribute('aria-label'))).toEqual(['Workouts: This week 0 of 0 workouts. Open details'])
    expect(actions()).toEqual(['Start', 'Activity', 'Weigh-in', 'Plan'])
    expect(sections()).toEqual(['Up next', 'This week0 of 0 done'])
    expect(host.querySelectorAll('.g-wk-cell')).toHaveLength(7)
    expect(host.querySelector('.g-tiles, .g-water')).toBeNull()
    expect(nt.requests).toHaveLength(0)
    await click(action('Start'))
    expect(navigate).toHaveBeenCalledWith('/train/workout')
    await click(action('Activity'))
    expect(navigate).toHaveBeenCalledWith('/train/history')
    await click(action('Plan'))
    expect(navigate).toHaveBeenCalledWith('/train/schedule')
    await click(slides()[0])
    expect(navigate).toHaveBeenLastCalledWith('/train')
  })

  // Blocker: nothing is shown or logged for a day that has not happened.
  it('stops at today: no future date, no future log', async () => {
    await mount(<Home />)
    act(() => useDiarySelection.getState().setDate(tomorrow))
    expect(useDiarySelection.getState().day()).toBe(TODAY)
    const before = nt.requests.length
    await expect(useNutrition.getState().logWater(tomorrow, useNutrition.getState().draftWater(250))).rejects.toMatchObject({ code: 'invalid' })
    expect(nt.requests.length).toBe(before)
  })
})

// The day picker Training and Nutrition keep (Today has none, PR-01): one date every tab shares.
describe('the shared day picker', () => {
  it('a day to come is never the date: tapping it opens "change this day" for that day', async () => {
    await mount(<DayNav />)
    // Tomorrow is in this week's strip unless today ends the week; then the week after shows it.
    if (!day(tomorrow)) {
      const days = host.querySelectorAll('.wk-d')
      await act(async () => { days[6].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
      await settle()
    }
    expect(day(tomorrow).disabled).toBe(false)
    await click(day(tomorrow))
    expect(useDiarySelection.getState().day()).toBe(TODAY)
    expect(lastSheet().querySelector('h2').textContent).toBe(fmtDate(tomorrow, true))
    // A screen reader is told which day it opened.
    expect(host.querySelector('[role="status"].sr-only').textContent).toBe('Change this day, ' + fmtDate(tomorrow, true))
  })

  // The month's calendar disables days to come for a date picker; on Home and Training they open
  // "change this day" instead, on Nutrition they stay dimmed.
  const calendarDay = iso => {
    const cell = [...lastSheet().querySelectorAll('.cal-d')].find(b => b.textContent === String(Number(iso.slice(-2))))
    return cell
  }
  const openCalendar = async iso => {
    await click(host.querySelector('.month-bar-l'))
    if (iso.slice(0, 7) !== TODAY.slice(0, 7)) await click(button('Next month', lastSheet()))
  }

  it('a day to come in the calendar opens "change this day" for it and leaves the date, announced', async () => {
    await mount(<DayNav />)
    await openCalendar(tomorrow)
    expect(calendarDay(tomorrow).disabled).toBe(false)
    await click(calendarDay(tomorrow))
    expect(useDiarySelection.getState().day()).toBe(TODAY)
    expect(lastSheet().querySelector('h2').textContent).toBe(fmtDate(tomorrow, true))
    expect(host.querySelector('[role="status"].sr-only').textContent).toBe('Change this day, ' + fmtDate(tomorrow, true))
    // Days up to today still pick the date.
    await act(async () => { useUI.setState({ sheets: [] }) })
    if (yesterday.slice(0, 7) === TODAY.slice(0, 7)) {
      await openCalendar(yesterday)
      await click(calendarDay(yesterday))
      expect(useDiarySelection.getState().day()).toBe(yesterday)
    }
  })

  it('on Nutrition a day to come stays dimmed in the calendar', async () => {
    await mount(<DayNav future="off" />)
    await openCalendar(tomorrow)
    expect(calendarDay(tomorrow).disabled).toBe(true)
    expect(host.querySelector('[role="status"]')).toBeNull()
  })

})

describe('logging a food', () => {
  const bread = () => ({ ...fixtureFoods()[1], imgUrl: '' })

  it('logs the amount to the meal and date it was opened for', async () => {
    await useNutrition.getState().loadSettings()
    await mount(<PortionSheet food={bread()} date={TODAY} meal={2} mealName="Dinner" close={() => {}} />)
    await click(button('slice'))
    await typeInto(host.querySelector('input[aria-label="Serving size"]'), '2')
    expect(host.querySelector('.g-la-big').textContent).toBe('178 kcal')
    await click(button('Add to Dinner'))
    const item = nt.state.days[TODAY].items.at(-1)
    expect(item).toMatchObject({ name: 'Wholemeal bread', meal: 2, portion: 2, unit: 'slice', quantity: 1 })
    expect(useUI.getState().toastMsg).toBe('Added Wholemeal bread to Today, Dinner')
  })

  it('a failed write keeps the sheet and its amount, and the retry logs once', async () => {
    const close = vi.fn()
    await mount(<PortionSheet food={bread()} date={TODAY} meal={0} mealName="Breakfast" close={close} />)
    await typeInto(host.querySelector('input[aria-label="Servings"]'), '3')
    nt.failNext('PUT', '/nt/api/diary/', { lost: true })
    await click(button('Add to Breakfast'))
    expect(close).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(host.querySelector('input[aria-label="Servings"]').value).toBe('3')
    await click(button('Add to Breakfast'))
    expect(close).toHaveBeenCalled()
    expect(nt.state.days[TODAY].items.filter(i => i.name === 'Wholemeal bread')).toHaveLength(1)
  })

  it('refuses 0 servings instead of logging one', async () => {
    await mount(<PortionSheet food={bread()} date={TODAY} meal={0} mealName="Breakfast" close={() => {}} />)
    await typeInto(host.querySelector('input[aria-label="Servings"]'), '0')
    expect(button('Add to Breakfast').disabled).toBe(true)
    expect(text()).toContain('Enter an amount above 0.')
  })

  it('an amount edited after a lost answer updates that entry instead of adding one', async () => {
    const pending = { uuid: null, food: null }
    await mount(<PortionSheet food={bread()} date={TODAY} meal={0} mealName="Breakfast" pending={pending} close={() => {}} />)
    nt.failNext('PUT', '/nt/api/diary/', { lost: true, status: 504 })
    await click(button('Add to Breakfast'))
    await typeInto(host.querySelector('input[aria-label="Servings"]'), '2')
    await click(button('Add to Breakfast'))
    const logged = nt.state.days[TODAY].items.filter(i => i.name === 'Wholemeal bread')
    expect(logged).toHaveLength(1)
    expect(logged[0].quantity).toBe(2)
  })

  it('the same picker session reuses that entry from a reopened sheet', async () => {
    const pending = { uuid: null, food: null }
    nt.failNext('PUT', '/nt/api/diary/', { lost: true, status: 504 })
    await mount(<PortionSheet key="a" food={bread()} date={TODAY} meal={0} mealName="Breakfast" pending={pending} close={() => {}} />)
    await click(button('Add to Breakfast'))
    await mount(<PortionSheet key="b" food={bread()} date={TODAY} meal={0} mealName="Breakfast" pending={pending} close={() => {}} />)
    await click(button('Add to Breakfast'))
    expect(nt.state.days[TODAY].items.filter(i => i.name === 'Wholemeal bread')).toHaveLength(1)
  })

  it('a kJ user enters Quick kcal in kJ; it is stored as kcal', async () => {
    useFake({ settings: { ...fixtureSettings(), energyUnit: 'kJ' } })
    await useNutrition.getState().loadSettings()
    await mount(<QuickKcalSheet date={TODAY} meal={1} mealName="Lunch" close={() => {}} />)
    await typeInto(host.querySelector('input[aria-label="kJ"]'), '1000')
    await click(button('Add to Lunch'))
    expect(nt.state.days[TODAY].items.at(-1).nutrition.calories).toBe(239)
  })
})

describe('the + sheet', () => {
  it('names where it logs, offers the six tiles in order and the rest as a list', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:10:00`))
    await useNutrition.getState().loadSettings()
    await mount(<></>)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    const sheet = lastSheet()
    expect(sheet.querySelector('.g-bs h2').textContent).toBe('Add to Today')
    expect(sheet.querySelector('.g-bs-chip').textContent).toBe('Today · Lunch')
    expect([...sheet.querySelectorAll('.g-atile')].map(b => b.textContent)).toEqual(['Log food', 'Scan', 'Water', 'Weigh-in', 'Start workout', 'Log activity'])
    // A tab root has no items of its own: the list is what is always there.
    expect([...sheet.querySelectorAll('.g-menuitem b')].map(b => b.textContent)).toEqual(['Quick kcal'])
    vi.useRealTimers()
  })

  it('the Water tile adds the first container to the day and closes', async () => {
    await useNutrition.getState().loadSettings()
    await mount(<></>)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    const before = (nt.state.days[TODAY].water || []).length
    await click(lastSheet().querySelector('.g-atile[aria-label^="Add"]'))
    await settle()
    expect(nt.state.days[TODAY].water).toHaveLength(before + 1)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('with a day before today picked, names that day and logs a past workout to it', async () => {
    useDiarySelection.getState().setDate(yesterday)
    await useNutrition.getState().loadSettings()
    await mount(<></>)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Add')
    expect(lastSheet().querySelector('.g-bs-chip').textContent).toContain(fmtDate(yesterday, true))
    await click(button('Log activity', lastSheet()))
    expect(lastSheet().querySelector('input[type="date"]').value).toBe(yesterday)
  })

  it('on a Day page, Log food goes to that day as a parameter: Today and Eat stay on their own day', async () => {
    await useNutrition.getState().loadSettings()
    await mount(<></>)
    await act(async () => { openPlusSheet('/train/day/' + yesterday) })
    await settle()
    await click(button('Log food', lastSheet()))
    await settle()
    expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Log food')
    expect(lastSheet().querySelector('.g-bs-chip').textContent).toContain(fmtDate(yesterday, true))
    expect(useDiarySelection.getState().date).toBeNull()
    expect(useDiarySelection.getState().day()).toBe(TODAY)
  })

  it('on a Day page, logs to that day: Log weight and Add past workout, and a line saying where (PR07 D1.5)', async () => {
    await useNutrition.getState().loadSettings()
    await mount(<></>)
    await act(async () => { openPlusSheet('/train/day/' + yesterday) })
    await settle()
    const day = fmtDate(yesterday, true)
    expect(useDiarySelection.getState().date).toBeNull()
    expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Add')
    expect(lastSheet().querySelector('.g-bs-chip').textContent).toContain(day)
    expect([...lastSheet().querySelectorAll('.g-atile')].map(b => b.textContent)).toEqual(['Log food', 'Scan', 'Water', 'Log weight', 'Add past workout'])
    expect(lastSheet().textContent).not.toContain('Gym check-in')
    expect(lastSheet().querySelector('.g-bs-note').textContent).toBe(`Everything here goes to ${day}. Tap the chip to pick another meal.`)
    await click(button('Add past workout', lastSheet()))
    await settle()
    expect(lastSheet().querySelector('.g-bs h2').textContent).toBe('Add past workout')
    expect(lastSheet().querySelector('.g-bs-chip').textContent).toBe(day)
  })

  it('a meal picked in the header is where Quick kcal logs', async () => {
    await useNutrition.getState().loadSettings()
    await mount(<></>)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    await click(lastSheet().querySelector('.g-bs-chip'))
    await click([...lastSheet().querySelectorAll('.menu-item')].find(m => m.textContent === 'Snacks'))
    expect(lastSheet().querySelector('.g-bs-chip').textContent).toContain('Snacks')
    await click(button('Quick kcal', lastSheet()))
    await typeInto(lastSheet().querySelector('input[aria-label="kcal"]'), '300')
    await click(button('Add to Snacks', lastSheet()))
    expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ type: 'quick_calories', meal: 3, nutrition: { calories: 300 } })
  })

  it('leaves the nutrition rows out without a session for the hub', async () => {
    useStore.setState({ user: null })
    await mount(<></>)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    expect(lastSheet().querySelector('button.g-bs-chip')).toBeNull()
    expect([...lastSheet().querySelectorAll('.g-atile')].map(b => b.textContent)).toEqual(['Weigh-in', 'Start workout', 'Log activity'])
    expect(lastSheet().textContent).not.toContain('Quick kcal')
    expect(nt.requests).toHaveLength(0)
  })
})

describe('sync after a weigh-in and a workout', () => {
  it('a weigh-in pushes Gains, then asks the hub to sync now', async () => {
    const order = []
    useStore.setState({ pushState: vi.fn(async () => { order.push('push') }) })
    vi.stubGlobal('fetch', vi.fn((...a) => { order.push(String(a[0])); return nt.fetch(...a) }))
    await mount(<></>)
    await act(async () => { bwSheet() })
    await settle()
    await click(button('Save weigh-in', lastSheet()))
    await settle()
    expect(order[0]).toBe('push')
    expect(order).toContain('/hub/api/sync/now')
  })

  it('a weigh-in from Home on a past day is logged to that day', async () => {
    await mount(<></>)
    await act(async () => { bwSheet({ date: yesterday }) })
    await settle()
    await click(button('Save weigh-in', lastSheet()))
    // `t` is the change stamp (now); charts place it on its own day, not on the day it was typed.
    const entry = useStore.getState().S.bodyweight.find(b => b.d === yesterday)
    expect(entry.t).toBeGreaterThan(new Date(TODAY + 'T00:00:00').getTime())
    expect(weighInTime(entry)).toBe(new Date(yesterday + 'T12:00:00').getTime())
  })

  it('a weigh-in asked for a day to come is logged today', async () => {
    await mount(<></>)
    await act(async () => { bwSheet({ date: tomorrow }) })
    await settle()
    await click(button('Save weigh-in', lastSheet()))
    const bw =useStore.getState().S.bodyweight
    expect(bw.some(b => b.d === tomorrow)).toBe(false)
    expect(bw.find(b => b.d === TODAY)).toBeTruthy()
  })

  it('the workout toast speaks kJ to a kJ user', () => {
    const settings = { ...fixtureSettings(), calorieAdjustFromActivity: true, energyUnit: 'kJ' }
    expect(workoutKcalMessage({ kcal: 187, settings, covered: false, inputs: { date: TODAY } }))
      .toBe('Added to your day: about 780 kJ (estimate)')
  })

  it('reports what a finished workout did to the target, in the decision\'s words', async () => {
    const settings = fixtureSettings()
    const inputs = { date: TODAY }
    expect(workoutKcalMessage({ kcal: 187, settings: { ...settings, calorieAdjustFromActivity: true }, covered: false, inputs }))
      .toBe('Added to your day: about 190 kcal (estimate)')
    expect(workoutKcalMessage({ kcal: 187, settings: { ...settings, calorieGoalMode: 'adaptive' }, covered: false, inputs: { ...inputs, adaptiveTdee: 2600 } }))
      .toBe('Logged. Your target already includes training.')
    expect(workoutKcalMessage({ kcal: 187, settings: { ...settings, calorieAdjustFromActivity: true }, covered: true, inputs }))
      .toBe('Logged. Your target already includes training.')
    expect(workoutKcalMessage({ kcal: 187, settings, covered: false, inputs })).toBeNull()
  })

  it('after the sync, reads the workout\'s kcal row and toasts it', async () => {
    useFake({
      settings: { ...fixtureSettings(), calorieAdjustFromActivity: true },
      workouts: { w1: { workout_id: 'w1', date: TODAY, kcal: 194, kcal_method: 'og-met-v1', weight_kg: 80, state: 'synced' } },
    })
    await expect(reportWorkoutKcal({ id: 'w1', d: TODAY })).resolves.toBe('Added to your day: about 190 kcal (estimate)')
    expect(useUI.getState().toastMsg).toBe('Added to your day: about 190 kcal (estimate)')
    await expect(reportWorkoutKcal({ id: 'missing', d: TODAY })).resolves.toBeNull()
  })
})

// The avatar of every other tab root's header (RootHeader: the same stage header as Today's).
describe('the avatar dot', () => {
  const dot = () => host.querySelector('.g-sbtn:not(.g-bell) .g-sdot')

  it('shows when the hub sync needs the person', async () => {
    await mount(<RootHeader title="Nutrition" />)
    expect(dot()).toBeNull()
    await act(async () => { useHubSync.setState({ status: fixtureSyncStatus('needs_confirmation') }) })
    expect(dot()).toBeTruthy()
    expect(host.querySelector('.g-sbtn:not(.g-bell)').getAttribute('aria-label')).toBe('Settings, Nutrition sync needs attention')
  })

  it('reads the hub status again when the app comes back to the front', async () => {
    await mount(<RootHeader title="Nutrition" />)
    const reads = () => nt.requests.filter(r => r.path === '/hub/api/sync/status').length
    expect(reads()).toBe(1)
    nt.state.syncStatus = fixtureSyncStatus('error')
    resetSyncThrottle()
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await settle()
    expect(reads()).toBe(2)
    expect(dot()).toBeTruthy()
    // Within the refresh interval, focus does not ask again.
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await settle()
    expect(reads()).toBe(2)
  })
})

describe('the calendar as the date picker', () => {
  afterEach(() => vi.useRealTimers())

  it('reads only the days up to today, and stops when the sheet closes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-20T10:00:00'))
    await mount(<></>)
    await act(async () => { calendarSheet('2026-10-20', { onPick: () => {} }) })
    await settle()
    const days = nt.requests.filter(r => r.path.startsWith('/nt/api/diary/')).map(r => r.path.slice(-10))
    expect(days.length).toBe(20)
    expect(days.every(d => d <= '2026-10-20')).toBe(true)
    expect([...lastSheet().querySelectorAll('.cal-d')].filter(b => b.disabled).map(b => b.textContent)).toContain('21')

    // A slow line: the month's reads are still going when the sheet closes, and stop there.
    useNutrition.getState().reset()
    await act(async () => { useUI.setState({ sheets: [] }) })
    let calls = 0
    vi.stubGlobal('fetch', (...a) => { calls += 1; return new Promise(r => setTimeout(() => r(nt.fetch(...a)), 30)) })
    await act(async () => { calendarSheet('2026-09-15', { onPick: () => {} }) })
    await act(async () => { useUI.setState({ sheets: [] }) })
    await settle(40)
    await settle(40)
    expect(calls).toBeLessThanOrEqual(4)
  })

  it('the month in the day picker opens it, and the day picked there is the date', async () => {
    await mount(<DayNav />)
    await click(host.querySelector('.month-bar-l'))
    const cell = [...lastSheet().querySelectorAll('.cal-d')].find(b => b.textContent === String(Number(yesterday.slice(-2))))
    // Yesterday is in last month on the 1st; the calendar opened on this one.
    if (yesterday.slice(0, 7) !== TODAY.slice(0, 7)) return
    await click(cell)
    expect(useDiarySelection.getState().day()).toBe(yesterday)
  })
})
