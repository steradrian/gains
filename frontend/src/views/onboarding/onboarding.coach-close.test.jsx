// @vitest-environment happy-dom
/* The Plan screen with the real sheet host: the AI coach sheet closed by its scrim, and "No plan for
 * now" tapped at once, while the sheet is still going down. The sheet's undo of the pick ran at
 * unmount, after its way out, and put the pick back to nothing over the "no plan" just chosen; it
 * now runs the moment the sheet is closed (components/presence.jsx useSheetClosed).
 * onboarding.test.jsx mocks the sheet host away, so it cannot see this order. */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// These tests are about the Coach being on; the "coming soon" switch has its own tests.
vi.mock('../../lib/coach-availability.js', () => ({ COACH_COMING_SOON: false }))
import Modals, { scrollRestorePending } from '../../components/Modals.jsx'
import { setMotionDriver } from '../../lib/motion.js'
import { fakeMotionDriver } from '../../lib/motion.test-util.js'
import { useUI } from '../../store/useUI.js'
import { flush, mount, radio, saved, unmountAll, where } from './onboarding.test-util.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { user: { id: 'u1', name: 'Maria' } }
  state.store = () => ({
    user: state.user, config: {}, S: {},
    setUser: vi.fn(), pushState: vi.fn(), pullState: vi.fn(async () => {}), adoptProfile: vi.fn(async () => {}),
  })
  return state
})
vi.mock('../../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.store()) : mocks.store())
  useStore.getState = mocks.store
  return { useStore, hasData: () => false }
})
const hub = vi.hoisted(() => ({
  checkInvite: vi.fn(), loadOnboarding: vi.fn(), saveStep: vi.fn(), previewTargets: vi.fn(), completeOnboarding: vi.fn(), passkeySynced: vi.fn(),
}))
vi.mock('../../lib/onboarding/api.js', async original => ({ ...(await original()), ...hub }))
vi.mock('../../sheets.jsx', () => ({ askAddDeviceData: vi.fn() }))

const CONSENT = {
  version: 'ai-coach-build-v1',
  reads: { one: 'Reads your {0} training day.', other: 'Reads your {0} training days.' },
  where: 'These answers go to the AI service this Gains server uses.',
}
const stored = () => JSON.parse(sessionStorage.getItem('gains_onboarding'))

let sheetsRoot, driver
beforeEach(async () => {
  vi.useFakeTimers()
  sessionStorage.clear()
  useUI.setState({ sheets: [] })
  Object.values(hub).forEach(f => f.mockReset())
  hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, step: null, coachAvailable: true, starterAvailable: true, coachConsent: CONSENT })
  hub.saveStep.mockResolvedValue({})
  driver = fakeMotionDriver()
  setMotionDriver(driver)
  const host = document.createElement('div')
  document.body.appendChild(host)
  sheetsRoot = createRoot(host)
  await act(async () => { sheetsRoot.render(<Modals />) })
  saved({ answers: { goal: 'keep', body: { sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 64 }, trainingDays: 3 } })
})
afterEach(async () => {
  unmountAll()
  setMotionDriver(null)
  await act(async () => { useUI.getState().closeAll(); sheetsRoot.unmount() })
  while (scrollRestorePending()) await act(async () => { await vi.advanceTimersByTimeAsync(25) })
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('the Plan screen under the AI coach sheet', () => {
  it('keeps "No plan for now" when it is tapped right after the coach sheet is dismissed, and after its way out ends', async () => {
    const page = mount('/onboarding/plan')
    await flush()
    await act(async () => { radio(page, 'Have the AI coach build one').click() })
    await act(async () => { await vi.advanceTimersByTimeAsync(640) })
    expect(document.querySelector('.sheet')).not.toBeNull()

    await act(async () => { document.querySelector('.mback').click() })
    // closed, but still going down: the page under it takes the tap
    expect(document.querySelector('.sheet').parentElement.hasAttribute('data-leaving')).toBe(true)
    await act(async () => { radio(page, 'No plan for now').click() })
    expect(stored().pick).toBe('none')

    await act(async () => { driver.running().forEach(a => a.finish()) })
    await act(async () => { await vi.advanceTimersByTimeAsync(25) })
    expect(document.querySelector('.sheet')).toBeNull()
    expect(stored().pick).toBe('none')
    expect(stored().answers.plan).toEqual({ kind: 'none' })
    expect(hub.saveStep).toHaveBeenCalledWith('plan', expect.objectContaining({ plan: { kind: 'none' } }), 'u1')

    await act(async () => { await vi.advanceTimersByTimeAsync(620) })
    expect(where(page)).toBe('/onboarding/finish')
  })
})
