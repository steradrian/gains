// @vitest-environment happy-dom
// The Plan screen's Coach banner (T3.2) reads the pending review the Coach page reads: it shows
// while a review with something to apply is pending, Review goes to the Coach page, and Dismiss
// hides it with the same Undo as the Coach page.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_VERSION } from '../../../lib/coach.js'
import InlineBanner from '../../../ds/InlineBanner.jsx'
import { click, useView } from '../../../ds/render.test-util.js'
import { coachBannerOf, useCoachBanner } from './use-coach-banner.js'

const flag = vi.hoisted(() => ({ soon: false }))
vi.mock('../../../lib/coach-availability.js', () => ({ get COACH_COMING_SOON() { return flag.soon } }))
const mocks = vi.hoisted(() => ({ S: null, pending: null, job: null, config: null, nav: vi.fn(), toast: vi.fn(), active: [] }))
vi.mock('../../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, config: mocks.config, user: { id: 'u1' }, coachLocal: null, update: mut => mut(mocks.S) })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const ui = () => ({ toast: mocks.toast })
  const useUI = selector => (selector ? selector(ui()) : ui())
  useUI.getState = ui
  return { useUI, TOAST_ACTION_MS: 8000 }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../../../lib/coach-api.js', () => ({
  useCoachStatus: active => { mocks.active.push(active); return { pending: mocks.pending, job: mocks.job, refresh: vi.fn() } },
  resolvePending: vi.fn(() => Promise.resolve({})),
}))

const S = () => ({
  routines: [], week: {}, dayPlan: {}, workouts: [],
  coach: { consent: { agreedAt: '2026-07-01T00:00:00Z', version: CONSENT_VERSION }, profile: { goal: 'muscle' }, log: [], chat: [] },
})
const REVIEW = {
  id: 'r1', kind: 'review', summary: 'Legs to Monday because Friday was missed.',
  changes: [
    { id: 'a', type: 'week', target: { weekday: 1 }, before: null, after: null, why: 'missed' },
    { id: 'b', type: 'week', target: { weekday: 3 }, before: null, after: null, why: 'rest' },
  ],
}

// What PlanScreen draws from `usePlan().coach` (views/plan/PlanScreen.jsx).
function Banner() {
  const coach = useCoachBanner()
  return coach && <InlineBanner stage icon="chat" title={coach.title} body={coach.body}
    actions={[{ label: 'Review', solid: true, onClick: coach.onReview }, { label: 'Dismiss', onClick: coach.onDismiss }]} />
}

const view = useView()
const button = label => [...view.host.querySelectorAll('button')].find(b => b.textContent === label)

beforeEach(() => {
  vi.clearAllMocks()
  flag.soon = false
  mocks.S = S(); mocks.pending = null; mocks.job = null; mocks.config = { coach: { enabled: true } }; mocks.active = []
})

describe('coachBannerOf', () => {
  it('names the count and the reading, and that nothing moves yet', () => {
    expect(coachBannerOf(S(), REVIEW)).toMatchObject({
      title: 'Coach suggests 2 changes',
      body: 'Legs to Monday because Friday was missed. Nothing moves until you apply.',
      count: 2,
    })
  })

  it('is null with nothing pending, for a plan or a debrief, and when nothing can be applied', () => {
    expect(coachBannerOf(S(), null)).toBeNull()
    expect(coachBannerOf(S(), { id: 'p', kind: 'create', bundle: {} })).toBeNull()
    expect(coachBannerOf(S(), { id: 'd', kind: 'debrief' })).toBeNull()
    expect(coachBannerOf(S(), { ...REVIEW, changes: [{ id: 'c', type: 'sets', target: { routineId: 'gone', exId: '0001' }, why: 'x' }] })).toBeNull()
  })
})

describe('the Plan screen’s Coach banner', () => {
  it('appears when a review is pending, and Review opens the Coach page', () => {
    mocks.pending = REVIEW
    view.render(<Banner />)
    expect(view.host.textContent).toContain('Coach suggests 2 changes')
    expect(mocks.active.at(-1)).toBe(true)
    click(button('Review'))
    expect(mocks.nav).toHaveBeenCalledWith('/train/coach')
  })

  it('is hidden, and the status is not polled, while the Coach is coming soon', () => {
    flag.soon = true
    mocks.pending = REVIEW
    view.render(<Banner />)
    expect(view.host.textContent).toBe('')
    expect(mocks.active.at(-1)).toBe(false)
  })

  it('is not there with nothing pending, or while a job runs', () => {
    view.render(<Banner />)
    expect(view.host.textContent).toBe('')
    mocks.pending = REVIEW; mocks.job = { id: 'j1', kind: 'review' }
    view.render(<Banner />)
    expect(view.host.textContent).toBe('')
  })

  it('does not poll, or show, with Coach off', () => {
    mocks.config = { coach: { enabled: false } }
    mocks.pending = REVIEW
    view.render(<Banner />)
    expect(mocks.active.at(-1)).toBe(false)
    expect(view.host.textContent).toBe('')
  })

  it('Dismiss hides it with the Undo toast and sends nothing yet', async () => {
    vi.useFakeTimers()
    const { resolvePending } = await import('../../../lib/coach-api.js')
    mocks.pending = REVIEW
    view.render(<Banner />)
    click(button('Dismiss'))
    expect(mocks.toast).toHaveBeenCalledWith('Dismissed 2 suggestions. Your Plan stays as it is', expect.objectContaining({ action: 'Undo' }))
    view.render(<Banner />)
    expect(view.host.textContent).toBe('')
    expect(resolvePending).not.toHaveBeenCalled()
    act(() => { mocks.toast.mock.calls[0][1].onAction() })
    view.render(<Banner />)
    expect(view.host.textContent).toContain('Coach suggests 2 changes')
    vi.useRealTimers()
  })
})
