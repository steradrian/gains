// @vitest-environment happy-dom
// Where every type of result goes (ux-search.md §4): sheets over the overlay, routes on top of it.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { todayISO } from '../../lib/format.js'

const sheets = vi.hoisted(() => ({
  exerciseDetailSheet: vi.fn(), workoutDetailSheet: vi.fn(), foodDetailSheet: vi.fn(), mealDetailSheet: vi.fn(), manageMeasurementsSheet: vi.fn(),
  bwSheet: vi.fn(), customExSheet: vi.fn(),
}))
const session = vi.hoisted(() => ({ visit: vi.fn(), setGroup: vi.fn(), setQuery: vi.fn() }))
const fasting = vi.hoisted(() => ({ setFastingEnabled: vi.fn() }))
vi.mock('../../sheets.jsx', () => ({ exerciseDetailSheet: sheets.exerciseDetailSheet, workoutDetailSheet: sheets.workoutDetailSheet, bwSheet: sheets.bwSheet, customExSheet: sheets.customExSheet }))
vi.mock('../FoodDetailSheet.jsx', () => ({ foodDetailSheet: sheets.foodDetailSheet }))
vi.mock('../MealDetailSheet.jsx', () => ({ mealDetailSheet: sheets.mealDetailSheet }))
vi.mock('../../views/me/body/measure-drawers.jsx', () => ({ manageMeasurementsSheet: sheets.manageMeasurementsSheet }))
vi.mock('../../lib/search/session.js', () => ({ visit: session.visit, setGroup: session.setGroup, setQuery: session.setQuery }))
vi.mock('../../lib/nutrition/use-fasting.js', () => ({ setFastingEnabled: fasting.setFastingEnabled }))

const { openFeaturePage, openResult, openShortcut, runNoneAction, targetOf, turnOnFeature } = await import('./open-result.js')
const { useRecents } = await import('../../lib/search/recents.js')
const { useStore } = await import('../../store/useStore.js')
const { useUI } = await import('../../store/useUI.js')

beforeEach(() => {
  vi.clearAllMocks()
  useRecents.setState({ list: [], opened: {} })
})

const open = r => openResult({ key: r.type + ':' + r.id, title: 'T', ...r }, { query: 'q' })

describe('opening a result', () => {
  it('a page: its route; a page whose feature is off: the switch, flashed', () => {
    open({ type: 'page', id: '/progress/body', path: '/progress/body' })
    expect(session.visit).toHaveBeenLastCalledWith('/progress/body', { date: undefined, state: undefined })
    open({ type: 'page', id: '/food/fasting', path: '/food/fasting', off: { page: 'features', find: 'Fasting' } })
    expect(session.visit).toHaveBeenLastCalledWith('/me/features', { date: undefined, state: { find: 'Fasting' } })
  })

  it('a setting: its page with { find, via }; a Profile page: the page; a sheet page: the sheet', () => {
    open({ type: 'setting', id: 'x', entry: { page: 'reminders', title: 'Reminder time', via: 'Push notifications', isPage: false } })
    expect(session.visit).toHaveBeenLastCalledWith('/me/reminders', { date: undefined, state: { find: 'Reminder time', via: 'Push notifications' } })
    open({ type: 'setting', id: 'y', entry: { page: null, title: 'Sync now', isPage: false } })
    expect(session.visit).toHaveBeenLastCalledWith('/me/settings', { date: undefined, state: { find: 'Sync now' } })
    open({ type: 'setting', id: 'z', entry: { page: 'goals', title: 'Goals', isPage: true, to: '/food/goals' } })
    expect(session.visit).toHaveBeenLastCalledWith('/food/goals', { date: undefined, state: undefined })
    open({ type: 'setting', id: 'f', entry: { page: 'fields', title: 'Measurement fields', isPage: true, sheet: true } })
    expect(sheets.manageMeasurementsSheet).toHaveBeenCalled()
  })

  it('an exercise, a workout, a food, a meal, a recipe and an online food: their sheets, over the overlay', () => {
    open({ type: 'exercise', id: '0025', ex: { id: '0025' } })
    expect(sheets.exerciseDetailSheet).toHaveBeenCalledWith({ id: '0025' }, { progress: true })
    open({ type: 'workout', id: 'w1', workout: { id: 'w1' } })
    expect(sheets.workoutDetailSheet).toHaveBeenCalledWith({ id: 'w1' })
    open({ type: 'food', id: 11, food: { id: 11 } })
    expect(sheets.foodDetailSheet).toHaveBeenLastCalledWith(expect.objectContaining({ food: { id: 11 }, onEdit: expect.any(Function) }))
    // Edit opens the food's editor page, not a sheet.
    sheets.foodDetailSheet.mock.lastCall[0].onEdit({ id: 11 })
    expect(session.visit).toHaveBeenLastCalledWith('/food/my-foods/foods/11')
    session.visit.mockClear()
    open({ type: 'meal', id: 21 })
    expect(sheets.mealDetailSheet).toHaveBeenLastCalledWith({ id: 21, recipe: false })
    open({ type: 'recipe', id: 22 })
    expect(sheets.mealDetailSheet).toHaveBeenLastCalledWith({ id: 22, recipe: true })
    open({ type: 'online', id: '123', food: { name: 'Nutella' } })
    expect(sheets.foodDetailSheet).toHaveBeenLastCalledWith(expect.objectContaining({ food: { name: 'Nutella' }, onSave: expect.any(Function) }))
    expect(session.visit).not.toHaveBeenCalled()
  })

  it('a routine: its editor; a past day: its Day page under Eat, the entry to find in its state', () => {
    open({ type: 'routine', id: 'r1' })
    expect(session.visit).toHaveBeenLastCalledWith('/train/routines/r1', { date: undefined, state: undefined })
    open({ type: 'day', id: '2026-10-11', date: '2026-10-11', uuid: 'u-1' })
    expect(session.visit).toHaveBeenLastCalledWith('/food/day/2026-10-11', { date: undefined, state: { find: 'u-1' } })
    expect(targetOf({ type: 'day', date: '2026-10-11', uuid: null })).toEqual({ kind: 'route', path: '/food/day/2026-10-11' })
  })

  it('today: Today (the Day page is never today, and Eat’s root holds no diary)', () => {
    const today = todayISO()
    open({ type: 'day', id: today, date: today, uuid: 'u-2' })
    expect(session.visit).toHaveBeenLastCalledWith('/home', { date: undefined, state: undefined })
    expect(targetOf({ type: 'day', date: today, uuid: null })).toEqual({ kind: 'route', path: '/home' })
  })

  it('remembers what was opened, and how often; never an online food, a feature card or a suggestion of the moment', () => {
    open({ type: 'routine', id: 'r1' })
    open({ type: 'online', id: '1', food: {} })
    open({ type: 'feature', id: 'fasting', off: { page: 'features', find: 'Fasting' } })
    open({ type: 'weighin', id: '2026-10-15', date: '2026-10-15' })
    open({ type: 'missed', id: '2026-10-14', path: '/train/schedule' })
    expect(useRecents.getState().list).toEqual([{ kind: 'result', type: 'routine', id: 'r1', label: 'T', query: 'q' }])
    expect(useRecents.getState().opened['routine:r1'].n).toBe(1)
  })

  it('a suggestion: today\'s weigh-in opens its drawer, a missed day the plan', () => {
    open({ type: 'weighin', id: '2026-10-15', date: '2026-10-15' })
    expect(sheets.bwSheet).toHaveBeenCalledWith({ date: '2026-10-15' })
    open({ type: 'missed', id: '2026-10-14', path: '/train/schedule' })
    expect(session.visit).toHaveBeenLastCalledWith('/train/schedule', { date: undefined, state: undefined })
  })
})

