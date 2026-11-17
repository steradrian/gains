// @vitest-environment happy-dom
// The `food-delete` journal kind against NutriTrace faked at the fetch boundary (its merge by uuid
// and its tombstones, lib/nutrition/fake-nutritrace.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { todayISO } from '../format.js'
import { NtApi } from '../nutrition/api.js'
import { createFakeNutriTrace, fixtureDay } from '../nutrition/fake-nutritrace.js'
import { useNutrition } from '../nutrition/store.js'
import { listChanges, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { FOOD_DELETE, recordFoodDelete, restoreFoodChange } from './food-changes.js'

const TODAY = todayISO()
let nt

const nt$ = () => useNutrition.getState()
const serverItems = () => nt.state.days[TODAY].items
const serverNames = () => serverItems().map(i => i.name)
const oatsOnServer = () => serverItems().filter(i => i.name === 'Rolled oats')
const puts = () => nt.writes().filter(r => r.method === 'PUT')

// What DiaryItemSheet.remove does: delete through the store, then journal it.
async function removeFood(uuid, backUuid = 'back-1') {
  const entry = nt$().days[TODAY].entry
  const at = entry.items.findIndex(i => i.uuid === uuid)
  const item = entry.items[at]
  await nt$().removeItem(TODAY, uuid)
  return recordFoodDelete({ date: TODAY, item, at, backUuid, settings: nt$().settings.data })
}
const setMeals = async names => {
  nt.state.settings.mealNames = names
  await nt$().loadSettings({ force: true })
}

beforeEach(async () => {
  localStorage.clear()
  removeEntries()
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY) } })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  nt$().reset()
  await nt$().loadSettings()
  await nt$().loadDay(TODAY)
})
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); removeEntries() })

describe('recording', () => {
  it('journals the removed entry with structured facts and no snapshot in the list', async () => {
    const id = await removeFood('it-oats')
    const [row, ...rest] = listChanges()
    expect(rest).toEqual([])
    expect(row).toMatchObject({
      id, kind: FOOD_DELETE, day: TODAY, subject: 'Rolled oats', action: 'restore', state: 'open',
      facts: { meal: 'Breakfast', day: TODAY, kcal: 228, time: expect.stringMatching(/^\d\d:\d\d$/) },
    })
    expect('snapshot' in row).toBe(false)
  })

  it('journals nothing without a date or an entry with a uuid', () => {
    expect(recordFoodDelete({ date: TODAY, item: { name: 'x' } })).toBeNull()
    expect(recordFoodDelete({ item: { uuid: 'u' } })).toBeNull()
  })
})

describe('Restore', () => {
  it('puts the entry back in its own meal and place, under a new uuid; the original stays tombstoned', async () => {
    const original = { ...serverItems().find(i => i.uuid === 'it-oats') }
    const id = await removeFood('it-oats')
    expect(serverNames()).toEqual(['Quick Calories'])

    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { day: TODAY, meal: 'Breakfast' } })
    expect(serverNames()).toEqual(['Rolled oats', 'Quick Calories'])
    const back = oatsOnServer()[0]
    expect(back.uuid).not.toBe('it-oats')
    expect(back).toMatchObject({ meal: 0, portion: 60, unit: 'g', quantity: 1, addedAt: original.addedAt, nutrition: original.nutrition })
    expect(nt.state.tombstones[TODAY]).toEqual([expect.objectContaining({ kind: 'item', uuid: 'it-oats' })])
    expect(listChanges()[0].state).toBe('restored')
  })

  it('goes back as Snacks, and says so, when its meal no longer exists', async () => {
    const id = await removeFood('it-oats')
    await setMeals(['Lunch', 'Dinner', 'Snacks'])   // Breakfast deleted
    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { day: TODAY, meal: 'snacks' }, fellBack: 'snacks' })
    expect(oatsOnServer()).toHaveLength(1)
    expect(oatsOnServer()[0].meal).toBe(2)   // Snacks is the third meal now
  })

  it('finds its meal by name when the list was reordered', async () => {
    const id = await removeFood('it-oats')
    await setMeals(['Lunch', 'Breakfast', 'Dinner', 'Snacks'])
    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { day: TODAY, meal: 'Breakfast' } })
    expect(oatsOnServer()[0].meal).toBe(1)
  })

  it('falls back to the last meal when no meal is called Snacks', async () => {
    const id = await removeFood('it-oats')
    await setMeals(['Lunch', 'Dinner'])
    const res = await restoreChange(id)
    expect(res).toMatchObject({ ok: true, fellBack: 'snacks' })
    expect(oatsOnServer()[0].meal).toBe(1)
  })

  it('twice never duplicates: the journal answers restored, and a direct second restore finds its entry', async () => {
    const removed = { ...serverItems().find(i => i.uuid === 'it-oats') }
    const id = await removeFood('it-oats')
    expect(await restoreChange(id)).toMatchObject({ ok: true })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(oatsOnServer()).toHaveLength(1)

    // Straight to the restorer, past the journal's own guard: the same attempt, the same uuid.
    const snap = { date: TODAY, item: removed, at: 0, meals: [], mealName: 'Breakfast', backUuid: null }
    const first = oatsOnServer()[0].uuid
    expect(await restoreFoodChange(snap)).toEqual({ ok: true, where: { day: TODAY, meal: 'Breakfast' } })
    expect(oatsOnServer().map(i => i.uuid)).toEqual([first])
  })

  it('answers replaced when the in-place Undo already brought the entry back', async () => {
    const item = { ...serverItems().find(i => i.uuid === 'it-oats') }
    const id = await removeFood('it-oats', 'back-1')
    await nt$().restoreItem(TODAY, { ...item, uuid: 'back-1' }, 0)   // the toast's Undo
    expect(oatsOnServer()).toHaveLength(1)
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'replaced' })
    expect(oatsOnServer()).toHaveLength(1)
    expect(listChanges()[0].state).toBe('open')
  })

  it('restores next to an identical entry from Log again without replacing it, then stays at two', async () => {
    const item = { ...serverItems().find(i => i.uuid === 'it-oats') }
    const id = await removeFood('it-oats')
    await nt$().logItems(TODAY, [{ ...item, uuid: 'again-1' }])   // the same food, meal, amount and time
    expect(await restoreChange(id)).toMatchObject({ ok: true })
    expect(oatsOnServer()).toHaveLength(2)
    expect(oatsOnServer().map(i => i.uuid)).toContain('again-1')
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(oatsOnServer()).toHaveLength(2)
  })

  it('does not resurrect an entry another device deleted meanwhile, nor the removed one', async () => {
    const id = await removeFood('it-oats')
    expect(nt$().days[TODAY].entry.items.map(i => i.uuid)).toEqual(['it-quick'])   // cached
    // Another device deletes the quick entry; this device has not pulled yet.
    await NtApi.saveDiaryDate(TODAY, { items: [], water: [], deleted_uuids: { items: ['it-quick'], water: [] } })
    expect(serverNames()).toEqual([])
    expect(await restoreChange(id)).toMatchObject({ ok: true })
    expect(serverNames()).toEqual(['Rolled oats'])
    expect(serverItems().some(i => i.uuid === 'it-oats' || i.uuid === 'it-quick')).toBe(false)
    // A pull on either device agrees.
    await nt$().loadDay(TODAY, { force: true })
    expect(nt$().days[TODAY].entry.items.map(i => i.name)).toEqual(['Rolled oats'])
  })

  it('does not write the removed uuid back even when another device sends its stale day', async () => {
    const id = await removeFood('it-oats')
    await restoreChange(id)
    const stale = fixtureDay(TODAY)   // still holds it-oats and it-quick
    await NtApi.saveDiaryDate(TODAY, { items: stale.items, water: [], deleted_uuids: { items: [], water: [] } })
    expect(serverItems().filter(i => i.uuid === 'it-oats')).toHaveLength(0)
    expect(oatsOnServer()).toHaveLength(1)
  })
})

