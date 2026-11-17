// @vitest-environment happy-dom
// useDsAccent: the design system preset for the stored accent and the resolved mode, following the
// store as it changes.
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
const set = mut => act(() => { useStore.getState().update(mut, false) })

describe('useDsAccent', () => {
  it('maps the stored accent and follows a change to it', () => {
    set(s => { s.accent = 'sky' })
    view.render(<Probe />)
    expect(shown()).toBe('cobalt')
    set(s => { s.accent = 'violet' })
    expect(shown()).toBe('iris')
    set(s => { s.accent = 'custom'; s.accentCustom = '#777777' })
    expect(shown()).toBe('ink')
  })

  it('an accent nobody picked is ink in dark and cobalt in light, and follows the theme setting', () => {
    set(s => { s.accent = null; s.theme = 'dark' })
    view.render(<Probe />)
    expect(shown()).toBe('ink')
    set(s => { s.theme = 'light' })
    expect(shown()).toBe('cobalt')
  })

  it('a pick is the same in both modes', () => {
    set(s => { s.accent = 'plum'; s.theme = 'dark' })
    view.render(<Probe />)
    expect(shown()).toBe('plum')
    set(s => { s.theme = 'light' })
    expect(shown()).toBe('plum')
  })
})
