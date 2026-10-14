// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { NtApi } from './api.js'
import { useNutrition } from './store.js'
import { useDiarySelection, MEAL_PICK_MS } from './selection.js'
import { syncNow, useHubSync, workoutSyncRow } from './sync.js'
import { offResults, offSearchUrl } from './off.js'
import { atPortion, calorieTarget, defaultMeal, macroTarget, mealItems, recentFoods, matchesFood, totalsOf, waterTotal } from './diary.js'
import { createFakeNutriTrace, fixtureActivity, fixtureActivitySum, fixtureDay, fixtureFoods, fixtureOffSearch, fixtureSettings, fixtureSyncStatus } from './fake-nutritrace.js'

const DAY = '2026-10-14'
let nt

beforeEach(() => {
  nt = createFakeNutriTrace({ days: { [DAY]: fixtureDay(DAY) }, activity: { [DAY]: fixtureActivity(DAY) }, activitySum: { [DAY]: fixtureActivitySum(DAY) } })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('NutriTrace client', () => {
  it('reaches NutriTrace through /nt/api on the same origin', async () => {
    const day = await NtApi.getDiaryDate(DAY)
    expect(nt.requests[0]).toMatchObject({ method: 'GET', path: `/nt/api/diary/${DAY}` })
    expect(day.items).toHaveLength(2)
  })

  it('answers an empty day with empty lists', async () => {
    const day = await NtApi.getDiaryDate('2026-01-01')
    expect(day).toMatchObject({ date: '2026-01-01', items: [], water: [], notes: '' })
  })

  it('throws an error with the status and code the caller branches on', async () => {
    nt.failNext('GET', '/nt/api/settings', { status: 502, error: 'upstream unavailable' })
    await expect(NtApi.getSettings()).rejects.toMatchObject({ status: 502, code: 'http', message: 'upstream unavailable' })
    nt.failNext('GET', '/nt/api/settings', 'offline')
    await expect(NtApi.getSettings()).rejects.toMatchObject({ status: 0, code: 'offline' })
    await expect(NtApi.getFoods.call(null)).resolves.toHaveLength(3)
  })

  it('builds the one proxy URL the hub forwards', () => {
    const url = new URL(offSearchUrl('greek yoghurt', { lang: 'de', pageSize: 500 }))
    expect(url.origin + url.pathname).toBe('https://search.openfoodfacts.org/search')
    expect([...url.searchParams.keys()].sort()).toEqual(['langs', 'page', 'page_size', 'q'])
    expect(url.searchParams.get('page_size')).toBe('50')
    expect(url.searchParams.get('langs')).toBe('de')
  })
})

describe('the diary store', () => {
  it('loads a day and adds it up as NutriTrace does', async () => {
    await useNutrition.getState().loadDay(DAY)
    const entry = useNutrition.getState().days[DAY].entry
    expect(totalsOf(entry.items)).toEqual({ calories: 678, proteins: 8.1, carbohydrates: 36, fat: 4.2 })
    expect(mealItems(entry, 1).map(i => i.name)).toEqual(['Quick Calories'])
    expect(waterTotal(entry)).toBe(250)
  })

  it('a failed load is an error state, not an empty day', async () => {
    nt.failNext('GET', '/nt/api/diary/', 'offline')
    await useNutrition.getState().loadDay(DAY)
    expect(useNutrition.getState().days[DAY]).toMatchObject({ status: 'error', error: { code: 'offline' } })
  })

  it('logs one of your foods at a household unit, sending only the new item', async () => {
    const bread = { ...fixtureFoods()[1], imgUrl: '' }
    const item = await useNutrition.getState().logFood({ date: DAY, meal: 0, food: bread, portion: 2, unit: 'slice', servings: 1 })
    const put = nt.writes().find(r => r.method === 'PUT')
    expect(put.path).toBe(`/nt/api/diary/${DAY}`)
    expect(put.body.items).toHaveLength(1)
    expect(put.body).toMatchObject({ water: [], deleted_uuids: { items: [], water: [] } })
    expect(put.body).not.toHaveProperty('body_stats')
    expect(put.body).not.toHaveProperty('notes')
    // 2 slices of 36 g at 247 kcal per 100 g
    expect(Math.round(item.nutrition.calories)).toBe(178)
    expect(item).toMatchObject({ meal: 0, quantity: 1, portion: 2, unit: 'slice', id: 12, food_server_id: 12 })
    expect(item).not.toHaveProperty('alt_units')
    // The day kept what was there and gained the item.
    expect(useNutrition.getState().days[DAY].entry.items.map(i => i.uuid)).toEqual(['it-oats', 'it-quick', item.uuid])
    expect(nt.requests.some(r => r.method === 'POST' && r.path === '/nt/api/foods/12/used' && r.body.date === DAY)).toBe(true)
  })

  it('saves an online result as your food before logging it, once on a retry', async () => {
    const [nutella] = offResults(fixtureOffSearch())
    nt.failNext('PUT', '/nt/api/diary/', { status: 500 })
    await expect(useNutrition.getState().logFood({ date: DAY, meal: 2, food: nutella, portion: 15, unit: 'g', servings: 1 })).rejects.toMatchObject({ status: 500 })
    expect(useNutrition.getState().days[DAY]?.entry).toBeUndefined()
    await useNutrition.getState().logFood({ date: DAY, meal: 2, food: nutella, portion: 15, unit: 'g', servings: 1 })
    const created = nt.state.foods.filter(f => f.name === 'Nutella')
    expect(created).toHaveLength(1)
    const logged = nt.state.days[DAY].items.at(-1)
    expect(logged).toMatchObject({ name: 'Nutella', id: created[0].id, meal: 2 })
    expect(Math.round(logged.nutrition.calories)).toBe(81)
  })

  it('logs quick kcal and water, and undoes them', async () => {
    const quick = await useNutrition.getState().logQuick({ date: DAY, meal: 3, kcal: '320', proteins: 20 })
    expect(quick).toMatchObject({ type: 'quick_calories', meal: 3, nutrition: { calories: 320, proteins: 20 } })
    await expect(useNutrition.getState().logQuick({ date: DAY, meal: 3, kcal: 0 })).rejects.toMatchObject({ code: 'invalid' })
    const water = await useNutrition.getState().logWater({ date: DAY, ml: 250 })
    expect(waterTotal(nt.state.days[DAY])).toBe(500)
    await useNutrition.getState().removeWater(DAY, water.uuid)
    await useNutrition.getState().removeItem(DAY, quick.uuid)
    expect(waterTotal(useNutrition.getState().days[DAY].entry)).toBe(250)
    expect(nt.state.days[DAY].items.some(i => i.uuid === quick.uuid)).toBe(false)
  })

  it('reads activity rows with their coverage', async () => {
    nt = createFakeNutriTrace({ activity: { [DAY]: fixtureActivity(DAY, 'garmin') }, activitySum: { [DAY]: fixtureActivitySum(DAY, 'garmin') } })
    vi.stubGlobal('fetch', nt.fetch)
    await useNutrition.getState().loadActivity(DAY, 'wearable_wins')
    expect(useNutrition.getState().activity[DAY].rows[0]).toMatchObject({ source: 'opengym', covered_by: 'garmin' })
    expect(useNutrition.getState().activity[DAY].sum.covered_by).toBe('garmin')
  })

  it('marks the days with food logged', async () => {
    await useNutrition.getState().loadLogged()
    expect([...useNutrition.getState().logged.days]).toEqual([DAY])
  })

  it('forgets everything when another account signs in', async () => {
    await useNutrition.getState().loadDay(DAY)
    useDiarySelection.getState().setDate('2026-10-01')
    useStore.setState({ user: { id: 4, name: 'Bo' } })
    expect(useNutrition.getState().days).toEqual({})
    expect(useDiarySelection.getState().date).toBeNull()
  })
})

describe('diary arithmetic', () => {
  const settings = fixtureSettings()

  it('scales by grams, by household unit and by plain ratio', () => {
    const bread = fixtureFoods()[1]
    expect(Math.round(atPortion(bread, 50, 'g').nutrition.calories)).toBe(124)
    expect(Math.round(atPortion(bread, 1, 'slice').nutrition.calories)).toBe(89)
    expect(Math.round(atPortion({ ...bread, portion: 1, unit: 'piece' }, 2, 'piece').nutrition.calories)).toBe(494)
  })

  it('computes the target per mode, activity added only to a fixed target with the opt-in', () => {
    expect(calorieTarget({ settings, date: DAY, effectiveActive: 190 })).toMatchObject({ target: 2200, added: 0, adjust: false })
    const optIn = { ...settings, calorieAdjustFromActivity: true }
    expect(calorieTarget({ settings: optIn, date: DAY, effectiveActive: 190 })).toMatchObject({ target: 2390, added: 190 })
    const adaptive = { ...optIn, calorieGoalMode: 'adaptive', calorieGoalFactor: 0.8 }
    expect(calorieTarget({ settings: adaptive, date: DAY, adaptiveTdee: 2600, effectiveActive: 190 })).toMatchObject({ target: 2080, fromBurn: true, added: 0 })
    expect(calorieTarget({ settings: adaptive, date: DAY, adaptiveTdee: null, effectiveActive: 190 })).toMatchObject({ target: 2390, fromBurn: false })
    expect(macroTarget(settings, 'carbohydrates', DAY, 2200)).toBe(165)
    expect(macroTarget(settings, 'proteins', DAY, 2200)).toBe(160)
  })

  it('picks the meal whose time is nearest, never a meal without a time', () => {
    const at = h => new Date(2026, 9, 14, h, 0)
    expect(defaultMeal(settings, at(6))).toBe(0)
    expect(defaultMeal(settings, at(11))).toBe(1)
    expect(defaultMeal(settings, at(16))).toBe(2)
    expect(defaultMeal(settings, at(23))).toBe(2)
    expect(defaultMeal({ ...settings, notifMealTimes: ['07:00', '13:00', '19:00', '22:00'] }, at(23))).toBe(3)
  })

  it('orders recents by last use and searches accents aside', () => {
    expect(recentFoods(fixtureFoods()).map(f => f.id)).toEqual([11, 12])
    expect(fixtureFoods().filter(f => matchesFood(f, 'creme')).map(f => f.id)).toEqual([13])
    expect(fixtureFoods().filter(f => matchesFood(f, 'bread baker')).map(f => f.id)).toEqual([12])
  })

  it('maps Open Food Facts hits per 100 g and drops unusable ones', () => {
    const foods = offResults(fixtureOffSearch())
    expect(foods).toHaveLength(1)
    expect(foods[0]).toMatchObject({ name: 'Nutella', brand: 'Ferrero', barcode: '3017620422003', portion: 100, unit: 'g', nutrition_basis: 'g', nutrition: { calories: 539, proteins: 6.3, fat: 30.9 } })
    expect(foods[0].nutrition.sodium).toBe(42.8)
    expect(foods[0].client_key).toBeTruthy()
  })
})

describe('date and meal selection', () => {
  it('is today until a date is picked, and a picked meal holds for a while', () => {
    const s = useDiarySelection.getState()
    expect(s.date).toBeNull()
    s.setDate('2026-10-01')
    expect(useDiarySelection.getState().day()).toBe('2026-10-01')
    const now = new Date(2026, 9, 14, 12, 0)
    expect(useDiarySelection.getState().mealFor(fixtureSettings(), now)).toBe(1)
    useDiarySelection.getState().setMeal(3, now.getTime())
    expect(useDiarySelection.getState().mealFor(fixtureSettings(), now)).toBe(3)
    expect(useDiarySelection.getState().mealFor(fixtureSettings(), new Date(now.getTime() + MEAL_PICK_MS + 1))).toBe(1)
    useDiarySelection.getState().setDate('2026-10-02')
    expect(useDiarySelection.getState().meal).toBeNull()
  })
})

describe('sync now', () => {
  it('pushes openGym first, then asks the hub, and keeps its status', async () => {
    const order = []
    useStore.setState({ pushState: vi.fn(async () => { order.push('push') }) })
    const fetchSpy = vi.fn((...a) => { order.push('hub'); return nt.fetch(...a) })
    vi.stubGlobal('fetch', fetchSpy)
    const status = await syncNow()
    expect(order).toEqual(['push', 'hub'])
    expect(nt.requests.at(-1)).toMatchObject({ method: 'POST', path: '/hub/api/sync/now' })
    expect(status).toEqual(fixtureSyncStatus())
    expect(useHubSync.getState().status.state).toBe('ok')
  })

  it('never throws, and does nothing without a session', async () => {
    nt.failNext('POST', '/hub/api/sync/now', 'offline')
    await expect(syncNow()).resolves.toBeNull()
    useStore.setState({ user: null })
    const before = nt.requests.length
    await expect(syncNow()).resolves.toBeNull()
    await expect(workoutSyncRow('abc')).resolves.toBeNull()
    expect(nt.requests.length).toBe(before)
  })
})
