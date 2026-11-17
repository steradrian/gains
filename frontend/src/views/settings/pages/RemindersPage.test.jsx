// @vitest-environment happy-dom
// Reminders (boards St1Reminders to St1RemindersBlocked): the push switch subscribes and
// unsubscribes through the same calls as before, a denied permission and an iPhone tab that is not
// installed get their own faces, a browser without push hides the rows, the time drawer saves the
// chosen time, and the missed-workout nudge still rides on the workout-day reminder on the web and
// on the phone.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = {
    S: null, MOBILE: false, sheets: [], toast: vi.fn(), pushSupported: true, permission: 'default', needsHome: false, pushOn: false,
    enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn(), syncReminder: vi.fn(),
  }
  state.snapshot = () => ({
    S: state.S, config: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { on: false, time: '08:00', tz: null, nudge: false, tone: 'friendly' } } }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: mocks.toast, openSheet: render => { mocks.sheets.push(render); return { close: vi.fn() } } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../../../lib/mobile.js', () => ({
  get MOBILE() { return mocks.MOBILE },
  syncReminder: (...a) => mocks.syncReminder(...a),
}))
vi.mock('../../../lib/push.js', () => ({
  pushSupported: () => mocks.pushSupported,
  pushPermission: () => (mocks.pushSupported ? mocks.permission : 'unsupported'),
  syncPushSubscription: () => Promise.resolve(mocks.pushOn),
  enablePush: (...a) => mocks.enablePush(...a),
  disablePush: (...a) => mocks.disablePush(...a),
  sendTestPush: (...a) => mocks.sendTestPush(...a),
}))
vi.mock('../../../lib/notifications/permission.js', () => ({ needsHomeScreen: () => mocks.needsHome }))

import RemindersPage from './RemindersPage.jsx'

let host, root, sheetHost, sheetRoot
beforeEach(() => {
  mocks.MOBILE = false
  mocks.pushSupported = true
  mocks.permission = 'default'
  mocks.needsHome = false
  mocks.pushOn = true
  mocks.sheets = []
  mocks.toast.mockClear()
  mocks.enablePush.mockReset().mockResolvedValue(undefined)
  mocks.disablePush.mockReset().mockResolvedValue(undefined)
  mocks.sendTestPush.mockReset().mockResolvedValue({ ok: true })
  mocks.syncReminder.mockReset().mockResolvedValue(true)
  mocks.S = {
    routines: [{ id: 'r1', name: 'Push A' }, { id: 'r2', name: 'Legs' }],
    week: { 1: ['r1'], 3: ['r2'] },
    reminder: { on: true, time: '08:00', tz: 'Europe/Zurich' },
  }
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  sheetHost = document.createElement('div'); document.body.appendChild(sheetHost); sheetRoot = createRoot(sheetHost)
})
afterEach(() => {
  act(() => sheetRoot.unmount()); sheetHost.remove()
  act(() => root.unmount()); host.remove()
})

const mount = async () => { await act(async () => { root.render(<RemindersPage />) }) }
const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)
const control = title => row(title).querySelector('[role=switch]')
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const flip = async title => { await act(async () => { control(title).click() }); await mount() }
const nudge = 'Nudge me when I skip a planned workout'

describe('Reminders: the push switch', () => {
  it('turns on through enablePush and off through disablePush, as before', async () => {
    mocks.pushOn = false
    await mount()
    expect(row('Workout day reminder')).toBeUndefined()
    await flip('Push notifications')
    expect(mocks.enablePush).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenLastCalledWith('Notifications on')
    expect(control('Push notifications').getAttribute('aria-checked')).toBe('true')
    expect(row('Workout day reminder')).toBeTruthy()
    await flip('Push notifications')
    expect(mocks.disablePush).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenLastCalledWith('Notifications off')
  })

  it('shows the reminders once the server holds this browser, and a test button that sends one', async () => {
    await mount()
    expect(control('Push notifications').getAttribute('aria-checked')).toBe('true')
    expect(row('This device').textContent).toContain('Gets every reminder above')
    await act(async () => { button('Send test notification').click() })
    expect(mocks.sendTestPush).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenLastCalledWith('Test sent! Should pop up any second')
  })

  it('reports a refused prompt and shows the blocked page', async () => {
    mocks.pushOn = false
    mocks.enablePush.mockImplementation(async () => { mocks.permission = 'denied'; throw new Error('Notifications permission was not granted') })
    await mount()
    await act(async () => { control('Push notifications').click() })
    expect(mocks.toast).toHaveBeenLastCalledWith('Notifications permission was not granted')
    expect(host.textContent).toContain('Notifications are blocked for Gains')
  })
})

