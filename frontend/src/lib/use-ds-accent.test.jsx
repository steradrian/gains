// @vitest-environment happy-dom
// useDsAccent: the design system preset for the stored accent, following the store as it changes.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useView } from '../ds/render.test-util.js'
import { DEF, useStore } from '../store/useStore.js'
import { useDsAccent } from './use-ds-accent.js'

const view = useView()
let originalS
beforeEach(() => {
  originalS = useStore.getState().S
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) })
})
afterEach(() => { useStore.setState({ S: originalS }) })

function Probe() {
  return <i data-accent={useDsAccent()} />
}
const shown = () => view.host.querySelector('i').getAttribute('data-accent')

describe('useDsAccent', () => {
  it('maps the stored accent and follows a change to it', () => {
    act(() => { useStore.getState().update(s => { s.accent = 'sky' }, false) })
    view.render(<Probe />)
    expect(shown()).toBe('cobalt')
    act(() => { useStore.getState().update(s => { s.accent = 'violet' }, false) })
    expect(shown()).toBe('plum')
    act(() => { useStore.getState().update(s => { s.accent = 'custom'; s.accentCustom = '#777777' }, false) })
    expect(shown()).toBe('ink')
  })
})