describe('the search\'s other taps', () => {
  it('a Go to chip opens its page, or scopes the search to its group', () => {
    openShortcut({ id: 'plan', target: { kind: 'route', path: '/train/schedule' } })
    expect(session.visit).toHaveBeenLastCalledWith('/train/schedule')
    openShortcut({ id: 'days', target: { kind: 'scope', group: 'days' } })
    expect(session.setGroup).toHaveBeenCalledWith('days')
  })

  it('a feature card: the whole card and Features open the switch; Turn on flips the feature', async () => {
    const card = { type: 'feature', id: 'fasting', off: { page: 'features', find: 'Fasting' } }
    expect(targetOf(card)).toEqual({ kind: 'route', path: '/me/features', state: { find: 'Fasting' } })
    openFeaturePage(card)
    expect(session.visit).toHaveBeenLastCalledWith('/me/features', { state: { find: 'Fasting' } })
    fasting.setFastingEnabled.mockResolvedValueOnce()
    await expect(turnOnFeature(card)).resolves.toBe(true)
    expect(fasting.setFastingEnabled).toHaveBeenCalledWith(true)
    useStore.setState(s => ({ S: { ...s.S, checkIn: false } }))
    await expect(turnOnFeature({ type: 'feature', id: 'checkIn', off: { page: 'appearance', find: 'Gym check-in' } })).resolves.toBe(true)
    expect(useStore.getState().S.checkIn).toBe(true)
  })

  it('a Turn on that fails says so and leaves the card', async () => {
    const toast = vi.spyOn(useUI.getState(), 'toast').mockImplementation(() => {})
    fasting.setFastingEnabled.mockRejectedValueOnce(new Error('nope'))
    await expect(turnOnFeature({ type: 'feature', id: 'fasting', off: { page: 'features', find: 'Fasting' } })).resolves.toBe(false)
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('the ways on when nothing matches', () => {
    runNoneAction({ kind: 'near', name: 'protein bar' })
    expect(session.setQuery).toHaveBeenCalledWith('protein bar')
    runNoneAction({ kind: 'create-food', name: 'protien bar' })
    expect(session.visit).toHaveBeenLastCalledWith('/food/my-foods/foods/new', { state: { prefill: { name: 'protien bar' } } })
    runNoneAction({ kind: 'create-exercise', name: 'cable Y raise' })
    expect(sheets.customExSheet).toHaveBeenCalledWith(null, null, 'cable Y raise')
    const askOnline = vi.fn()
    runNoneAction({ kind: 'online', name: 'protien bar' }, { askOnline })
    expect(askOnline).toHaveBeenCalledTimes(1)
  })
})
