// @vitest-environment happy-dom
// The Summary (ux-onboarding §3b screen 6, motion-onboarding-summary-v2): what it shows for each
// set of answers, reduced motion, and the hand-over to Home with and without View Transitions.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handOver, takeFirstHome, useFirstHome } from '../../lib/onboarding/handover.js'
import { button, flush, mount, saved, unmountAll, where } from './onboarding.test-util.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ user: { id: 'u1', name: 'Maria' } }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ user: mocks.user, config: {}, S: {}, setUser: vi.fn(), pushState: vi.fn(), pullState: vi.fn(), adoptProfile: vi.fn(), holdForRestart: vi.fn() })
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
const hub = vi.hoisted(() => ({ loadOnboarding: vi.fn(), saveStep: vi.fn(), previewTargets: vi.fn(), completeOnboarding: vi.fn() }))
vi.mock('../../lib/onboarding/api.js', async original => ({ ...(await original()), ...hub }))
vi.mock('../../sheets.jsx', () => ({ askAddDeviceData: vi.fn() }))

const full = { sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 64 }
const none = { sex: null, birthYear: null, heightCm: null, weightKg: null }
const TARGETS = { calories: 2150, proteinG: 128, carbsG: 240, fatG: 72, waterMl: 2600 }
const starter = { kind: 'starter', templateId: 'full-body', weekdays: [1, 3, 5], equipment: 'gym', experience: 'new' }
const coach = { kind: 'coach', experience: null, equipment: 'gym', consentVersion: 'ai-coach-build-v1', consentAt: '2026-10-15T08:00:00.000Z' }

async function summary(answers) {
  saved({ answers })
  const page = mount('/onboarding/finish')
  await flush()
  await act(async () => { vi.advanceTimersByTime(400) })
  await flush()
  return page
}
const text = page => page.querySelector('.ob-sum').textContent

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  document.documentElement.dataset.motion = 'reduce'
  Object.values(hub).forEach(f => f.mockReset())
  hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: true, starterAvailable: true })
  hub.saveStep.mockResolvedValue({})
  hub.previewTargets.mockResolvedValue({ ready: true, targets: TARGETS })
})
afterEach(() => {
  unmountAll()
  vi.useRealTimers()
  delete document.documentElement.dataset.motion
  takeFirstHome()
})

describe('what the Summary shows', () => {
  it('full data: the name, the first session, the target in the ring, water, macros, the goal and the activity chip', async () => {
    const page = await summary({ goal: 'lose', body: full, trainingDays: 3, plan: starter })
    expect(page.querySelector('h1').textContent).toBe('You’re all set, Maria')
    expect(page.querySelector('.hero-target .hero-e').textContent).toMatch(/^First session · Full body \w+ · \w+/i)
    expect(page.querySelector('.hero-ring .hero-num').textContent).toBe('2,150')
    expect(page.querySelector('.ob-sum-fg')).not.toBeNull()
    expect(page.querySelector('.hero-m').textContent).toBe('2,600mlWatera day')
    expect(page.querySelector('.hero-macros').textContent).toMatch(/128 g.*240 g.*72 g/)
    expect(text(page)).toContain('Lose weight · Adaptive, adjusts to your logs over about 3 weeks')
    expect(button(page, 'Adjust')).toBeTruthy()
    expect(text(page)).toContain('Assumes a mostly seated day · Change')
    expect(button(page, 'Add my details')).toBeUndefined()
  })

  it('no body data: the open ghost arc, Add my details, the default water, no number, macros, Adjust or chip', async () => {
    const page = await summary({ goal: 'keep', body: none, trainingDays: 3, plan: starter })
    expect(page.querySelector('.ob-sum-ghost')).not.toBeNull()
    expect(page.querySelector('.ob-sum-fg')).toBeNull()
    expect(page.querySelector('.hero-ring .hero-num')).toBeNull()
    expect(text(page)).toMatch(/2.*default/)
    expect(page.querySelector('.hero-macros')).toBeNull()
    expect(button(page, 'Adjust')).toBeUndefined()
    expect(text(page)).not.toContain('Change')
    expect(button(page, 'Add my details')).toBeTruthy()
  })

  it('zero days: just tracking food, with the full target', async () => {
    const page = await summary({ goal: 'keep', body: full, trainingDays: 0 })
    expect(page.querySelector('.hero-target .hero-e').textContent).toBe('Just tracking food')
    expect(page.querySelector('.hero-ring .hero-num').textContent).toBe('2,150')
  })

  it('neither body data nor training days: the ghost arc and just tracking food', async () => {
    const page = await summary({ goal: 'keep', body: none, trainingDays: 0 })
    expect(page.querySelector('.hero-target .hero-e').textContent).toBe('Just tracking food')
    expect(page.querySelector('.ob-sum-ghost')).not.toBeNull()
  })

  it('an AI coach plan: the coach is building it', async () => {
    // The tab never keeps a coach plan; the hub's stored one counts.
    hub.loadOnboarding.mockResolvedValue({ answers: { plan: coach }, completedAt: null, coachAvailable: true, starterAvailable: true })
    const page = await summary({ goal: 'build', body: full, trainingDays: 4 })
    expect(page.querySelector('.hero-target .hero-e').textContent).toBe('AI coach is building your plan')
  })
})

