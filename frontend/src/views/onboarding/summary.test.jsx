// @vitest-environment happy-dom
// The Summary (ux-onboarding §3b screen 6, motion-onboarding-summary-v2): what it shows for each
// set of answers, reduced motion, and the hand-over to Home with and without View Transitions.
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadContext } from '../../lib/onboarding/contexts.js'
import { handOver, takeFirstHome, useFirstHome } from '../../lib/onboarding/handover.js'
import { LAND_MS } from '../../lib/onboarding/thread-engine.js'
import { useSummaryMotion } from '../../lib/onboarding/use-summary-motion.js'
import { button, flush, mount, rerender, saved, unmountAll, where } from './onboarding.test-util.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// `sheet`: the render function of the sheet the Summary opened last. `nutrition.on`: whether the
// hub's nutrition is there (Home's hero has its split only with it).
const mocks = vi.hoisted(() => ({ user: { id: 'u1', name: 'Maria' }, sheet: null, nutrition: { on: true } }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ user: mocks.user, config: {}, S: {}, setUser: vi.fn(), pushState: vi.fn(), pullState: vi.fn(), adoptProfile: vi.fn(), holdForRestart: vi.fn() })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore, hasData: () => false }
})
vi.mock('../../store/useUI.js', () => {
  const snap = () => ({ sheets: [], toast: () => {}, openSheet: render => { mocks.sheet = render; return { close: () => {} } } })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../lib/nutrition/api.js', async original => ({
  ...(await original()),
  nutritionAvailable: user => mocks.nutrition.on && !!user,
}))
const hub = vi.hoisted(() => ({ loadOnboarding: vi.fn(), saveStep: vi.fn(), previewTargets: vi.fn(), completeOnboarding: vi.fn() }))
vi.mock('../../lib/onboarding/api.js', async original => ({ ...(await original()), ...hub }))
vi.mock('../../sheets.jsx', () => ({ askAddDeviceData: vi.fn() }))

const full = { sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 64 }
const none = { sex: null, birthYear: null, heightCm: null, weightKg: null }
const TARGETS = { calories: 2150, proteinG: 128, carbsG: 240, fatG: 72, waterMl: 2600 }
const starter = { kind: 'starter', templateId: 'full-body', weekdays: [1, 3, 5], equipment: 'gym', experience: 'new' }
const coach = { kind: 'coach', experience: null, equipment: 'gym', consentVersion: 'ai-coach-build-v1', consentAt: '2026-10-15T08:00:00.000Z' }

async function summary(answers, ms = 400) {
  saved({ answers })
  const page = mount('/onboarding/finish')
  await flush()
  await act(async () => { vi.advanceTimersByTime(ms) })
  await flush()
  return page
}

/**
 * The Summary again, with the hub's answer for these answers already known, as it is when the
 * About you screens asked before it: the target is in the first render, the beats are made against
 * the whole screen. The first mount asks (reduced motion, so nothing animates); the second is the
 * one returned, with motion on if `animated`.
 */
async function summaryWithTarget(answers, { animated = false, ms = 0 } = {}) {
  await summary(answers)
  unmountAll()
  if (animated) delete document.documentElement.dataset.motion
  return summary(answers, ms)
}

let recorder = null

