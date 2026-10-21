// @vitest-environment happy-dom
// List or cards (S.exerciseView). The Exercises and By muscle pages on the stage are always rows,
// and the add-exercise picker (T5.1) is a drawer of rows with no cards button, whatever the setting
// says. What is left of the cards view is MuscleExplorer's (components/MuscleExplorer.jsx) and the
// grid CSS below.
import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'

const mounted = []
function render(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(node))
  return host
}
// Renders whatever sheet is on top and returns its host element.
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  return render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const toggle = host => host.querySelector('button[aria-label="Cards"]')
const setView = v => useStore.setState(s => ({ S: { ...s.S, exerciseView: v } }))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('exercise list or cards', () => {
  it('picker: the drawer keeps to rows and offers no cards button, whatever the setting says', () => {
    setView('cards')
    exercisePicker(vi.fn())
    const host = renderTop()
    expect(toggle(host)).toBeNull()
    expect(host.querySelector('.ex-grid')).toBeNull()
    expect(host.querySelectorAll('.g-pk-item').length).toBeGreaterThan(0)
  })

  // The desktop layout turns every #app list into two columns and forces every sheet list back
  // into one column, both on an id selector — the grid has to win over each of them.
  it('lays the cards out as a grid over the desktop two-column and the sheet column rules', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const rule = css.match(/^([^{}\n]*\.list\.ex-grid[^{}\n]*)\{([^}]*)\}/m)
    expect(rule?.[1]).toContain('#app .list.ex-grid')
    expect(rule[1]).toContain('#modal-root .list.ex-grid')
    expect(rule[2]).toContain('display:grid')
  })
})
