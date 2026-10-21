// @vitest-environment happy-dom
// What each root row says (row-values.js), for a sample profile, and the sync pill's states.
import { describe, expect, it } from 'vitest'
import { accountLine, deletionDate, deviceOnly, deviceWord, rowValues, syncPill, syncRowWord } from './row-values.js'

const S = { unit: 'kg', theme: 'dark', accent: 'cobalt', workoutView: 'cards', effort: 'rir', reminder: { on: true, nudge: true }, equipProfiles: [] }
const base = { user: { id: 'u' }, mobile: false, nutrition: false }

describe('rowValues', () => {
  it('Appearance, Units, Workout, Schedule and Gym setup', () => {
    const v = rowValues({ S, ctx: base, lang: 'en' })
    expect(v.appearance.value).toBe('Cobalt')
    expect(v.units.value).toBe('kg · English')
    expect(v.workout.value).toBe('Cards · RIR')
    expect(v.schedule.value).toBe('Fixed Week')
    expect(v.equipment.value).toBe('20 kg bar')
    expect(v.coach.value).toBe('Coming soon')
  })

  it('layouts, no effort scale, lb and an active equipment profile', () => {
    const v = rowValues({ S: { ...S, workoutView: 'list', effort: 'none', unit: 'lb', equipFilterOn: true, activeEquipId: 'p', equipProfiles: [{ id: 'p', name: 'Home' }] }, ctx: base, lang: 'en' })
    expect(v.workout.value).toBe('List')
    expect(v.equipment.value).toBe('Home')
    expect(rowValues({ S: { ...S, unit: 'lb' }, ctx: base, lang: 'en' }).equipment.value).toBe('45 lb bar')
  })

  it('Reminders counts the switches that are on, and says Off with none', () => {
    expect(rowValues({ S: { ...S, reminder: { on: true, nudge: true } }, ctx: { ...base, mobile: true }, lang: 'en' }).reminders.value).toBe('2 on')
    expect(rowValues({ S: { ...S, reminder: { on: false } }, ctx: base, lang: 'en' }).reminders.value).toBe('Off')
  })

  it('Features names Fasting where nutrition is on, and is empty until the settings are here', () => {
    const nt = { ...base, nutrition: true }
    expect(rowValues({ S, ctx: nt, lang: 'en' }).features.value).toBeNull()
    expect(rowValues({ S, ctx: { ...nt, ntSettings: {}, fastingOn: false }, lang: 'en' }).features.value).toBe('Fasting off')
    expect(rowValues({ S, ctx: { ...nt, ntSettings: {}, fastingOn: true }, lang: 'en' }).features.value).toBe('Fasting on')
  })

  it('the food rows come from the nutrition settings, and are empty until they load', () => {
    const none = rowValues({ S, ctx: { ...base, nutrition: true }, lang: 'en' })
    for (const id of ['diary', 'water', 'sources', 'categories', 'customUnits']) expect(none[id].value, id).toBeNull()
    expect(none.goals).toEqual({ value: null, sub: null })
    const nt = {
      mealNames: ['a', 'b', 'c', 'd'], waterContainers: [], offEnabled: true, foodCategories: [1, 2, 3], customUnits: [1],
      calorieGoalMode: 'adaptive', goals: { calories: { sharedGoal: true, max: 2100 } },
    }
    const v = rowValues({ S, ctx: { ...base, nutrition: true, ntSettings: nt }, lang: 'en' })
    expect(v.diary.value).toBe('4 meals')
    expect(v.water.value).toBe('250 ml')
    expect(v.sources.value).toBe('On')
    expect(v.categories.value).toBe('3')
    expect(v.customUnits.value).toBe('1')
    expect(v.goals.sub).toBe('Adaptive')
    expect(v.goals.value).toMatch(/2.?100 kcal/)
    expect(rowValues({ S, ctx: { ...base, nutrition: true, ntSettings: { ...nt, waterContainers: [1, 2], mealNames: ['a'] } }, lang: 'en' }).water.value).toBe('2 containers')
  })

  it('Sync and backup carries the host and the word; About carries the version', () => {
    const v = rowValues({ S, ctx: base, lang: 'en', host: 'fit.example.com', synced: 'Synced' })
    expect(v.backup).toEqual({ value: 'Synced', sub: 'fit.example.com' })
    expect(v.about.sub).toMatch(/^Version .+, licences$/)
  })
})

