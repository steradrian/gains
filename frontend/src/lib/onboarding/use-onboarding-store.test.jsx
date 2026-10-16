// @vitest-environment happy-dom
// How the store spaces and aims its hub requests (hubCall, saveHubStep, refresh): after a 429
// everything waits for the hub's Retry-After, a 429 is busy whatever wait it asked for, requests
// held back by one 429 do not all go out together, a request is never sent for anyone but the
// person it was asked for, and a hub that names another account makes the page start over.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingStore } from './use-onboarding-store.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../nutrition/api.js', () => ({ nutritionAvailable: () => true }))
const app = vi.hoisted(() => ({ setUser: vi.fn() }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ setUser: app.setUser }) } }))
const hub = vi.hoisted(() => ({ loadOnboarding: vi.fn(), saveStep: vi.fn() }))
vi.mock('./api.js', async original => ({ ...(await original()), ...hub }))

const MARIA = { id: 'u1', name: 'Maria' }
const BEA = { id: 'u2', name: 'Bea' }
const tooMany = retryAfter => Object.assign(new Error('busy'), { status: 429, code: 'busy', retryAfter })
const wrongUser = () => Object.assign(new Error('this request was made for another account'), { status: 409, code: 'wrong-user' })
const options = { user: MARIA, navigate: vi.fn(), location: { pathname: '/home', key: 'k' }, navType: 'PUSH' }
// The most a wait is lengthened by (the store's jitter).
const JITTER_MAX = 500

let store
let root
let reload
function Probe() {
  store = useOnboardingStore(options)
  return null
}
const render = () => act(async () => { root.render(<Probe />) })
const signIn = async user => { options.user = user; await render() }
// Timer by timer, so what a wake-up does runs at the time it was due (Date.now() in a request).
const advance = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const settle = () => act(async () => {})
// Gets the hub to answer 429 once, so the waits start from now.
const limitedFor = async seconds => { await expect(store.hubCall(() => Promise.reject(tooMany(seconds)))).rejects.toMatchObject({ status: 429 }) }
// A request that notes when it went out.
const noting = () => {
  const sent = vi.fn(() => Promise.resolve({}))
  const request = vi.fn(() => { sent(Date.now()); return Promise.resolve({}) })
  return Object.assign(request, { at: () => sent.mock.calls[0]?.[0] })
}

beforeEach(async () => {
  vi.useFakeTimers()
  sessionStorage.clear()
  app.setUser.mockReset()
  hub.loadOnboarding.mockReset()
  hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: true, starterAvailable: true })
  hub.saveStep.mockReset()
  hub.saveStep.mockResolvedValue({})
  reload = vi.fn()
  Object.defineProperty(window.location, 'reload', { configurable: true, value: reload })
  options.user = MARIA
  root = createRoot(document.createElement('div'))
  await render()
})
afterEach(() => {
  act(() => root.unmount())
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('hubCall', () => {
  it('says busy after a 429 that asks for no wait, until the hub answers something else', async () => {
    expect(store.busy()).toBe(false)
    await limitedFor(0)
    expect(store.busy()).toBe(true)
    await expect(store.hubCall(() => Promise.resolve({}))).resolves.toEqual({})
    expect(store.busy()).toBe(false)
    await limitedFor(0)
    await expect(store.hubCall(() => Promise.reject(Object.assign(new Error('x'), { status: 500, code: 'http' })))).rejects.toMatchObject({ status: 500 })
    expect(store.busy()).toBe(false)
  })

  it('sends a request only after the hub\'s Retry-After, and not much later', async () => {
    await limitedFor(2)
    expect(store.busy()).toBe(true)
    const request = noting()
    const start = Date.now()
    const call = store.hubCall(request)
    await advance(1999)
    expect(request).not.toHaveBeenCalled()
    await advance(1 + JITTER_MAX)
    await call
    expect(request.at() - start).toBeGreaterThanOrEqual(2000)
    expect(request.at() - start).toBeLessThanOrEqual(2000 + JITTER_MAX)
  })

  it('wakes the requests held back by the same 429 apart from each other, none before the Retry-After or long after', async () => {
    await limitedFor(2)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9)
    const first = noting()
    const second = noting()
    const start = Date.now()
    const calls = [store.hubCall(first), store.hubCall(second)]
    await advance(2000 + JITTER_MAX)
    await Promise.all(calls)
    expect(second.at()).not.toBe(first.at())
    for (const request of [first, second]) {
      expect(request.at() - start).toBeGreaterThanOrEqual(2000)
      expect(request.at() - start).toBeLessThanOrEqual(2000 + JITTER_MAX)
    }
  })

  it('has the requests behind one that gets limited again wait for the new Retry-After', async () => {
    await limitedFor(2)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9).mockReturnValue(0.1)
    let firstAt = 0
    const first = vi.fn(() => { firstAt = Date.now(); return Promise.reject(tooMany(3)) })
    const second = noting()
    const calls = [store.hubCall(first).catch(() => null), store.hubCall(second)]
    await advance(2000 + JITTER_MAX)
    expect(first).toHaveBeenCalledTimes(1)
    // The second woke after the first was limited again (or was already out of its way): it never
    // goes before the new Retry-After is over.
    await advance(3000 + JITTER_MAX)
    await Promise.all(calls)
    expect(second).toHaveBeenCalledTimes(1)
    expect(second.at()).toBeGreaterThanOrEqual(firstAt + 3000)
  })

  it('drops the layout\'s busy state when a later request gets through, by reading the hub again', async () => {
    hub.loadOnboarding.mockReset()
    hub.loadOnboarding.mockRejectedValueOnce(tooMany(0))
    await signIn({ ...MARIA, id: 'u9' })
    expect(store.hub).toBe('busy')
    hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: true, starterAvailable: true })
    await act(async () => { await store.hubCall(() => Promise.resolve({})) })
    expect(hub.loadOnboarding).toHaveBeenCalledTimes(2)
    expect(store.hub).toBe('ready')
  })
})

