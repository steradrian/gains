// @vitest-environment happy-dom
// The onboarding's screens, as a person goes through them (ux-onboarding §3b): the skip paths, the
// detour, a cancelled passkey, the keyboard, the pickers' slider semantics and reduced motion.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { button, flush, mount, radio, saved, unmountAll, where } from './onboarding.test-util.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { user: null, sheets: [], toasts: [] }
  state.store = () => ({
    user: state.user, config: {}, S: {},
    setUser: vi.fn(u => { state.user = u }), pushState: vi.fn(), pullState: vi.fn(async () => {}), adoptProfile: vi.fn(async () => {}),
  })
  return state
})
vi.mock('../../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.store()) : mocks.store())
  useStore.getState = mocks.store
  return { useStore, hasData: () => false }
})
vi.mock('../../store/useUI.js', () => {
  const snap = () => ({
    sheets: [],
    toast: msg => mocks.toasts.push(msg),
    openSheet: render => { mocks.sheets.push(render); return { close: () => {} } },
  })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
const hub = vi.hoisted(() => ({
  checkInvite: vi.fn(), loadOnboarding: vi.fn(), saveStep: vi.fn(), previewTargets: vi.fn(), completeOnboarding: vi.fn(), passkeySynced: vi.fn(),
}))
vi.mock('../../lib/onboarding/api.js', async original => ({ ...(await original()), ...hub }))
const passkeys = vi.hoisted(() => ({ passkeyRegister: vi.fn(), passkeyLogin: vi.fn() }))
vi.mock('../../lib/api.js', async original => ({ ...(await original()), ...passkeys, webauthnOK: () => true }))
vi.mock('../../sheets.jsx', () => ({ askAddDeviceData: vi.fn() }))

const signedIn = () => { mocks.user = { id: 'u1', name: 'Maria' } }
const press = (el, key) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })
const click = el => act(() => { el.click() })
const later = ms => act(() => { vi.advanceTimersByTime(ms) })
const full = { sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 64 }

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  mocks.user = null
  mocks.sheets.length = 0
  mocks.toasts.length = 0
  Object.values(hub).forEach(f => f.mockReset())
  Object.values(passkeys).forEach(f => f.mockReset())
  hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, step: null, coachAvailable: true, starterAvailable: true })
  hub.saveStep.mockResolvedValue({})
  hub.previewTargets.mockResolvedValue({ ready: true, targets: { calories: 1620 } })
  hub.passkeySynced.mockResolvedValue(true)
  delete document.documentElement.dataset.motion
})
afterEach(() => { unmountAll(); vi.useRealTimers() })

describe('0 Invite', () => {
  it('checks the code on arrival and names the inviter; Create my account goes to the name step', async () => {
    hub.checkInvite.mockResolvedValue({ status: 'valid', inviterName: 'Andrei', suggestedName: 'Maria' })
    const page = mount('/join/AB12')
    await flush()
    expect(hub.checkInvite).toHaveBeenCalledWith('AB12')
    expect(page.querySelector('h1').textContent).toBe('Andrei invited you to Gains')
    click(button(page, 'Create my account'))
    expect(where(page)).toBe('/onboarding/name')
  })

  it('says an invite is used, with Sign in as the way on', async () => {
    hub.checkInvite.mockResolvedValue({ status: 'used', inviterName: null, suggestedName: null })
    const page = mount('/join/AB12')
    await flush()
    expect(page.querySelector('h1').textContent).toBe('This invite has already been used.')
    expect(button(page, 'Sign in')).toBeTruthy()
    expect(button(page, 'Create my account')).toBeUndefined()
  })

  it('offers to try again when the check gets no answer', async () => {
    hub.checkInvite.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }))
    hub.checkInvite.mockResolvedValueOnce({ status: 'valid', inviterName: null, suggestedName: null })
    const page = mount('/join/AB12')
    await flush()
    expect(page.querySelector('h1').textContent).toBe('We couldn’t check this invite')
    click(button(page, 'Try again'))
    await flush()
    expect(page.querySelector('h1').textContent).toBe('You’re invited to Gains')
  })

  it('leaves the invite unused for someone already signed in here', async () => {
    signedIn()
    const page = mount('/join/AB12')
    await flush()
    expect(hub.checkInvite).not.toHaveBeenCalled()
    expect(page.querySelector('h1').textContent).toBe('You’re already in as Maria')
    click(button(page, 'Open Gains'))
    expect(where(page)).toBe('/home')
  })
})

