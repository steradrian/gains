// @vitest-environment happy-dom
// Whose onboarding it is. What a half-finished one holds (a body, a goal, a plan with the AI
// coach's consent, the invite) belongs to the person who gave it: on a shared device the next
// person must not see it, send it to their own profile, or consent to the AI coach through it.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { button, flush, mount, radio, rerender, saved, unmountAll, where } from './onboarding.test-util.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ user: null }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({
    user: mocks.user, config: {}, S: {},
    setUser: vi.fn(u => { mocks.user = u }), pushState: vi.fn(), pullState: vi.fn(), adoptProfile: vi.fn(async () => {}),
  })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore, hasData: () => false }
})
vi.mock('../../store/useUI.js', () => {
  const snap = () => ({ sheets: [], toast: () => {}, openSheet: () => ({ close: () => {} }) })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
const hub = vi.hoisted(() => ({
  checkInvite: vi.fn(), loadOnboarding: vi.fn(), saveStep: vi.fn(), previewTargets: vi.fn(), completeOnboarding: vi.fn(), passkeySynced: vi.fn(),
}))
vi.mock('../../lib/onboarding/api.js', async original => ({ ...(await original()), ...hub }))
vi.mock('../../sheets.jsx', () => ({ askAddDeviceData: vi.fn() }))

const STORE = 'gains_onboarding'
const MARIA = { id: 'u1', name: 'Maria' }
const BEA = { id: 'u2', name: 'Bea' }
const body = { sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 64 }
const coach = { kind: 'coach', experience: null, equipment: 'gym', consentVersion: 'ai-coach-build-v1' }
const click = el => act(() => { el.click() })
const kept = () => JSON.parse(sessionStorage.getItem(STORE))
// Everything the hub was sent, as text: none of Maria's answers may be in it.
const sentToHub = () => JSON.stringify(hub.saveStep.mock.calls)
const MARIAS = /female|1990|168|"weightKg":64|lose|ai-coach-build-v1|"consent":true/

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  mocks.user = null
  Object.values(hub).forEach(f => f.mockReset())
  hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, step: null, coachAvailable: true, starterAvailable: true, coachConsent: null })
  hub.saveStep.mockResolvedValue({})
  hub.completeOnboarding.mockResolvedValue({ completedAt: 1 })
  hub.passkeySynced.mockResolvedValue(true)
})
afterEach(() => { unmountAll(); vi.useRealTimers() })