describe('saveHubStep', () => {
  // Maria's save waits out a Retry-After; whoever is signed in when it is due is not her.
  const waitingSave = async () => {
    await limitedFor(2)
    const result = store.saveHubStep('goal')
    await advance(1000)
    return { result }
  }

  it('sends nothing, and does not restart the page, when Maria signs out and Bea signs in while it waits', async () => {
    const { result } = await waitingSave()
    await signIn(null)
    await signIn(BEA)
    await advance(2000 + JITTER_MAX)
    expect(hub.saveStep).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    await expect(result).resolves.toBe('failed')
  })

  it('sends nothing for Maria with Bea\'s answers and uid when Bea signs in directly while it waits', async () => {
    const { result } = await waitingSave()
    await signIn(BEA)
    await advance(2000 + JITTER_MAX)
    expect(hub.saveStep).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    await expect(result).resolves.toBe('failed')
  })

  it('does not take Bea\'s own save of the same step for Maria\'s still waiting', async () => {
    await limitedFor(2)
    store.saveHubStep('goal')
    await signIn(BEA)
    const beas = store.saveHubStep('goal')
    await advance(2000 + JITTER_MAX)
    await expect(beas).resolves.toBe('saved')
    expect(hub.saveStep).toHaveBeenCalledTimes(1)
    expect(hub.saveStep.mock.calls[0][2]).toBe('u2')
  })

  it('sends the uid of the person it was asked for', async () => {
    await expect(store.saveHubStep('goal')).resolves.toBe('saved')
    expect(hub.saveStep).toHaveBeenCalledWith('goal', expect.anything(), 'u1')
  })

  it('says it is restarting when the hub names another account, and sends nothing after that', async () => {
    hub.saveStep.mockRejectedValueOnce(wrongUser())
    await expect(store.saveHubStep('goal')).resolves.toBe('restarting')
    expect(reload).toHaveBeenCalledTimes(1)
    await expect(store.saveHubStep('training')).resolves.toBe('restarting')
    await expect(store.savesSettled()).resolves.toBe('restarting')
    expect(hub.saveStep).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('treats a request refused locally for want of a person as a plain failure: marked unsaved, no restart', async () => {
    hub.saveStep.mockRejectedValueOnce(Object.assign(new Error('no person to ask for'), { status: 0, code: 'no-user' }))
    await expect(store.saveHubStep('goal')).resolves.toBe('failed')
    await settle()
    expect(store.state.unsaved).toEqual(['goal'])
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('refresh', () => {
  // The hub as the cookie's person sees it: it answers a read that names no one, and one that
  // names the cookie's person, and refuses one that names another account.
  const hubOf = (cookie, answer) => uid => (uid === undefined || uid === cookie
    ? Promise.resolve(answer)
    : Promise.reject(wrongUser()))
  const BEAS = { answers: { goal: { goal: 'build' } }, completedAt: null, coachAvailable: true, starterAvailable: true, prefill: { answered: ['body'] }, next: 'training' }

  it('asks for the person it holds, and never merges the answers of whoever the cookie says into theirs', async () => {
    hub.loadOnboarding.mockReset()
    hub.loadOnboarding.mockImplementation(hubOf('u2', BEAS))
    await signIn(null)
    await signIn(MARIA)
    expect(hub.loadOnboarding).toHaveBeenCalledWith('u1')
    expect(store.state.answers.goal).toBeNull()
    expect(store.state.server).toBeNull()
    expect(sessionStorage.getItem('gains_onboarding') ?? '').not.toContain('build')
  })

  it('starts the page over, not "offline", when the hub says the session is someone else\'s', async () => {
    hub.loadOnboarding.mockReset()
    hub.loadOnboarding.mockImplementation(hubOf('u2', BEAS))
    await signIn(null)
    await signIn(MARIA)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(app.setUser).toHaveBeenCalledWith(null)
    expect(store.hub).not.toBe('offline')
  })
})