describe('1 Name + passkey', () => {
  it('prefills the suggested name, and a cancelled prompt says so inline with help to hand', async () => {
    saved({ code: 'AB12', invite: { status: 'valid', inviterName: 'Andrei', suggestedName: 'Maria' }, answers: {} })
    passkeys.passkeyRegister.mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    const page = mount('/onboarding/name')
    expect(page.querySelector('input').value).toBe('Maria')
    await act(async () => { button(page, 'Create passkey').click() })
    expect(passkeys.passkeyRegister).toHaveBeenCalledWith('Maria', 'AB12')
    expect(page.querySelector('[role="alert"]').textContent).toContain('No passkey created. Try again.')
    expect(where(page)).toBe('/onboarding/name')
    click(button(page, 'Having trouble?'))
    expect(mocks.sheets).toHaveLength(1)
  })

  it('makes the account and moves to the passkey result, which moves on to the goal by itself', async () => {
    saved({ code: 'AB12', answers: {} })
    passkeys.passkeyRegister.mockResolvedValue({ id: 'u1', name: 'Maria' })
    const page = mount('/onboarding/name')
    act(() => {
      const input = page.querySelector('input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Maria')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { button(page, 'Create passkey').click() })
    await flush()
    expect(where(page)).toBe('/onboarding/passkey')
    expect(page.querySelector('h1').textContent).toBe('Passkey saved')
    expect(page.textContent).toContain('It works on all your devices.')
    later(1500)
    expect(where(page)).toBe('/onboarding/goal')
  })

  it('cannot be sent without a name', () => {
    const page = mount('/onboarding/name')
    expect(button(page, 'Create passkey').disabled).toBe(true)
  })
})

describe('2 Goal', () => {
  beforeEach(signedIn)

  it('moves on 650ms after a tap, and saves the goal', async () => {
    const page = mount('/onboarding/goal')
    await flush()
    click(radio(page, 'Build muscle'))
    expect(radio(page, 'Build muscle').getAttribute('aria-checked')).toBe('true')
    expect(hub.saveStep).toHaveBeenCalledWith('goal', expect.objectContaining({ goal: 'build' }))
    expect(where(page)).toBe('/onboarding/goal')
    later(650)
    expect(where(page)).toBe('/onboarding/sex')
  })

  it('arrow keys choose without moving on, with one radio in the tab order', async () => {
    const page = mount('/onboarding/goal')
    await flush()
    const first = radio(page, 'Lose weight')
    expect([...page.querySelectorAll('[role="radio"]')].map(r => r.tabIndex)).toEqual([0, -1, -1, -1])
    act(() => first.focus())
    press(first, 'ArrowDown')
    expect(radio(page, 'Keep my weight').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radio(page, 'Keep my weight'))
    later(1000)
    expect(where(page)).toBe('/onboarding/goal')
  })

  it('has no Skip and no way back to making the account', async () => {
    const page = mount('/onboarding/goal')
    await flush()
    expect(button(page, 'Skip')).toBeUndefined()
    expect(page.querySelector('[aria-label="Back"]').disabled).toBe(true)
  })
})

describe('3 About you', () => {
  beforeEach(() => { signedIn(); saved({ answers: { goal: 'keep' } }) })

  it('skips the four steps to Training from any of them', async () => {
    const page = mount('/onboarding/born')
    await flush()
    click(button(page, 'Skip'))
    expect(where(page)).toBe('/onboarding/training')
  })

  it('3a: a tap moves on after 600ms and the live target narrows', async () => {
    const page = mount('/onboarding/sex')
    await flush()
    const before = page.querySelector('.ob-tgt-n').textContent
    click(radio(page, 'Female'))
    expect(page.querySelector('.ob-cap').textContent).toMatch(/^Your target is now about/)
    later(600)
    expect(page.querySelector('.ob-tgt-n').textContent).not.toBe(before)
    expect(where(page)).toBe('/onboarding/born')
  })

  it('3b: the wheel is a vertical slider, untouched until moved, typed with Enter', async () => {
    const page = mount('/onboarding/born')
    await flush()
    const wheel = page.querySelector('[role="slider"]')
    expect(wheel.getAttribute('aria-orientation')).toBe('vertical')
    expect(wheel.getAttribute('aria-valuenow')).toBe('1990')
    expect(wheel.getAttribute('aria-valuetext')).toBe('Born 1990, not set')
    expect(button(page, 'Next').disabled).toBe(true)
    press(wheel, 'ArrowDown')
    expect(wheel.getAttribute('aria-valuetext')).toBe('Born 1991')
    expect(button(page, 'Next').disabled).toBe(false)
    press(wheel, 'PageUp')
    expect(wheel.getAttribute('aria-valuenow')).toBe('1981')
    press(wheel, 'Enter')
    const field = page.querySelector('input[aria-label="Year you were born"]')
    expect(document.activeElement).toBe(field)
    act(() => { field.value = '1850' })
    press(field, 'Enter')
    expect(mocks.toasts).toContain('Kept within 1926–2011')
    expect(wheel.getAttribute('aria-valuenow')).toBe('1926')
  })

  it('3b: Escape leaves the typed year as it was', async () => {
    const page = mount('/onboarding/born')
    await flush()
    const wheel = page.querySelector('[role="slider"]')
    press(wheel, 'Enter')
    const field = page.querySelector('.ob-pk-in')
    act(() => { field.value = '1970' })
    press(field, 'Escape')
    expect(page.querySelector('.ob-pk-in')).toBeNull()
    expect(wheel.getAttribute('aria-valuenow')).toBe('1990')
  })

  it('3c: the ruler steps with the arrows and switches to feet and inches', async () => {
    const page = mount('/onboarding/height')
    await flush()
    const ruler = page.querySelector('[role="slider"]')
    expect(ruler.getAttribute('aria-valuemax')).toBe('230')
    press(ruler, 'ArrowRight')
    expect(ruler.getAttribute('aria-valuetext')).toBe('171 centimetres')
    click(page.querySelector('.ob-uchip'))
    expect(ruler.getAttribute('aria-valuemax')).toBe('90')
    expect(ruler.getAttribute('aria-valuetext')).toBe('5 feet 7 inches')
    expect(page.querySelector('.ob-uchip').getAttribute('aria-label')).toBe('Units: feet and inches. Switch to centimetres')
  })

  it('3d: with all four in, the ring firms up to the hub\'s target, and Next goes to Training', async () => {
    saved({ answers: { goal: 'keep', body: { ...full, weightKg: null } } })
    const page = mount('/onboarding/weight')
    await flush()
    const ruler = page.querySelector('[role="slider"]')
    press(ruler, 'ArrowLeft')
    await act(async () => { vi.advanceTimersByTime(300) })
    await flush()
    expect(hub.previewTargets).toHaveBeenCalled()
    expect(page.querySelector('.ob-cap').textContent).toContain('Your starting target: 1,620 kcal a day.')
    click(button(page, 'Next'))
    expect(hub.saveStep).toHaveBeenCalledWith('body', expect.anything())
    expect(where(page)).toBe('/onboarding/training')
  })
})

describe('4 Training', () => {
  beforeEach(() => { signedIn(); saved({ answers: { goal: 'keep', body: full } }) })

  it('0 days goes to the end, any other number to Plan', async () => {
    let page = mount('/onboarding/training')
    await flush()
    click(page.querySelector('[aria-label="0, just tracking food"]'))
    expect(page.querySelector('.ob-cap').textContent).toBe('Just tracking food. You can add training any time.')
    later(600)
    expect(where(page)).toBe('/onboarding/finish')
    unmountAll()
    page = mount('/onboarding/training')
    await flush()
    click(radio(page, '3'))
    expect(page.querySelector('.ob-cap').textContent).toBe('Suggested: Monday, Wednesday, Friday')
    later(600)
    expect(where(page)).toBe('/onboarding/plan')
  })

  it('Skip saves no days and goes to the end', async () => {
    const page = mount('/onboarding/training')
    await flush()
    click(button(page, 'Skip'))
    expect(hub.saveStep).toHaveBeenCalledWith('training', expect.objectContaining({ trainingDays: null }))
    expect(where(page)).toBe('/onboarding/finish')
  })
})

describe('5 Plan', () => {
  beforeEach(() => { signedIn(); saved({ answers: { goal: 'keep', body: full, trainingDays: 3 } }) })

  it('offers the AI coach only where the server has one', async () => {
    hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: false, starterAvailable: true })
    const page = mount('/onboarding/plan')
    await flush()
    expect(radio(page, 'Have the AI coach build one')).toBeUndefined()
    expect([...page.querySelectorAll('[role="radio"]')].every(r => r.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('offers a plan only where the hub says openGym takes it, never from this app\'s own config', async () => {
    // An openGym from before the ready-made plans: the hub offers neither plan.
    hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: false, starterAvailable: false })
    let page = mount('/onboarding/plan')
    await flush()
    expect([...page.querySelectorAll('[role="radio"]')].map(r => r.textContent)).toEqual([expect.stringContaining('No plan for now')])
    unmountAll()
    // The hub not reached: nothing is known, and nothing is offered on a guess.
    hub.loadOnboarding.mockRejectedValue(Object.assign(new Error('x'), { status: 0, code: 'offline' }))
    page = mount('/onboarding/plan')
    await flush()
    expect(radio(page, 'Use a ready-made plan')).toBeUndefined()
    expect(radio(page, 'Have the AI coach build one')).toBeUndefined()
  })

  it('No plan saves the choice and goes to the end; Skip does the same', async () => {
    const page = mount('/onboarding/plan')
    await flush()
    click(radio(page, 'No plan for now'))
    expect(hub.saveStep).toHaveBeenCalledWith('plan', expect.objectContaining({ plan: { kind: 'none' } }))
    later(620)
    expect(where(page)).toBe('/onboarding/finish')
  })

  it('the AI coach opens its consent sheet; Build saves the plan and goes to the end', async () => {
    const page = mount('/onboarding/plan')
    await flush()
    click(radio(page, 'Have the AI coach build one'))
    later(640)
    expect(mocks.sheets).toHaveLength(1)
    const sheetHost = document.createElement('div')
    document.body.appendChild(sheetHost)
    const sheetRoot = createRoot(sheetHost)
    const close = vi.fn()
    act(() => sheetRoot.render(mocks.sheets[0](close)))
    expect(sheetHost.textContent).toContain('These answers go to the AI service')
    click([...sheetHost.querySelectorAll('[role="radio"]')].find(r => r.textContent === 'Dumbbells only'))
    click(button(sheetHost, 'Build my plan'))
    // The consent is to the text shown, by its id; the time is the hub's to stamp, never the phone's.
    const sent = hub.saveStep.mock.calls.findLast(([step]) => step === 'plan')[1].plan
    expect(sent).toEqual({ kind: 'coach', experience: null, equipment: 'dumbbells', consentVersion: 'ai-coach-build-v1' })
    expect(sent).not.toHaveProperty('consentAt')
    expect(close).toHaveBeenCalled()
    expect(where(page)).toBe('/onboarding/finish')
    act(() => sheetRoot.unmount())
    sheetHost.remove()
  })

  it('Not now on the coach sheet puts the choice back to nothing picked', async () => {
    const page = mount('/onboarding/plan')
    await flush()
    click(radio(page, 'Have the AI coach build one'))
    later(640)
    const sheetHost = document.createElement('div')
    const sheetRoot = createRoot(sheetHost)
    act(() => sheetRoot.render(mocks.sheets[0](() => {})))
    act(() => sheetRoot.unmount())
    expect(radio(page, 'Have the AI coach build one').getAttribute('aria-checked')).toBe('false')
    expect(where(page)).toBe('/onboarding/plan')
  })

  it('a ready-made plan opens its preview, where a session moves to a free day and the plan is used', async () => {
    const page = mount('/onboarding/plan')
    await flush()
    click(radio(page, 'Use a ready-made plan'))
    later(560)
    expect(where(page)).toBe('/onboarding/starter')
    const day = name => [...page.querySelectorAll('.ob-pday')].find(b => b.getAttribute('aria-label').startsWith(name))
    expect(day('Monday').getAttribute('aria-pressed')).toBe('true')
    click(day('Tuesday'))
    expect(day('Tuesday').getAttribute('aria-pressed')).toBe('true')
    click(button(page, 'Use this plan'))
    expect(hub.saveStep).toHaveBeenLastCalledWith('plan', expect.objectContaining({
      plan: { kind: 'starter', templateId: 'full-body', weekdays: [2, 3, 5], equipment: 'gym', experience: 'new' },
    }))
    expect(where(page)).toBe('/onboarding/finish')
  })
})

describe('the end (placeholder for the Summary)', () => {
  beforeEach(signedIn)

  it('completes on the hub and goes Home', async () => {
    saved({ answers: { goal: 'keep', body: full, trainingDays: 0 } })
    hub.completeOnboarding.mockResolvedValue({ completedAt: 1 })
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(hub.completeOnboarding).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(where(page)).toBe('/home')
  })

  it('never completes with an answer the hub has not taken: it says so, and can finish later', async () => {
    saved({ answers: { goal: 'keep', body: full, trainingDays: 0 }, unsaved: ['body'] })
    hub.saveStep.mockRejectedValue(Object.assign(new Error('bad'), { status: 400, code: 'http' }))
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(hub.completeOnboarding).not.toHaveBeenCalled()
    expect(page.querySelector('h1').textContent).toBe('Your answers could not be saved yet')
    click(button(page, 'Finish later'))
    expect(where(page)).toBe('/home')
  })

  it('sends failed saves again one at a time, in step order, before completing', async () => {
    saved({ answers: { goal: 'keep', body: full, trainingDays: 3, plan: { kind: 'none' } }, unsaved: ['plan', 'goal', 'training'] })
    let inFlight = 0
    let most = 0
    hub.saveStep.mockImplementation(async () => {
      most = Math.max(most, ++inFlight)
      await Promise.resolve()
      inFlight--
      return {}
    })
    hub.completeOnboarding.mockResolvedValue({ completedAt: 1, delivery: { opengym: 'done', nutritrace: 'done' } })
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(hub.saveStep.mock.calls.map(([step]) => step)).toEqual(['goal', 'training', 'plan'])
    expect(most, 'never two at once').toBe(1)
    expect(hub.completeOnboarding).toHaveBeenCalled()
  })

  it('asks the Plan step again when the hub says the plan chosen can no longer be taken here', async () => {
    const coach = { kind: 'coach', experience: null, equipment: 'gym', consentVersion: 'ai-coach-build-v1' }
    saved({ answers: { goal: 'keep', body: full, trainingDays: 3, plan: coach }, pick: 'coach' })
    hub.completeOnboarding.mockRejectedValue(Object.assign(new Error('the AI coach is not available on this server'), { status: 409, code: 'plan-unavailable' }))
    const page = mount('/onboarding/finish')
    await flush()
    // The server's AI coach was turned off since: the hub cleared the plan and offers no coach.
    hub.loadOnboarding.mockResolvedValue({ answers: {}, completedAt: null, coachAvailable: false, starterAvailable: true, next: 'plan', remaining: ['plan'] })
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(where(page)).toBe('/onboarding/plan')
    expect(mocks.toasts).toEqual(['That plan can’t be set up on this server right now. Pick another.'])
    expect(radio(page, 'Have the AI coach build one')).toBeUndefined()
    expect(JSON.parse(sessionStorage.getItem('gains_onboarding')).answers.plan).toBeNull()
  })

  it('says so when Training has not taken its part yet, and goes Home', async () => {
    saved({ answers: { goal: 'keep', body: full, trainingDays: 0 } })
    hub.completeOnboarding.mockResolvedValue({ completedAt: 1, delivery: { opengym: 'retrying', nutritrace: 'done' } })
    const page = mount('/onboarding/finish')
    await flush()
    await act(async () => { button(page, 'Go to Home').click() })
    await flush()
    expect(mocks.toasts).toEqual(['Saved. Some of it is still on its way to Training and will show up there soon.'])
    expect(where(page)).toBe('/home')
  })

  it('detours through only the missing details and comes back', async () => {
    saved({ answers: { goal: 'keep', body: { ...full, birthYear: null }, trainingDays: 0 }, skippedYou: true })
    const page = mount('/onboarding/finish')
    await flush()
    click(button(page, 'Add my details'))
    expect(where(page)).toBe('/onboarding/born')
    press(page.querySelector('[role="slider"]'), 'ArrowDown')
    expect(button(page, 'Done')).toBeTruthy()
    click(button(page, 'Done'))
    expect(where(page)).toBe('/onboarding/finish')
    expect(button(page, 'Add my details')).toBeUndefined()
  })
})

describe('who sees what', () => {
  it('sends someone without an account from a later step to the sign-in screen', () => {
    const page = mount('/onboarding/goal')
    expect(where(page)).toBe('/')
  })

  it('steps aside to Home where there is no hub to save to', async () => {
    signedIn()
    hub.loadOnboarding.mockRejectedValue(Object.assign(new Error('x'), { status: 404, code: 'http' }))
    const page = mount('/onboarding/goal')
    await flush()
    expect(where(page)).toBe('/home')
  })

  it('resumes at the first unanswered step', async () => {
    signedIn()
    saved({ answers: { goal: 'lose', body: { ...full, heightCm: null } } })
    const page = mount('/onboarding')
    await flush()
    expect(where(page)).toBe('/onboarding/height')
  })
})

describe('what the hub says is answered or not needed (§6)', () => {
  beforeEach(signedIn)
  // The hub's state for someone whose openGym data answers some steps.
  const fromHub = ({ answered, answers = {}, training, next, remaining }) => ({
    answers, completedAt: null, step: null, coachAvailable: true, starterAvailable: true, next, remaining,
    prefill: { answered, sources: { opengym: 'ok', nutritrace: 'ok' }, ...(training === undefined ? {} : { training: { trainingDays: training } }) },
  })

  it('skips the Plan step when the profile already has routines, so no plan is chosen that openGym would skip', async () => {
    saved({ answers: { goal: 'keep', body: full } })
    hub.loadOnboarding.mockResolvedValue(fromHub({ answered: ['plan'], next: 'training', remaining: ['training'] }))
    const page = mount('/onboarding/training')
    await flush()
    click(radio(page, '3'))
    later(600)
    expect(where(page)).toBe('/onboarding/finish')
    expect(hub.saveStep).not.toHaveBeenCalledWith('plan', expect.anything())
  })

  it('skips Training when the data holds the days, and plans on those days', async () => {
    saved({ answers: { goal: 'keep', body: { ...full, weightKg: null } } })
    hub.loadOnboarding.mockResolvedValue(fromHub({ answered: ['training'], training: 3, next: 'body', remaining: ['body', 'plan'] }))
    const page = mount('/onboarding/weight')
    await flush()
    press(page.querySelector('[role="slider"]'), 'ArrowLeft')
    click(button(page, 'Next'))
    expect(where(page)).toBe('/onboarding/plan')
    expect(page.textContent).toContain('A starter plan for 3 days a week')
  })

  it('resumes where the hub says, straight to the end when the data answers everything', async () => {
    hub.loadOnboarding.mockResolvedValue(fromHub({ answered: ['goal', 'body', 'training', 'plan'], training: 4, next: 'summary', remaining: [] }))
    const page = mount('/onboarding')
    await flush()
    expect(where(page)).toBe('/onboarding/finish')
  })

  it('keeps an AI coach plan when the days change, so after a reload the plan is there and the steps agree with the hub', async () => {
    const coach = { kind: 'coach', experience: null, equipment: 'gym', consentVersion: 'ai-coach-build-v1', consentAt: '2026-10-14T08:00:00.000Z' }
    saved({ answers: { goal: 'keep', body: full, trainingDays: 3, plan: coach }, pick: 'coach' })
    let page = mount('/onboarding/training')
    await flush()
    click(radio(page, '4'))
    later(600)
    unmountAll()
    // The reload: the tab's answers, and the hub's, which kept the coach plan beside 4 days.
    const answers = { goal: { goal: 'keep' }, body: full, training: { trainingDays: 4 }, plan: coach }
    hub.loadOnboarding.mockResolvedValue(fromHub({ answered: [], answers, next: 'summary', remaining: [] }))
    page = mount('/onboarding')
    await flush()
    expect(where(page)).toBe('/onboarding/finish')
    expect(JSON.parse(sessionStorage.getItem('gains_onboarding')).answers.plan).toEqual(coach)
  })
})

describe('reduced motion', () => {
  it('runs no thread and keeps the passkey result up for 2s', async () => {
    document.documentElement.dataset.motion = 'reduce'
    signedIn()
    const page = mount('/onboarding/passkey')
    await flush()
    expect(page.querySelector('.ob-thread').style.visibility).not.toBe('visible')
    later(1500)
    expect(where(page)).toBe('/onboarding/passkey')
    later(500)
    expect(where(page)).toBe('/onboarding/goal')
    expect(page.querySelector('.ob-thread').style.visibility).not.toBe('visible')
  })
})