describe('Restore without a connection', () => {
  it('fails as error, leaves the entry open and the day untouched, and works when retried', async () => {
    const id = await removeFood('it-oats')
    nt.failNext('PUT', '/nt/api/diary/', 'offline')
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'error' })
    expect(oatsOnServer()).toHaveLength(0)
    expect(listChanges()[0].state).toBe('open')
    expect(await restoreChange(id)).toMatchObject({ ok: true })
    expect(oatsOnServer()).toHaveLength(1)
  })

  it('a saved write whose answer was lost is the same entry on retry', async () => {
    const id = await removeFood('it-oats')
    nt.failNext('PUT', '/nt/api/diary/', { lost: true, status: 504 })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'error' })
    expect(oatsOnServer()).toHaveLength(1)   // it did land
    const first = oatsOnServer()[0].uuid
    // The entry is still open, and the retry finds what landed: ok, and nothing added.
    expect(listChanges()[0].state).toBe('open')
    expect(await restoreChange(id)).toMatchObject({ ok: true })
    expect(oatsOnServer().map(i => i.uuid)).toEqual([first])
    expect(listChanges()[0].state).toBe('restored')
  })

  it('answers error when the day cannot be read', async () => {
    const id = await removeFood('it-oats')
    nt$().reset()
    nt.failNext('GET', '/nt/api/diary/', 'offline')
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'error' })
    expect(oatsOnServer()).toHaveLength(0)
  })
})

describe('Undo of a Restore', () => {
  it('takes the restored entry out without journalling it, and the next Restore goes as a new attempt', async () => {
    const id = await removeFood('it-oats')
    await restoreChange(id)
    const first = oatsOnServer()[0].uuid
    expect(await undoRestore(id)).toEqual({ ok: true })
    expect(oatsOnServer()).toHaveLength(0)
    expect(listChanges()).toHaveLength(1)   // no second entry for the undo
    expect(listChanges()[0].state).toBe('open')
    expect(nt.state.tombstones[TODAY].map(t => t.uuid)).toEqual(expect.arrayContaining(['it-oats', first]))

    expect(await restoreChange(id)).toMatchObject({ ok: true })
    expect(oatsOnServer()).toHaveLength(1)
    expect(oatsOnServer()[0].uuid).not.toBe(first)
  })

  it('answers gone when the restored entry is no longer in the day', async () => {
    const id = await removeFood('it-oats')
    await restoreChange(id)
    await nt$().removeItem(TODAY, oatsOnServer()[0].uuid)
    expect(await undoRestore(id)).toEqual({ ok: false, reason: 'gone' })
  })

  it('writes only the delete, never an add, for the undo', async () => {
    const id = await removeFood('it-oats')
    await restoreChange(id)
    const before = puts().length
    await undoRestore(id)
    const sent = puts().slice(before)
    expect(sent).toHaveLength(1)
    expect(sent[0].body.deleted_uuids.items).toHaveLength(1)
  })
})