describe('reduced motion', () => {
  it('shows the final state at once and says the target once, in one status line', async () => {
    const page = await summary({ goal: 'lose', body: full, trainingDays: 3, plan: starter })
    expect(page.querySelector('.hero-ring .hero-num').textContent).toBe('2,150')
    const status = page.querySelectorAll('.ob-sum [role="status"]')
    expect(status).toHaveLength(1)
    expect(status[0].textContent).toBe('Your daily target is 2,150 kcal a day')
  })

  it('hands over with no unwind and no View Transition: Home fades in', async () => {
    const unwind = vi.fn(async () => {})
    const go = vi.fn()
    document.startViewTransition = vi.fn()
    await handOver({ unwind, go })
    expect(unwind).not.toHaveBeenCalled()
    expect(document.startViewTransition).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalledTimes(1)
    expect(takeFirstHome()).toBe('fade')
    delete document.startViewTransition
  })
})

describe('the hand-over', () => {
  beforeEach(() => { delete document.documentElement.dataset.motion })

  it('without View Transitions: unwinds, goes Home, and Home plays its cascade once', async () => {
    const order = []
    await handOver({ unwind: async () => { order.push('unwind') }, go: () => order.push('home') })
    expect(order).toEqual(['unwind', 'home'])
    expect(document.documentElement.classList.contains('vt-handover')).toBe(false)
    function Home() { useFirstHome(); return null }
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Home />))
    expect(document.documentElement.classList.contains('home-first')).toBe(true)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(document.documentElement.classList.contains('home-first')).toBe(false)
    // A later visit (a tab switch back) is a normal one.
    act(() => root.unmount())
    const again = createRoot(document.createElement('div'))
    act(() => again.render(<Home />))
    expect(document.documentElement.classList.contains('home-first')).toBe(false)
    act(() => again.unmount())
  })

  it('with View Transitions: names the thread only while the transition runs, and Home mounts inside it', async () => {
    let finished
    document.startViewTransition = vi.fn(update => {
      update()
      return { finished: new Promise(r => { finished = r }) }
    })
    const go = vi.fn(() => expect(document.documentElement.classList.contains('vt-handover')).toBe(true))
    await handOver({ unwind: async () => {}, go })
    expect(go).toHaveBeenCalledTimes(1)
    finished()
    await flush()
    expect(document.documentElement.classList.contains('vt-handover')).toBe(false)
    delete document.startViewTransition
  })

  it('Go to Home completes on the hub, then goes Home', async () => {
    hub.completeOnboarding.mockResolvedValue({ completedAt: 1, delivery: { opengym: 'done', nutritrace: 'done' } })
    const page = await summary({ goal: 'keep', body: full, trainingDays: 0 })
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    await flush()
    expect(hub.completeOnboarding).toHaveBeenCalledTimes(1)
    expect(where(page)).toBe('/home')
  })
})

describe('the Summary reuses Home\'s hero', () => {
  it('imports HeroStatus from the kit and defines no hero of its own', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/views/onboarding/SummaryScreen.jsx'), 'utf8')
    expect(src).toMatch(/import \{[^}]*\bHeroStatus\b[^}]*\} from '..\/..\/components\/tab-kit.jsx'/)
    expect(src).toMatch(/<HeroStatus variant="target"/)
    expect(src).not.toMatch(/function\s+\w*Hero\w*\s*\(|className="hero["\s]|hero-(ring|v|num|m|mi)\b/)
  })
})
