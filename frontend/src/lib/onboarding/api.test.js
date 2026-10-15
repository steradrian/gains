// The onboarding's wire format (ux-onboarding §3b) and how the client reads the server's answers.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { answersFromHub, checkInvite, completeOnboarding, previewTargets, saveStep, stepAnswers } from './api.js'

const answers = {
  goal: 'lose',
  body: { sex: 'female', birthYear: 1990, heightCm: null, weightKg: 64 },
  activity: { value: 'sitting', source: 'default' },
  units: { weight: 'kg', height: 'cm', source: 'locale' },
  trainingDays: 3,
  plan: { kind: 'starter', templateId: 'full-body', weekdays: [1, 3, 5], equipment: 'gym', experience: 'new' },
}
const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body })
afterEach(() => { vi.unstubAllGlobals() })

describe('the §3b step bodies', () => {
  it('leaves an unanswered body field out, and carries activity and units with their source', () => {
    expect(stepAnswers('body', answers)).toEqual({
      sex: 'female', birthYear: 1990, weightKg: 64,
      activity: { value: 'sitting', source: 'default' }, units: { weight: 'kg', height: 'cm', source: 'locale' },
    })
  })

  it('sends training days (null when skipped), the goal and the plan union as they are', () => {
    expect(stepAnswers('training', { ...answers, trainingDays: undefined })).toEqual({ trainingDays: null })
    expect(stepAnswers('goal', answers)).toEqual({ goal: 'lose' })
    expect(stepAnswers('plan', answers)).toBe(answers.plan)
    expect(() => stepAnswers('about', answers)).toThrow()
  })

  it('reads the stored steps back into answers', () => {
    const back = answersFromHub({ goal: { goal: 'keep' }, body: { sex: 'male', units: { weight: 'lb', height: 'ft', source: 'user' } }, training: { trainingDays: 0 }, plan: { kind: 'none' } })
    expect(back).toEqual({
      goal: 'keep', body: { sex: 'male', birthYear: null, heightCm: null, weightKg: null },
      units: { weight: 'lb', height: 'ft', source: 'user' }, trainingDays: 0, plan: { kind: 'none' },
    })
    expect(answersFromHub(null)).toEqual({})
  })
})

describe('the requests', () => {
  it('PUTs one step, previews and completes on the person\'s date', async () => {
    const fetch = vi.fn(() => reply(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)
    await saveStep('goal', answers)
    await previewTargets(answers)
    await completeOnboarding('2026-10-15')
    const [put, preview, complete] = fetch.mock.calls
    expect(put[0]).toMatch(/\/hub\/api\/onboarding$/)
    expect(JSON.parse(put[1].body)).toEqual({ step: 'goal', answers: { goal: 'lose' } })
    expect(put[1].method).toBe('PUT')
    expect(Object.keys(JSON.parse(preview[1].body))).toEqual(['goal', 'body', 'training'])
    expect(JSON.parse(complete[1].body)).toEqual({ today: '2026-10-15' })
  })

  it('says why a request failed: the server refused, it was already complete, or no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(400, { error: 'bad' })))
    await expect(saveStep('goal', answers)).rejects.toMatchObject({ status: 400, code: 'http' })
    vi.stubGlobal('fetch', vi.fn(() => reply(409, { error: 'done', code: 'complete' })))
    await expect(completeOnboarding('2026-10-15')).rejects.toMatchObject({ code: 'complete' })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    await expect(saveStep('goal', answers)).rejects.toMatchObject({ status: 0, code: 'offline' })
  })

  it('checks an invite: an unknown code is invalid, no answer is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { status: 'valid', inviterName: 'Andrei', suggestedName: 'Maria' })))
    await expect(checkInvite('AB12')).resolves.toEqual({ status: 'valid', inviterName: 'Andrei', suggestedName: 'Maria' })
    vi.stubGlobal('fetch', vi.fn(() => reply(404, { error: 'no such invite' })))
    await expect(checkInvite('ZZ99')).resolves.toEqual({ status: 'invalid', inviterName: null, suggestedName: null })
    vi.stubGlobal('fetch', vi.fn(() => reply(429, { error: 'slow down' })))
    await expect(checkInvite('AB12')).rejects.toMatchObject({ code: 'unavailable' })
  })
})
