// @vitest-environment happy-dom
// The Undo of End fast (useFasting.reopen): start the same fast again, then remove the ended one.
// A failure between the two must never leave the page idle while the server holds both fasts, and
// a delete whose answer was lost must not be rolled back into losing the fast altogether.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useNutrition } from './store.js'
import { useFasting } from './use-fasting.js'
import { createFakeNutriTrace, fixtureDay, fixtureFast, fixtureSettings } from './fake-nutritrace.js'
import { todayISO } from '../format.js'

const H = 3600 * 1000
const TODAY = todayISO()
let nt, ended

const open = () => nt.state.fasts.filter(f => !f.end_at)
const closed = () => nt.state.fasts.filter(f => f.end_at)

beforeEach(async () => {
  const start = new Date(Date.now() - 17 * H).toISOString()
  ended = fixtureFast(5, start, new Date().toISOString())
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY) }, settings: { ...fixtureSettings(), fastingEnabled: true }, fasts: [ended] })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useFasting.getState().reset()
  await useFasting.getState().load({ force: true })
})
afterEach(() => vi.unstubAllGlobals())

describe('reopen', () => {
  it('puts the ended fast back as the running one', async () => {
    const next = await useFasting.getState().reopen(ended)
    expect(useFasting.getState().active.id).toBe(next.id)
    expect(open()).toHaveLength(1)
    expect(closed()).toHaveLength(0)
  })

  it('offline after the start: the page shows the running fast, not idle, when the server holds both', async () => {
    nt.failNext('DELETE', '/nt/api/fasts/', 'offline')
    nt.failNext('DELETE', '/nt/api/fasts/', 'offline')
    await expect(useFasting.getState().reopen(ended)).rejects.toBeTruthy()
    expect(open()).toHaveLength(1)
    expect(closed()).toHaveLength(1)
    expect(useFasting.getState().active?.id).toBe(open()[0].id)
  })

  it('the delete is refused: the new fast is rolled back and the ended one stays', async () => {
    nt.failNext('DELETE', '/nt/api/fasts/', { status: 500 })
    await expect(useFasting.getState().reopen(ended)).rejects.toBeTruthy()
    expect(open()).toHaveLength(0)
    expect(closed().map(f => f.id)).toEqual([5])
    expect(useFasting.getState().active).toBeNull()
    expect(useFasting.getState().history.map(f => f.id)).toEqual([5])
  })

  it('the delete landed but its answer was lost: the Undo stands and the new fast is not deleted', async () => {
    nt.failNext('DELETE', '/nt/api/fasts/', { lost: true, status: 504 })
    const next = await useFasting.getState().reopen(ended)
    expect(open().map(f => f.id)).toEqual([next.id])
    expect(closed()).toHaveLength(0)
    expect(useFasting.getState().active.id).toBe(next.id)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(1)
  })

  it('the ended fast is already gone (404): the Undo still succeeds', async () => {
    nt.state.fasts = []
    const next = await useFasting.getState().reopen(ended)
    expect(useFasting.getState().active.id).toBe(next.id)
    expect(open()).toHaveLength(1)
  })
})
