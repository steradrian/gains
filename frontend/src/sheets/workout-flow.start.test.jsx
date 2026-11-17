// @vitest-environment happy-dom
// The "+" sheet's Start workout (startOrResume): a planned day goes to Ready, never straight into
// the session, so a routine with a warm-up still gets its offer (review finding 11).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { setNav } from '../lib/nav.js'
import { todayISO } from '../lib/format.js'
import { startOrResume } from '../sheets.jsx'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = v => JSON.parse(JSON.stringify(v))
const nav = vi.fn()

beforeEach(() => { nav.mockClear(); setNav(nav) })
afterEach(() => { setNav(() => {}); useStore.setState({ S: clone(DEF) }) })

describe('startOrResume', () => {
  it('opens Ready for a planned day and starts nothing', () => {
    const S = clone(DEF)
    S.routines = [{ id: 'push', name: 'Push A', ex: [{ id: '0025', sets: 3, reps: 8, weight: 80 }] }]
    S.dayPlan = { [todayISO()]: 'push' }
    useStore.setState({ S, user: null })
    startOrResume()
    expect(useStore.getState().S.active).toBeNull()
    expect(nav.mock.calls[0][0]).toBe('/train/workout?start=push')
  })
})