describe('Reminders: the other faces', () => {
  it('a denied permission shows how to allow it, and Check again reads the permission again', async () => {
    mocks.permission = 'denied'
    await mount()
    expect(host.textContent).toContain('Blocked on this device')
    expect(host.textContent).toContain('Notifications are blocked for Gains')
    expect(host.textContent).toContain('Your reminders are kept.')
    expect(row('Push notifications')).toBeUndefined()
    mocks.permission = 'default'
    await act(async () => { button('Check again').click() })
    expect(host.textContent).not.toContain('Notifications are blocked for Gains')
    expect(row('Push notifications')).toBeTruthy()
  })

  it('an iPhone tab that is not installed shows the three steps, and the button checks again', async () => {
    mocks.needsHome = true
    mocks.pushSupported = false
    await mount()
    expect(host.textContent).toContain('Not installed on this iPhone')
    for (const step of ['1. Tap Share', '2. Add to Home Screen', '3. Open Gains from the icon']) expect(row(step)).toBeTruthy()
    expect(row('Workout day reminder')).toBeUndefined()
    mocks.needsHome = false
    mocks.pushSupported = true
    await act(async () => { button("I've done it, check again").click() })
    expect(row('Push notifications')).toBeTruthy()
  })

  it('a browser without push hides the reminder rows and says reminders work on the phone', async () => {
    mocks.pushSupported = false
    await mount()
    expect(host.textContent).toContain('Reminders work on your phone')
    expect(host.querySelector('.g-glist-row')).toBeNull()
  })
})

describe('Reminders: the header', () => {
  it('counts the reminders that are on', async () => {
    await mount()
    expect(host.querySelector('.g-sptitle p').textContent).toBe('1 on · they come to you, not to Notifications')
    mocks.S.reminder.nudge = true
    await mount()
    expect(host.querySelector('.g-sptitle p').textContent).toBe('2 on · they come to you, not to Notifications')
    mocks.S.reminder = { on: false, time: '08:00', nudge: true }
    await mount()
    expect(host.querySelector('.g-sptitle p').textContent).toBe('Nothing is on')
  })
})

describe('Reminders: the time drawer', () => {
  it('opens on the reminder time with the planned days lit, and Save writes the chosen time', async () => {
    mocks.S.reminder.tz = null
    await mount()
    expect(row('Reminder time').textContent).toContain('08:00')
    expect(row('Reminder time').textContent).toContain('Push A, Legs')
    act(() => { row('Reminder time').click() })
    expect(mocks.sheets).toHaveLength(1)
    const close = vi.fn()
    act(() => sheetRoot.render(mocks.sheets[0](close)))
    expect([...sheetHost.querySelectorAll('.g-rt-days li.on')].length).toBe(2)
    // Nothing is written until Save.
    expect(mocks.S.reminder.time).toBe('08:00')
    const hours = sheetHost.querySelector('[role=spinbutton][aria-label="Hours"]')
    act(() => { hours.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    act(() => { [...sheetHost.querySelectorAll('button')].find(b => b.textContent === 'Save reminder').click() })
    expect(close).toHaveBeenCalled()
    expect(mocks.S.reminder.time).toBe('09:00')
    expect(mocks.S.reminder.on).toBe(true)
  })
})

describe.each([['self-hosted (web push)', false], ['mobile (native)', true]])('Reminders: workout-day reminder and nudge, %s', (_, mobile) => {
  beforeEach(() => { mocks.MOBILE = mobile })

  it('the nudge is off by default, under the reminder, with no tone until it is on', async () => {
    await mount()
    expect(row(nudge)).toBeTruthy()
    expect(row('Nudge tone')).toBeUndefined()
  })

  it('switches on, keeps the reminder as it was, and offers the three tones', async () => {
    await mount()
    await flip(nudge)
    expect(mocks.S.reminder).toMatchObject({ on: true, time: '08:00', nudge: true })
    expect(row(nudge).textContent).toContain('After 3 missed days in a row it goes quiet until your next workout.')
    const tone = label => [...row('Nudge tone').querySelectorAll('[role=radio]')].find(b => b.textContent === label)
    expect(tone('Friendly').getAttribute('aria-checked')).toBe('true')
    await act(async () => { tone('Drill sergeant').click() })
    expect(mocks.S.reminder.tone).toBe('drill')
    await mount()
    await act(async () => { tone('Guilt trip').click() })
    expect(mocks.S.reminder.tone).toBe('guilt')
    await flip(nudge)
    expect(mocks.S.reminder.nudge).toBe(false)
    expect(row('Nudge tone')).toBeUndefined()
  })

  it('is not offered while the reminder is off', async () => {
    mocks.S.reminder = { on: false, time: '08:00', nudge: true }
    await mount()
    expect(row(nudge)).toBeUndefined()
    expect(row('Reminder time')).toBeUndefined()
  })
})

describe('Reminders: the phone app', () => {
  beforeEach(() => { mocks.MOBILE = true })

  it('has no push switch and turning the reminder on asks the OS first', async () => {
    mocks.S.reminder = { on: false, time: '08:00' }
    await mount()
    expect(row('Push notifications')).toBeUndefined()
    await flip('Workout day reminder')
    expect(mocks.syncReminder).toHaveBeenCalledWith(expect.objectContaining({ reminder: expect.objectContaining({ on: true }) }), true)
    expect(mocks.S.reminder.on).toBe(true)
  })

  it('leaves the reminder off, with a toast, when the OS refuses', async () => {
    mocks.S.reminder = { on: false, time: '08:00' }
    mocks.syncReminder.mockResolvedValue(false)
    await mount()
    await flip('Workout day reminder')
    expect(mocks.toast).toHaveBeenLastCalledWith('Could not change notification settings')
    expect(mocks.S.reminder.on).toBe(false)
  })
})