describe('syncPill', () => {
  const ok = { tone: 'ok', line: 'All synced' }
  it('All synced with how long ago', () => {
    const now = 1_000_000_000
    expect(syncPill({ view: ok, lastSynced: now - 120000, now })).toMatchObject({ state: 'ok', label: 'All synced' })
    expect(syncPill({ view: ok, lastSynced: now - 120000, now }).trail).toBeTruthy()
    expect(syncPill({ view: ok, now }).trail).toBeNull()
  })
  it('counts the changes waiting while offline', () => {
    const off = { tone: 'off', line: 'Offline' }
    expect(syncPill({ view: off, waiting: 3 })).toMatchObject({ state: 'waiting', label: '3 changes waiting' })
    expect(syncPill({ view: off, waiting: 1 }).label).toBe('1 change waiting')
    expect(syncPill({ view: off, waiting: 0 })).toMatchObject({ state: 'waiting', label: 'Offline' })
  })
  it('a deletion pauses sync whatever the connection says', () => {
    expect(syncPill({ view: ok, deletion: { at: 'x' } })).toEqual({ state: 'paused', label: 'Sync paused', trail: 'deletion scheduled' })
    expect(syncPill({ view: null, deletion: { at: 'x' } }).state).toBe('paused')
  })
  it('a problem keeps its own line; a device that does not sync has no pill', () => {
    expect(syncPill({ view: { tone: 'bad', line: 'Server error (HTTP 502)' } })).toMatchObject({ state: 'problem', label: 'Server error (HTTP 502)' })
    expect(syncPill({ view: { tone: 'quiet', line: 'Guest' } })).toBeNull()
    expect(syncPill({ view: null })).toBeNull()
  })
  it('the Sync row word follows the pill', () => {
    expect(syncRowWord({ state: 'ok' })).toBe('Synced')
    expect(syncRowWord({ state: 'paused' })).toBe('Paused')
    expect(syncRowWord(null)).toBeNull()
  })
})

describe('the account card and Sign out lines', () => {
  it('role, passkeys and device', () => {
    expect(accountLine({ user: { admin: true }, passkeys: 2, device: 'this iPhone' })).toBe('Admin · 2 passkeys · this iPhone')
    expect(accountLine({ user: {}, passkeys: 1, device: 'this device' })).toBe('Member · 1 passkey · this device')
    expect(accountLine({ user: {}, passkeys: null, device: 'this device' })).toBe('Member · this device')
  })
  it('the demo, a phone kept local and a guest', () => {
    expect(accountLine({ demo: true })).toBe('Example data, only in this browser.')
    expect(accountLine({ user: null, mobile: true })).toBe('All data stays on this phone')
    expect(accountLine({ user: null })).toBe('Your data lives on this device. Sign in to sync.')
  })
  it('names the device from the user agent', () => {
    expect(deviceWord('Mozilla/5.0 (iPhone; CPU iPhone OS 17)')).toBe('this iPhone')
    expect(deviceWord('Mozilla/5.0 (Linux; Android 14)')).toBe('this phone')
    expect(deviceWord('Mozilla/5.0 (Macintosh)')).toBe('this device')
    expect(deviceOnly('iPhone')).toBe('This iPhone only')
    expect(deviceOnly('')).toBe('This device only')
  })
  it('words the deletion day, and tolerates a bad date', () => {
    expect(deletionDate('2026-10-25T10:00:00Z')).toMatch(/25/)
    expect(deletionDate('nope')).toBe('')
  })
})