/** Element.animate as a recorder: every animation made, with its target, frames and options. */
function recordAnimations() {
  const made = []
  const proto = Element.prototype
  const saved = { animate: proto.animate, getAnimations: proto.getAnimations }
  proto.animate = function animate(frames, opts) {
    const a = { target: this, frames, opts, finish: vi.fn(), cancel: vi.fn(), finished: Promise.resolve() }
    made.push(a)
    return a
  }
  proto.getAnimations = function getAnimations() { return made.filter(a => this.contains(a.target)) }
  return {
    made,
    on: (page, selector) => made.filter(a => a.target.matches(selector) && page.contains(a.target)),
    restore() { proto.animate = saved.animate; proto.getAnimations = saved.getAnimations },
  }
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
  recorder?.restore()
  recorder = null
  mocks.nutrition.on = true
  mocks.sheet = null
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
    expect(text(page)).toMatch(/2.*for now/)
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

const lose = { goal: 'lose', body: full, trainingDays: 3, plan: starter }
const PUSH = LAND_MS - 320

describe('the status line', () => {
  it('is a live region that exists empty first, then says the target (also under reduced motion)', async () => {
    const page = await summaryWithTarget(lose)
    const status = page.querySelector('.ob-sum [role="status"]')
    expect(status.textContent).toBe('')
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(status.textContent).toBe('Your daily target is 2,150 kcal a day')
  })
})

describe('the timeline', () => {
  it('starts no beat before the thread has landed on the line', async () => {
    recorder = recordAnimations()
    const page = await summaryWithTarget(lose, { animated: true })
    const delays = recorder.made.filter(a => page.querySelector('.ob-sum').contains(a.target)).map(a => a.opts.delay)
    expect(delays.length).toBeGreaterThan(8)
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(LAND_MS)
  })

  it('brings the caption in at 1400 after the push starts, and at 1300 with no training days', async () => {
    recorder = recordAnimations()
    const days = await summaryWithTarget(lose, { animated: true })
    expect(recorder.on(days, '.ob-sum-tail').map(a => a.opts.delay)).toEqual([1400 + PUSH, 1400 + PUSH])
    unmountAll()
    document.documentElement.dataset.motion = 'reduce'
    recorder.made.length = 0
    const none = await summaryWithTarget({ goal: 'lose', body: full, trainingDays: 0 }, { animated: true })
    expect(recorder.on(none, '.ob-sum-tail').map(a => a.opts.delay)).toEqual([1300 + PUSH, 1300 + PUSH])
  })
})

describe('Go to Home: stage A', () => {
  const goHome = async page => {
    await act(async () => { button(page, 'Go to Home').click() })
    for (let i = 0; i < 6; i++) await flush()
  }
  const threadFrames = () => recorder.made.find(a => a.target.classList.contains('ob-sum-thread'))?.frames
  beforeEach(() => hub.completeOnboarding.mockResolvedValue({ completedAt: 1, delivery: { opengym: 'done', nutritrace: 'done' } }))

  it('grows the vertical hairline out of the ring when Home will have its split', async () => {
    recorder = recordAnimations()
    await goHome(await summaryWithTarget(lose, { animated: true }))
    expect(threadFrames()[0].transform).toMatch(/^scale\([\d.]+, 0\)$/)
  })

  it('starts the hairline as wide as the ring\'s stroke, 8px, whatever the hairline is', async () => {
    recorder = recordAnimations()
    const real = globalThis.getComputedStyle
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((el, ...rest) => (el.classList?.contains('ob-sum-thread') ? { width: '0.5px' } : real(el, ...rest)))
    await goHome(await summaryWithTarget(lose, { animated: true }))
    expect(threadFrames()[0].transform).toBe('scale(16, 0)')
    vi.restoreAllMocks()
  })

  it('grows a horizontal line instead when Home has no nutrition and so no split', async () => {
    recorder = recordAnimations()
    const page = await summaryWithTarget(lose, { animated: true })
    mocks.nutrition.on = false
    rerender()
    await goHome(page)
    expect(threadFrames()[0].transform).toBe('scaleX(0)')
  })

  it('grows a horizontal line where there is no target to put in the ring', async () => {
    recorder = recordAnimations()
    await goHome(await summaryWithTarget({ goal: 'keep', body: none, trainingDays: 3, plan: starter }, { animated: true }))
    expect(threadFrames()[0].transform).toBe('scaleX(0)')
  })
})

describe('Go to Home: the shape the transition carries', () => {
  const ghost = { goal: 'keep', body: none, trainingDays: 3, plan: starter }
  // What the Summary and the root look like at the moment the View Transition starts, and after it ends.
  async function transition(answers, { nutrition = true } = {}) {
    recorder = recordAnimations()
    hub.completeOnboarding.mockResolvedValue({ completedAt: 1, delivery: { opengym: 'done', nutritrace: 'done' } })
    const page = await summaryWithTarget(answers, { animated: true })
    mocks.nutrition.on = nutrition
    rerender()
    const root = document.documentElement
    const seen = {}
    let finished
    document.startViewTransition = vi.fn(update => {
      seen.stageA = page.querySelector('.ob-sum-thread')?.classList.contains('flat')
      seen.flat = root.classList.contains('vt-flat')
      seen.named = root.classList.contains('vt-handover')
      update()
      return { finished: new Promise(r => { finished = r }) }
    })
    await act(async () => { button(page, 'Go to Home').click() })
    for (let i = 0; i < 6; i++) await flush()
    return { seen, root, end: async () => { finished(); await flush() } }
  }
  afterEach(() => { delete document.startViewTransition })

  it('a ghost Summary with nutrition on: a horizontal stage A, and the transition goes to the horizontal hairline', async () => {
    const { seen, root, end } = await transition(ghost)
    expect(document.startViewTransition).toHaveBeenCalledTimes(1)
    expect(seen).toEqual({ stageA: true, flat: true, named: true })
    expect(root.classList.contains('vt-flat')).toBe(true)
    await end()
    expect(root.classList.contains('vt-flat')).toBe(false)
    expect(root.classList.contains('vt-handover')).toBe(false)
  })

  it('a ghost Summary with nutrition off: the same', async () => {
    const { seen, root, end } = await transition(ghost, { nutrition: false })
    expect(seen).toEqual({ stageA: true, flat: true, named: true })
    await end()
    expect(root.classList.contains('vt-flat')).toBe(false)
  })

  it('a full-data Summary: a vertical stage A, and the transition goes to the hero hairline', async () => {
    const { seen, root, end } = await transition(lose)
    expect(seen).toEqual({ stageA: false, flat: false, named: true })
    await end()
    expect(root.classList.contains('vt-flat')).toBe(false)
  })

  it('full data with nutrition off is flat as well: Home has no split to land on', async () => {
    const { seen } = await transition(lose, { nutrition: false })
    expect(seen).toEqual({ stageA: true, flat: true, named: true })
  })
})

describe('reduced motion switched on mid-flight', () => {
  it('finishes everything that is moving and says the target', async () => {
    recorder = recordAnimations()
    const page = await summaryWithTarget(lose, { animated: true })
    const mine = recorder.made.filter(a => page.querySelector('.ob-sum').contains(a.target))
    expect(mine.length).toBeGreaterThan(8)
    mine.forEach(a => expect(a.finish).not.toHaveBeenCalled())
    document.documentElement.dataset.motion = 'reduce'
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    mine.forEach(a => expect(a.finish).toHaveBeenCalled())
    expect(page.querySelector('.ob-sum [role="status"]').textContent).toBe('Your daily target is 2,150 kcal a day')
  })

  it('hears the device\'s setting as well as the app\'s', async () => {
    const { onReducedMotion } = await import('../../lib/reduced-motion.js')
    delete document.documentElement.dataset.motion
    const listeners = []
    const media = { matches: false, addEventListener: (_, f) => listeners.push(f), removeEventListener: () => {} }
    vi.stubGlobal('matchMedia', () => media)
    const heard = vi.fn()
    const off = onReducedMotion(heard)
    listeners.forEach(f => f())
    expect(heard).not.toHaveBeenCalled()
    media.matches = true
    listeners.forEach(f => f())
    expect(heard).toHaveBeenCalledTimes(1)
    off()
    vi.unstubAllGlobals()
  })

  it('skips the View Transition and clears the names', async () => {
    delete document.documentElement.dataset.motion
    const skip = vi.fn()
    document.startViewTransition = vi.fn(update => {
      update()
      return { finished: new Promise(() => {}), skipTransition: skip }
    })
    await handOver({ unwind: async () => {}, go: vi.fn(), flat: true })
    const root = document.documentElement
    expect(root.classList.contains('vt-handover')).toBe(true)
    expect(root.classList.contains('vt-flat')).toBe(true)
    root.dataset.motion = 'reduce'
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(skip).toHaveBeenCalledTimes(1)
    expect(root.classList.contains('vt-handover')).toBe(false)
    expect(root.classList.contains('vt-flat')).toBe(false)
    delete document.startViewTransition
  })

  it('during the unwind: no transition, Home fades in', async () => {
    delete document.documentElement.dataset.motion
    document.startViewTransition = vi.fn()
    let end
    const go = vi.fn()
    const handed = handOver({ unwind: () => new Promise(r => { end = r }), go })
    document.documentElement.dataset.motion = 'reduce'
    end()
    await handed
    expect(document.startViewTransition).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalledTimes(1)
    expect(takeFirstHome()).toBe('fade')
    delete document.startViewTransition
  })
})

describe('the call to action', () => {
  it('ends the thread\'s flight too, not only the Summary\'s own beats', () => {
    const finish = vi.fn()
    let motion
    function Host() {
      const ref = useRef(null)
      motion = useSummaryMotion(ref, 'ring')
      return <div ref={ref} className="ob-sum" />
    }
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<ThreadContext.Provider value={{ register: vi.fn(), finish }}><Host /></ThreadContext.Provider>))
    act(() => motion.finishRuns())
    expect(finish).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })
})

