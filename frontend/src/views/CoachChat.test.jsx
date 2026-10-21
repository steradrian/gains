import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachChat from './CoachChat.jsx'
import { CONSENT_VERSION } from '../lib/coach.js'   // the consent a fixture grants is the current one, whatever its number
import { checkInWeek } from '../lib/coach-checkin.js'
import { effectiveRoutine } from '../lib/history.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { back } from '../lib/use-tab-nav.js'
import { cohortStats, requestReview, resolvePending } from '../lib/coach-api.js'

// The Coach page (T11.0): the suggestions with their toggles, Dismiss with Undo and Apply, the
// weekly Check in, the thread with the plan and debrief cards, the ⋯ menu and its sheets, and
// the page leaving for Train once Coach is known to be off.
const mocks = vi.hoisted(() => {
  const state = { S: null, pending: null, job: null, community: false, maxMessageLen: 2200, config: undefined, nav: vi.fn(), toast: vi.fn(), openSheet: vi.fn(), refresh: vi.fn() }
  state.storeSnapshot = () => ({
    S: state.S,
    user: { id: 'u1' },
    ready: true,
    config: state.config !== undefined ? state.config : { coach: { enabled: true, ...(state.community ? { community: true } : {}) } },
    coachLocal: null,
    update: mut => mut(state.S),
  })
  state.uiSnapshot = () => ({ toast: state.toast, openSheet: state.openSheet })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI, TOAST_ACTION_MS: 8000 }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../lib/coach-api.js', () => ({
  useCoachStatus: () => ({ pending: mocks.pending, job: mocks.job, cap: null, loading: false, lastError: null, last: null, refresh: mocks.refresh, maxMessageLen: mocks.maxMessageLen }),
  resolvePending: vi.fn(() => Promise.resolve({})),
  refinePlan: vi.fn(() => Promise.resolve({})),
  requestReview: vi.fn(() => Promise.resolve({})),
  requestDebrief: vi.fn(() => Promise.resolve({})),
  requestPlan: vi.fn(() => Promise.resolve({})),
  cohortStats: vi.fn(() => Promise.resolve({ ok: false, enabled: true, sharing: false })),
  setCohortShare: vi.fn(() => Promise.resolve({ ok: true, sharing: true })),
  jobErrorText: () => 'x',
  JOB_ERRORS: { internal: 'x' },
  awaitedJob: () => null,
  settleAwaited: vi.fn(),
}))
vi.mock('../sheets.jsx', () => ({ startFlow: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})),
  IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))
vi.mock('../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../coach.css', () => ({}))

let dom, root, container
const TODAY_WD = new Date(todayISO() + 'T12:00:00').getDay()

const bundle = week => ({
  opengym_plan: 1, name: 'Coach plan', summary: 'a plan',
  week,
  routines: [
    { id: 'x1', name: 'Full body A', emoji: '💪', why: 'first', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps', why: 'because' }] },
    { id: 'x2', name: 'Full body B', emoji: '🏋️', ex: [{ id: '0002', sets: 3, reps: 8, mode: 'reps' }] }
  ],
  customEx: [],
})
const everyDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, 'x1']))
const review = () => ({ id: 'r1', kind: 'review', summary: 'a reading', changes: [
  { id: 'a', type: 'week', target: { weekday: 1 }, before: null, after: null, why: 'rest' },
  { id: 'b', type: 'add-routine', target: {}, before: null, after: { name: 'Legs', ex: [{ id: '0001', sets: 3, reps: 10 }] }, why: 'legs' }
] })

const state = () => ({
  unit: 'kg', lang: 'en', customEx: [], workouts: [], bodyweight: [], exWeights: {},
  dayPlan: {}, routines: [], week: {},
  coach: {
    consent: { agreedAt: '2026-07-01T00:00:00Z', version: CONSENT_VERSION },
    profile: { goal: 'muscle', experience: 'new', daysPerWeek: 3, sessionMin: 60, preferredDays: [1, 3, 5], equipment: [] },
    log: [], snapshots: [], chat: [{ id: 'c1', role: 'user', kind: 'intake', at: 1 }], timings: []
  },
})

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}

async function mount(pending, job = null, { community = false, S = state() } = {}) {
  mocks.S = S
  mocks.pending = pending
  mocks.job = job
  mocks.community = community
  installDom()
  await act(async () => { root.render(React.createElement(CoachChat)) })
}
const rerender = () => act(async () => { root.render(React.createElement(CoachChat)) })

