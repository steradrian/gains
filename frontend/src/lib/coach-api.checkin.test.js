// A review request files which weekly check-in it carried (review #4), so that only deciding that
// job's proposal marks the check-in read, and a review that carried none files that too.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ S: null, api: null }))
vi.mock('./demo.js', () => ({ DEMO: false, DEMO_SEEDED: 'gym_demo_seeded_v1', REPO: '' }))
vi.mock('./mobile.js', () => ({ MOBILE: false }))
vi.mock('./api.js', () => ({ api: (...a) => mocks.api(...a) }))
vi.mock('../store/useStore.js', () => ({
  useStore: {
    getState: () => ({
      S: mocks.S,
      coachLocal: null,
      update: fn => { const s = JSON.parse(JSON.stringify(mocks.S)); fn(s); mocks.S = s },
    }),
  },
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

const { requestReview } = await import('./coach-api.js')
const { markCheckInRead, pendingCheckIn } = await import('./coach-checkin.js')

beforeEach(() => {
  mocks.S = {
    weekStart: 1,
    coach: { lastReview: null },
    coachCheckIns: { '2026-10-12': { feel: 'hard', sleep: 'poor', note: '', _ts: 1000 } },
  }
  mocks.api = vi.fn(async () => ({ job: { id: 'job1' } }))
})

describe('requestReview and the check-in it carries', () => {
  it('sends the unread check-in without its stamp, and files it against the job', async () => {
    await requestReview('')
    const body = JSON.parse(mocks.api.mock.calls[0][1].body)
    expect(body.checkIn).toEqual({ week: '2026-10-12', feel: 'hard', sleep: 'poor' })
    expect(mocks.S.coach.checkInSent).toEqual({ jobId: 'job1', week: '2026-10-12', ts: 1000 })
  })

  it('files a review that carried nothing, so deciding it reads nothing', async () => {
    mocks.S.coachCheckIns = {}
    await requestReview('')
    expect(mocks.S.coach.checkInSent).toEqual({ jobId: 'job1', week: null, ts: null })
    mocks.S.coachCheckIns = { '2026-10-12': { feel: 'easy', _ts: 2000 } }
    markCheckInRead(mocks.S, 'job1')
    expect(pendingCheckIn(mocks.S)).toEqual({ week: '2026-10-12', feel: 'easy' })
  })

  it('files nothing when the request is refused', async () => {
    mocks.api = vi.fn(async () => { throw Object.assign(new Error('busy'), { status: 409 }) })
    await expect(requestReview('')).rejects.toThrow('busy')
    expect(mocks.S.coach.checkInSent).toBeUndefined()
  })
})