describe('the Adjust and activity sheets', () => {
  it('tell the hub once, when the sheet goes, not on every arrow key', async () => {
    const page = await summary({ goal: 'keep', body: full, trainingDays: 0 })
    await act(async () => { button(page, 'Adjust').click() })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(mocks.sheet(() => act(() => root.unmount()))))
    hub.saveStep.mockClear()
    host.querySelector('[role="radio"]').focus()
    const arrow = () => act(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    arrow()
    arrow()
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    const goalSaves = () => hub.saveStep.mock.calls.filter(([step]) => step === 'goal')
    expect(host.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
    expect(goalSaves()).toHaveLength(0)
    act(() => root.unmount())
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(goalSaves()).toHaveLength(1)
    host.remove()
  })

  it('save nothing when nothing was chosen', async () => {
    const page = await summary({ goal: 'keep', body: full, trainingDays: 0 })
    await act(async () => { button(page, 'Adjust').click() })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(mocks.sheet(() => {})))
    hub.saveStep.mockClear()
    act(() => root.unmount())
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(hub.saveStep).not.toHaveBeenCalled()
    host.remove()
  })
})

describe('the stylesheets', () => {
  const css = name => readFileSync(resolve(process.cwd(), 'src', name), 'utf8')

  it('the kit owns the look of its target hero, the Summary restyles none of its internals', () => {
    expect(css('onboarding.css')).not.toMatch(/\.ob-sum \.hero(-c)?[\s{,]/)
    expect(css('tab-kit.css')).toMatch(/\.hero-target\{padding-top:0\}/)
  })

  it('the thread goes to the hairline of its own shape, and the DOM Home mounts still decides when there is no hero hairline', () => {
    const kit = css('tab-kit.css')
    const rule = kit.split('\n').find(l => l.endsWith('{view-transition-name:thread}'))
    const selectors = rule.slice(0, -'{view-transition-name:thread}'.length).split(',')
    expect(selectors).toEqual([
      'html.vt-handover:not(.vt-flat) .hero-hair',
      'html.vt-handover.vt-flat .month-bar-hair',
      'html.vt-handover:not(:has(.hero-hair)) .month-bar-hair',
    ])
    // vt-flat is set and cleared with vt-handover, so it can't outlive the transition.
    const handover = readFileSync(resolve(process.cwd(), 'src/lib/onboarding/handover.js'), 'utf8')
    expect(handover).toMatch(/classList\.toggle\('vt-flat', flat\)/)
    expect(handover).toMatch(/classList\.remove\('vt-handover', 'vt-flat'\)/)
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
