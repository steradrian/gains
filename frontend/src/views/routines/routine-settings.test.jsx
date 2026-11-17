// @vitest-environment happy-dom
// Issue #294 in Routine settings (the T5.8 menu's drawer; moved from views/RoutineEdit.progression
// .test.jsx, as the controls moved out of the editor): "Progression" (with its "No automatic
// progression" choice) and the Deload switch read like two settings for the same thing. They are
// not, and the drawer says how.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../sheets.jsx', () => ({ glyphPicker: vi.fn() }))

import RoutineSettings from './routine-settings.jsx'
import { DEF, useStore } from '../../store/useStore.js'
import { POLICY_DESC, POLICY_NAME } from '../../lib/progression.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host

function render(routine) {
  const S = JSON.parse(JSON.stringify(DEF))
  S.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [], ...routine }]
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<RoutineSettings id="r1" />))
}
const rowTitled = title => [...host.querySelectorAll('.g-glist-body')].find(b => b.querySelector('b')?.textContent === title)
const note = () => host.querySelector('.g-rt-note').textContent
const chosen = () => [...host.querySelectorAll('[role="radio"]')].filter(r => r.getAttribute('aria-checked') === 'true')

afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  root = null; host = null
})

describe('routine progression wording (#294)', () => {
  it('names the switch for what it is: a deload routine, whose workouts do not count', () => {
    render({})
    expect(rowTitled('Exclude from automatic progression')).toBeUndefined()
    const row = rowTitled('Deload routine')
    expect(row.querySelector('span').textContent).toBe('Its workouts do not count toward progression. They still show in history and statistics.')
  })

  it('says what the chosen progression does, "no automatic progression" included, and that it is the routine\'s default', () => {
    render({ prog: 'off' })
    expect(chosen()).toHaveLength(1)
    expect(chosen()[0].querySelector('b').textContent).toBe(POLICY_NAME.off)
    expect(chosen()[0].querySelector('.g-radio-body span').textContent).toBe(POLICY_DESC.off)
    expect(note()).toBe('Applies to every exercise in this routine that does not set its own rule.')
    act(() => root.unmount()); host.remove()
    render({})
    expect(chosen()[0].querySelector('b').textContent).toBe(POLICY_NAME.linear)
  })

  it('once it is a deload routine, says the progression choice does not apply to it', () => {
    render({ excludeFromProgression: true })
    expect(note()).toBe('A deload routine opens at the numbers set here, so the progression above does not apply to it. The next regular target continues from the last included workout.')
  })

  it('the switch still writes the same routine flag the session builder reads', () => {
    render({})
    const sw = host.querySelector('[role="switch"]')
    act(() => sw.click())
    expect(useStore.getState().S.routines[0].excludeFromProgression).toBe(true)
    act(() => host.querySelector('[role="switch"]').click())
    expect(useStore.getState().S.routines[0].excludeFromProgression).toBeUndefined()
  })
})
