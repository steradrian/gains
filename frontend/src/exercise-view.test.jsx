// @vitest-environment happy-dom
// List or cards (S.exerciseView). The Exercises and By muscle pages on the stage are always rows,
// and the add-exercise picker (T5.1) is a drawer of rows with no cards button, whatever the setting
// says.
import React, { act } from 'react'
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
})
