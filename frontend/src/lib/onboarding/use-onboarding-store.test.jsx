// @vitest-environment happy-dom
// How the store spaces its hub requests (hubCall): after a 429 everything waits for the hub's
// Retry-After, a 429 is busy whatever wait it asked for, and the requests held back by one 429 do
// not all go out in the same millisecond.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingStore } from './use-onboarding-store.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../nutrition/api.js', () => ({ nutritionAvailable: () => true }))
const hub = vi.hoisted(() => ({ loadOnboarding: vi.fn(), saveStep: vi.fn() }))
vi.mock('./api.js', async original => ({ ...(await original()), ...hub }))

const USER = { id: 'u1', name: 'Maria' }
const tooMany = retryAfter => Object.assign(new Error('busy'), { status: 429, code: 'busy', retryAfter })
const options = { user: USER, navigate: vi.fn(), location: { pathname: '/home', key: 'k' }, navType: 'PUSH' }

let store
let root
function Probe() {
  store = useOnboardingStore(options)
  return null
}
const advance = ms => act(async () => { vi.advanceTimersByTime(ms) })
// Gets the hub to answer 429 once, so the waits start from now.
const limitedFor = async seconds => { await expect(store.hubCall(() => Promise.reject(tooMany(seconds)))).rejects.toMatchObject({ status: 429 }) }

beforeEach(async () => {
  vi.useFakeTimers()
  sessionStorage.clear()
  hub.loadOnboarding.mockReset()
  hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: true, starterAvailable: true })
  root = createRoot(document.createElement('div'))
  await act(async () => { root.render(<Probe />) })
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

  it('says busy for the length of a Retry-After, and a request goes out only after it', async () => {
    await limitedFor(2)
    expect(store.busy()).toBe(true)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const sent = vi.fn(() => Promise.resolve({}))
    const call = store.hubCall(sent)
    await advance(1999)
    expect(sent).not.toHaveBeenCalled()
    await advance(1)
    await call
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('wakes the requests held back by the same 429 a little apart, not in the same millisecond', async () => {
    await limitedFor(2)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9)
    const first = vi.fn(() => Promise.resolve({}))
    const second = vi.fn(() => Promise.resolve({}))
    const calls = [store.hubCall(first), store.hubCall(second)]
    await advance(2000)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    await advance(449)
    expect(second).not.toHaveBeenCalled()
    await advance(1)
    await Promise.all(calls)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('never adds more than half a second to a wait', async () => {
    await limitedFor(2)
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const sent = vi.fn(() => Promise.resolve({}))
    const call = store.hubCall(sent)
    await advance(2500)
    await call
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('has the requests behind one that gets limited again wait for the new Retry-After', async () => {
    await limitedFor(2)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9).mockReturnValue(0)
    const first = vi.fn(() => Promise.reject(tooMany(3)))
    const second = vi.fn(() => Promise.resolve({}))
    const calls = [store.hubCall(first).catch(() => null), store.hubCall(second)]
    await advance(2000)
    expect(first).toHaveBeenCalledTimes(1)
    await advance(450)
    expect(second).not.toHaveBeenCalled()
    await advance(2549)
    expect(second).not.toHaveBeenCalled()
    await advance(1)
    await Promise.all(calls)
    expect(second).toHaveBeenCalledTimes(1)
  })
})