describe('a shared device', () => {
  it('A leaves mid-onboarding and signs out, then B arrives by invite: nothing of A\'s shows or is sent', async () => {
    mocks.user = MARIA
    saved({ code: 'AB12', name: 'Maria', answers: { goal: 'lose', body, trainingDays: 3, plan: coach }, unsaved: ['body', 'plan'], pick: 'coach' })
    const first = mount('/onboarding/goal')
    await flush()
    expect(radio(first, 'Lose weight').getAttribute('aria-checked')).toBe('true')

    // Signed out without anything wiping the tab's storage (a session that ran out in another tab).
    mocks.user = null
    rerender()
    expect(sessionStorage.getItem(STORE)).toBeNull()
    unmountAll()

    hub.checkInvite.mockResolvedValue({ status: 'valid', inviterName: 'Andrei', suggestedName: null })
    const landing = mount('/join/AB12')
    await flush()
    click(button(landing, 'Create my account'))
    expect(where(landing)).toBe('/onboarding/name')
    expect(landing.querySelector('input').value).toBe('')
    unmountAll()

    mocks.user = BEA
    const second = mount('/onboarding/goal')
    await flush()
    expect(radio(second, 'Lose weight').getAttribute('aria-checked')).toBe('false')
    click(radio(second, 'Build muscle'))
    expect(hub.saveStep).toHaveBeenCalledWith('goal', expect.objectContaining({ goal: 'build', body: { sex: null, birthYear: null, heightCm: null, weightKg: null } }))
    expect(sentToHub()).not.toMatch(MARIAS)
    expect(kept()).toMatchObject({ uid: 'u2', code: null, name: null, unsaved: [] })
  })

  it('a copy kept for A is not B\'s even when nothing signed A out in between', async () => {
    mocks.user = BEA
    saved({ uid: 'u1', code: 'AB12', answers: { goal: 'lose', body, trainingDays: 3 } })
    const page = mount('/onboarding/goal')
    await flush()
    expect(radio(page, 'Lose weight').getAttribute('aria-checked')).toBe('false')
    expect(hub.saveStep).not.toHaveBeenCalled()
  })

  it('a profile switch under a mounted flow starts B from nothing, and A\'s answers are not sent for B', async () => {
    mocks.user = MARIA
    saved({ answers: { goal: 'lose', body, trainingDays: 3 } })
    const page = mount('/onboarding/goal')
    await flush()
    expect(radio(page, 'Lose weight').getAttribute('aria-checked')).toBe('true')

    mocks.user = BEA
    rerender()
    await flush()
    expect(hub.loadOnboarding).toHaveBeenCalledTimes(2)
    expect(radio(page, 'Lose weight').getAttribute('aria-checked')).toBe('false')
    expect(sessionStorage.getItem(STORE)).toBeNull()

    click(radio(page, 'Keep my weight'))
    expect(hub.saveStep).toHaveBeenCalledWith('goal', expect.objectContaining({ goal: 'keep', body: { sex: null, birthYear: null, heightCm: null, weightKg: null } }))
    expect(sentToHub()).not.toMatch(MARIAS)
    expect(kept()).toMatchObject({ uid: 'u2' })
  })

  it('a save still waiting for A\'s turn is dropped when B signs in', async () => {
    mocks.user = MARIA
    saved({ answers: { goal: 'lose', body, trainingDays: 3 } })
    let release = () => {}
    hub.saveStep.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({}) }))
    const page = mount('/onboarding/goal')
    await flush()
    click(radio(page, 'Build muscle'))
    click(radio(page, 'Keep my weight'))
    expect(hub.saveStep).toHaveBeenCalledTimes(1)

    mocks.user = BEA
    rerender()
    release()
    await flush()
    expect(hub.saveStep).toHaveBeenCalledTimes(1)
  })
})

describe('the AI coach\'s consent', () => {
  it('is not carried to B in A\'s unsaved plan', async () => {
    mocks.user = BEA
    saved({ uid: 'u1', answers: { goal: 'keep', body, trainingDays: 3, plan: coach }, unsaved: ['plan'], pick: 'coach' })
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(hub.saveStep).not.toHaveBeenCalled()
    expect(sentToHub()).not.toMatch(/consent/)
  })

  it('is not carried across a reload either: a coach plan is only ever the tap of the session that holds it', async () => {
    mocks.user = MARIA
    saved({ answers: { goal: 'keep', body, trainingDays: 3, plan: coach }, unsaved: ['plan'], pick: 'coach' })
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(hub.saveStep).not.toHaveBeenCalled()
    expect(hub.completeOnboarding).toHaveBeenCalled()
  })

})

describe('leaving the flow', () => {
  it('forgets everything and starts over when the hub says it is complete', async () => {
    mocks.user = MARIA
    saved({ code: 'AB12', answers: { goal: 'lose', body, trainingDays: 3 }, unsaved: ['body'] })
    hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: '2026-10-15T08:00:00.000Z', step: null })
    const page = mount('/onboarding/sex')
    await flush()
    expect(where(page)).toBe('/home')
    expect(sessionStorage.getItem(STORE)).toBeNull()
  })

  it('forgets everything when the flow steps aside because there is no hub here', async () => {
    mocks.user = MARIA
    saved({ answers: { goal: 'lose', body, trainingDays: 3 } })
    hub.loadOnboarding.mockRejectedValue(Object.assign(new Error('x'), { status: 404, code: 'http' }))
    const page = mount('/onboarding/sex')
    await flush()
    expect(where(page)).toBe('/home')
    expect(sessionStorage.getItem(STORE)).toBeNull()
  })

  it('forgets everything once the onboarding is finished', async () => {
    mocks.user = MARIA
    saved({ answers: { goal: 'keep', body, trainingDays: 0 } })
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(where(page)).toBe('/home')
    expect(sessionStorage.getItem(STORE)).toBeNull()
  })
})
