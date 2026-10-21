// @vitest-environment happy-dom
// #282: a single routine goes to paper — the browser's print dialog on the web, the native print
// flow in the app. Moved from views/RoutineEdit.print.test.jsx: the editor's Print button is now
// the routine menu's Share › Print / Save as PDF (sheets/routine-menu.jsx printRoutine), whose
// drawer sheets.routine-menu.test.jsx covers, the disabled rows of an empty routine included.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ mobile: false, printHtml: null }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../lib/plan-share.js', async importOriginal => ({ ...await importOriginal(), printPlan: vi.fn() }))
vi.mock('../../lib/mobile.js', async importOriginal => {
  const real = await importOriginal()
  env.printHtml = vi.fn(() => Promise.resolve())
  return { ...real, get MOBILE() { return env.mobile }, printHtml: env.printHtml }
})

import { printRoutine } from '../../sheets.jsx'
import { DEF, useStore } from '../../store/useStore.js'
import { printPlan } from '../../lib/plan-share.js'

function seed(name = 'Push day') {
  const S = JSON.parse(JSON.stringify(DEF))
  S.routines = [{ id: 'r1', name, emoji: 'dumbbell', ex: [{ id: '0025', sets: 3, mode: 'reps', reps: 5, weight: 80 }] }]
  useStore.setState({ S, user: { id: 'u1', name: 'Ana' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  env.mobile = false
})

describe('print one routine (#282)', () => {
  it('opens the print dialog with this routine alone on the web', () => {
    seed()
    printRoutine('r1')
    expect(printPlan).toHaveBeenCalledOnce()
    const [S, owner, opts] = printPlan.mock.calls[0]
    expect(S.routines[0].id).toBe('r1')
    expect(owner).toBe('Ana')
    expect(opts).toEqual({ routineId: 'r1' })
    expect(env.printHtml).not.toHaveBeenCalled()
  })

  it('hands the page to the native print flow in the app, named after the routine', () => {
    env.mobile = true
    seed()
    printRoutine('r1')
    expect(printPlan).not.toHaveBeenCalled()
    expect(env.printHtml).toHaveBeenCalledOnce()
    const [html, name] = env.printHtml.mock.calls[0]
    expect(name).toBe('Push day')
    expect(html).toContain('<title>Push day</title>')
    expect(html).not.toContain('Week schedule')
  })

  it('names the print job even when the routine has no name, which Android refuses', () => {
    env.mobile = true
    seed('')
    printRoutine('r1')
    expect(env.printHtml.mock.calls[0][1]).toBe('Routine')
  })

  it('does nothing for a routine that is gone', () => {
    seed()
    printRoutine('nope')
    expect(printPlan).not.toHaveBeenCalled()
    expect(env.printHtml).not.toHaveBeenCalled()
  })
})