const byText = re => [...container.querySelectorAll('button')].find(b => re.test(b.textContent || ''))
const boxes = () => [...container.querySelectorAll('[role="checkbox"]')]
async function click(el) {
  expect(el).toBeTruthy()
  await act(async () => { el.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}

beforeEach(() => { vi.clearAllMocks(); mocks.config = undefined })
afterEach(async () => {
  vi.useRealTimers()
  if (root) { await act(async () => { root.unmount() }); root = null }
  container = null; dom = null
})

describe('the Coach page', () => {
  it('is a pushed stage page titled Coach with its line, a ⋯, and Back one step down the stack', async () => {
    await mount(null)
    expect(container.querySelector('.g-spage-title').textContent).toBe('Coach')
    expect(container.querySelector('.g-spage-sub').textContent).toBe('Plan design and reviews, from your own training')
    expect(container.querySelector('[aria-label="More"]')).toBeTruthy()
    await click(container.querySelector('button[aria-label="Back"]'))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('opens with the questionnaire summary as your bubble, and pitches the plan as a card with routine tabs', async () => {
    await mount({ id: 'p1', kind: 'create', bundle: bundle(everyDay) })
    const mine = container.querySelector('.g-bubble-me')
    expect(mine.textContent).toContain('Build muscle')
    expect(mine.textContent).toContain('3 days a week')
    expect(mine.querySelector('.g-sr').textContent).toBe('You')
    expect(container.querySelectorAll('.tco-card .pcard-tab').length).toBe(2)
    expect(container.textContent).toContain('because')
    await click([...container.querySelectorAll('.pcard-tab')][1])
    expect(container.querySelector('.pcard-rt-h b').textContent).toContain('Full body B')
  })

  it('imports the plan through the store, records it in the thread, and leaves today startable', async () => {
    await mount({ id: 'p1', kind: 'create', bundle: bundle(everyDay) })
    await click(byText(/Import this plan/))
    const s = mocks.S
    expect(s.routines.length).toBe(2)
    expect(s.week[TODAY_WD]).toBeTruthy()
    const todays = effectiveRoutine(s, todayISO())
    expect(todays && todays.ex.length).toBeGreaterThan(0)
    expect(s.coach.chat.at(-1).kind).toBe('applied')
    expect(s.coach.snapshots).toHaveLength(1)
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('leaves the week alone when the schedule switch is off', async () => {
    await mount({ id: 'p1', kind: 'create', bundle: bundle(everyDay) })
    const sw = container.querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-checked')).toBe('true')
    await click(sw)
    await click(byText(/Import this plan/))
    expect(Object.keys(mocks.S.week)).toHaveLength(0)
    expect(mocks.S.routines.length).toBe(2)
  })

  it('shows the typing bubble with an estimate while a job runs, and disables the composer', async () => {
    await mount(null, { id: 'j1', kind: 'create', state: 'running', startedAt: Date.now() })
    expect(container.querySelector('.tco-typing')).toBeTruthy()
    expect(container.textContent).toContain('usually takes')
    expect(container.querySelector('.tco-composer textarea').disabled).toBe(true)
  })

  it('caps the composer at the admin\'s configured message length, not the old 1000-char default (issue #267)', async () => {
    await mount(null)
    expect(container.querySelector('.tco-composer textarea').getAttribute('maxLength')).toBe('2200')
  })

  it('falls back to 1000 while the status poll has not answered yet', async () => {
    mocks.maxMessageLen = undefined
    try {
      await mount(null)
      expect(container.querySelector('.tco-composer textarea').getAttribute('maxLength')).toBe('1000')
    } finally {
      mocks.maxMessageLen = 2200
    }
  })

  it('applies the accepted subset of a review and logs it', async () => {
    await mount(review())
    expect(container.textContent).toContain('Suggested this week')
    expect(boxes().length).toBe(2)
    await click(boxes()[0])   // drop the week change
    await click(byText(/^Apply 1$/))
    expect(mocks.S.routines.map(r => r.name)).toEqual(['Legs'])
    expect(mocks.S.coach.chat.at(-1).kind).toBe('applied')
    expect(mocks.S.coach.log.at(-1).decisions.map(d => d.status)).toEqual(['accepted', 'rejected'])
    expect(resolvePending).toHaveBeenCalledWith({ proposalId: 'r1', accepted: ['b'], rejected: ['a'] })
  })

  it('keeps an applied review in the thread as a card that opens the whole proposal', async () => {
    await mount(review())
    await click(boxes()[0])
    await click(byText(/^Apply 1$/))
    // The decision is in the store; re-render with the proposal gone, as the poll would.
    mocks.pending = null
    await rerender()
    expect(container.textContent).not.toContain('Suggested this week')
    const recap = container.querySelector('.tco-card .recap')
    expect(recap).toBeTruthy()
    expect(recap.textContent).toContain('1 accepted · 1 declined')
    expect(recap.querySelectorAll('.recap-chip.yes').length).toBe(1)
    expect(recap.querySelectorAll('.recap-chip.no').length).toBe(1)
    expect(mocks.S.coach.chat.at(-1).ref).toBe(mocks.S.coach.log.at(-1).id)
    await click(recap)
    expect(mocks.openSheet).toHaveBeenCalled()
  })

  it('shows a debrief with its score ring and files it on "Got it"', async () => {
    await mount({ id: 'd1', kind: 'debrief', workout: { id: 'w1', name: 'Push', d: '2026-08-29' }, summary: 'ok', score: 8, highlights: ['a'], watch: [], nextTime: ['b'] })
    expect(container.querySelector('.tco-card .deb-ring')).toBeTruthy()
    expect(container.textContent).toContain('Good session')
    expect(container.textContent).toContain('What went well')
    expect(container.textContent).not.toContain('Worth watching')
    await click(byText(/Got it/))
    expect(mocks.S.coach.log.at(-1).kind).toBe('debrief')
    expect(mocks.S.coach.log.at(-1).score).toBe(8)
    expect(mocks.S.coach.chat.at(-1).kind).toBe('debrief')
    expect(mocks.S.coach.chat.at(-1).ref).toBe(mocks.S.coach.log.at(-1).id)
  })

  it('lays the plan’s week out from the day the week is set to start on', async () => {
    const days = () => [...container.querySelectorAll('.pcard-wd')].map(d => d.textContent)
    await mount({ id: 'p1', kind: 'create', bundle: bundle({ 0: 'x1', 1: 'x2' }) })
    expect(days()).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
    const sunday = state(); sunday.weekStart = 0
    await mount({ id: 'p1', kind: 'create', bundle: bundle({ 0: 'x1', 1: 'x2' }) }, null, { S: sunday })
    expect(days()).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
    expect([...container.querySelectorAll('.pcard-wd.on')].map(d => d.textContent)).toEqual(['Su', 'Mo'])
  })

  it('offers the quick actions only when nothing is running', async () => {
    await mount(null)
    expect(byText(/Review my training/)).toBeTruthy()
    expect(byText(/Last workout/)).toBeFalsy()          // no workout logged yet
    await mount(null, { id: 'j1', kind: 'review', state: 'running', startedAt: Date.now() })
    expect(byText(/Review my training/)).toBeFalsy()
  })

  it('offers the comparison only when the instance allows it', async () => {
    await mount(null)
    expect(byText(/^Compare$/)).toBeFalsy()
    await mount(null, null, { community: true })
    expect(byText(/^Compare$/)).toBeTruthy()
  })

  it('draws a failed run as a Coach bubble marked as an error', async () => {
    const S = state()
    S.coach.chat.push({ id: 'c2', role: 'coach', kind: 'error', text: 'It failed', at: 2 })
    await mount(null, null, { S })
    const err = container.querySelector('.g-bubble-error')
    expect(err.textContent).toContain('It failed')
    expect(err.classList.contains('g-bubble-them')).toBe(true)
  })
})

describe('the suggestions: toggles and the Apply label (T11.0)', () => {
  it('starts with every change on and reads Apply all', async () => {
    await mount(review())
    expect(boxes().map(b => b.getAttribute('aria-checked'))).toEqual(['true', 'true'])
    expect(byText(/^Apply all$/)).toBeTruthy()
  })

  it('a change turned off is drawn off, says so, and the button counts what is left', async () => {
    await mount(review())
    await click(boxes()[1])
    expect(boxes()[1].getAttribute('aria-checked')).toBe('false')
    expect(boxes()[1].classList.contains('off')).toBe(true)
    expect(boxes()[1].textContent).toContain('Not applied')
    expect(byText(/^Apply all$/)).toBeFalsy()
    expect(byText(/^Apply 1$/)).toBeTruthy()
    await click(boxes()[1])
    expect(byText(/^Apply all$/)).toBeTruthy()
  })

  it('with every change off there is nothing to apply', async () => {
    await mount(review())
    await click(boxes()[0])
    await click(boxes()[1])
    const apply = byText(/^Apply 0$/)
    expect(apply.disabled).toBe(true)
    await click(apply)
    expect(resolvePending).not.toHaveBeenCalled()
  })

  it('a change that no longer matches the plan keeps its badge and is not a toggle', async () => {
    const p = review()
    p.changes.push({ id: 'c', type: 'sets', target: { routineId: 'gone', exId: '0001' }, before: 3, after: 4, why: 'more' })
    await mount(p)
    expect(boxes()).toHaveLength(2)
    expect(container.querySelector('.tco-chg.stale').textContent).toContain('Doesn’t match your plan any more')
  })
})

describe('Dismiss, with Undo instead of a confirm (T11.3)', () => {
  it('hides the suggestions at once, sends nothing for 8 s, then dismisses for real', async () => {
    vi.useFakeTimers()
    await mount(review())
    await click(byText(/^Dismiss$/))
    expect(mocks.toast).toHaveBeenCalledWith('Dismissed 2 suggestions. Your Plan stays as it is', expect.objectContaining({ action: 'Undo' }))
    await rerender()
    expect(boxes()).toHaveLength(0)
    expect(container.textContent).not.toContain('Suggested this week')
    await act(async () => { vi.advanceTimersByTime(7999) })
    expect(resolvePending).not.toHaveBeenCalled()
    expect(mocks.S.coach.chat.at(-1).kind).not.toBe('dismissed')
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(resolvePending).toHaveBeenCalledWith({ proposalId: 'r1', dismissed: true })
    expect(mocks.S.coach.chat.at(-1).kind).toBe('dismissed')
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('Undo inside the window brings them back and sends nothing, ever', async () => {
    vi.useFakeTimers()
    await mount(review())
    await click(byText(/^Dismiss$/))
    const { onAction } = mocks.toast.mock.calls.at(-1)[1]
    await act(async () => { onAction() })
    await rerender()
    expect(boxes()).toHaveLength(2)
    await act(async () => { vi.advanceTimersByTime(20000) })
    expect(resolvePending).not.toHaveBeenCalled()
    expect(mocks.S.coach.log).toHaveLength(0)
  })

  it('a plan is discarded the same way, with no confirm', async () => {
    vi.useFakeTimers()
    await mount({ id: 'p1', kind: 'create', bundle: bundle(everyDay) })
    await click(byText(/^Discard$/))
    expect(mocks.toast).toHaveBeenCalledWith('Plan discarded. Your Plan stays as it is', expect.objectContaining({ action: 'Undo' }))
    await rerender()
    expect(container.querySelector('.pcard')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(8000) })
    expect(resolvePending).toHaveBeenCalledWith({ proposalId: 'p1', dismissed: true })
  })

  it('holds the composer while the dismissal waits, so no newer proposal can land under it (review #5)', async () => {
    vi.useFakeTimers()
    await mount(review())
    await click(byText(/^Dismiss$/))
    await rerender()
    const box = () => container.querySelector('.tco-composer textarea')
    expect(box().disabled).toBe(true)
    expect(container.querySelector('.tco-send').disabled).toBe(true)
    expect(requestReview).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(8000) })
    await rerender()
    expect(box().disabled).toBe(false)
  })
})

describe('message stamps', () => {
  it('date an older message by the local day, not the UTC one (review #23)', async () => {
    // Half past midnight local time: east of UTC that is still the day before in UTC.
    const at = new Date(2026, 0, 2, 0, 30).getTime()
    const S = state()
    S.coach.chat.push({ id: 'm1', role: 'user', kind: 'text', text: 'hello', at })
    await mount(null, null, { S })
    const stamps = [...container.querySelectorAll('small')].map(s => s.textContent)
    expect(stamps.some(s => s.startsWith(fmtDate('2026-01-02') + ' · '))).toBe(true)
  })
})

describe('Check in (T11.1)', () => {
  it('reads Check in and opens the drawer', async () => {
    await mount(null)
    const btn = container.querySelector('.tco-checkin')
    expect(btn.textContent).toBe('Check in')
    await click(btn)
    expect(mocks.openSheet).toHaveBeenCalledWith(expect.any(Function), { variant: 'ds' })
  })

  it('reads Checked in only when this week has a check-in', async () => {
    const S = state()
    S.coachCheckIns = { [checkInWeek(S)]: { feel: 'right', sleep: null, note: '', _ts: 1 } }
    await mount(null, null, { S })
    expect(container.querySelector('.tco-checkin').textContent).toBe('Checked in')
    const cleared = state()
    cleared.coachCheckIns = { [checkInWeek(cleared)]: { _ts: 2 } }
    await mount(null, null, { S: cleared })
    expect(container.querySelector('.tco-checkin').textContent).toBe('Check in')
  })
})

describe('Coach off (PR02Edges)', () => {
  it('waits while the config has not loaded, then lands on Train, replacing the entry', async () => {
    mocks.config = null
    await mount(null)
    expect(mocks.nav).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')
    mocks.config = { coach: { enabled: false } }
    await rerender()
    expect(mocks.nav).toHaveBeenCalledWith('/train', { replace: true })
  })

  it('a cold config that turns out on keeps the page', async () => {
    mocks.config = null
    await mount(null)
    mocks.config = { coach: { enabled: true } }
    await rerender()
    expect(mocks.nav).not.toHaveBeenCalled()
    expect(container.querySelector('.g-spage-title').textContent).toBe('Coach')
  })

  it('Coach on without consent goes to the intake', async () => {
    const S = state(); S.coach.consent = null
    await mount(null, null, { S })
    expect(mocks.nav).toHaveBeenCalledWith('/train/coach/intake', { replace: true })
  })
})

// The Coach's sheets are opened through the UI store; their content is what openSheet was given.
describe('the ⋯ menu and its sheets', () => {
  const sheets = []
  afterEach(async () => {
    for (const s of sheets.splice(0)) await act(async () => { s.root.unmount() })
  })
  const showLastSheet = async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    const render = mocks.openSheet.mock.calls.at(-1)[0]
    await act(async () => { r.render(render(() => {})) })
    sheets.push({ root: r })
    return el
  }
  const emptyOf = el => ({
    title: el.querySelector('.empty .empty-t')?.textContent,
    body: el.querySelector('.empty .empty-b')?.textContent,
    art: el.querySelector('.empty .empty-art svg.lineart'),
  })
  const labels = el => [...el.querySelectorAll('.g-menuitem b')].map(b => b.textContent)

  it('is a design-system drawer holding everything the old header menu held', async () => {
    await mount(null, null, { community: true })
    await click(container.querySelector('[aria-label="More"]'))
    expect(mocks.openSheet.mock.calls.at(-1)[1]).toEqual({ variant: 'ds' })
    const menu = await showLastSheet()
    expect(labels(menu)).toEqual(['Ask for a review', 'Compare with others here', 'Everything the Coach proposed', 'Start a new plan', 'Edit my answers', 'Automatic reviews'])
  })

  it('the history sheet with nothing proposed says so, with its illustration', async () => {
    await mount(null)
    await click(container.querySelector('[aria-label="More"]'))
    const menu = await showLastSheet()
    await click([...menu.querySelectorAll('button')].find(b => /Everything the Coach proposed/.test(b.textContent)))
    const history = await showLastSheet()
    const empty = emptyOf(history)
    expect(empty.title).toBe('Nothing yet')
    expect(empty.body).toContain('Every plan, suggestion and debrief')
    expect(empty.art).not.toBeNull()
  })

  it('the comparison sheet with too few people sharing is an empty state', async () => {
    vi.mocked(cohortStats).mockResolvedValueOnce({ ok: false, sharing: true, people: 2, minPeople: 5 })
    await mount(null, null, { community: true })
    await click(byText(/^Compare$/))
    const empty = emptyOf(await showLastSheet())
    expect(empty.title).toBe('Not enough people are sharing yet')
    expect(empty.body).toBe('2 of 5 needed. Rope in your gym mates!')
    expect(empty.art).not.toBeNull()
  })

  it('the comparison sheet when the numbers are unavailable is an error, not an empty state', async () => {
    vi.mocked(cohortStats).mockResolvedValueOnce({ ok: false, sharing: true })
    await mount(null, null, { community: true })
    await click(byText(/^Compare$/))
    const sheet = await showLastSheet()
    expect(sheet.querySelector('[role=alert]').textContent).toContain('Not available right now.')
    expect(sheet.querySelector('.empty')).toBeNull()
  })

  it('the comparison sheet with no shared exercise yet is a hint under the tiles', async () => {
    vi.mocked(cohortStats).mockResolvedValueOnce({ ok: true, sharing: true, people: 5, sessionsPerWeek: { you: 3, median: 3 }, rankPct: 50, exercises: [] })
    await mount(null, null, { community: true })
    await click(byText(/^Compare$/))
    const sheet = await showLastSheet()
    expect(sheet.querySelector('.inote').textContent).toBe('No exercise is trained by three or more people yet.')
    expect(sheet.querySelector('.empty')).toBeNull()
  })
})
