// @vitest-environment happy-dom
// #110: an exercise's settings sheet in the routine editor offers Replace, and the picker it opens
// says what the pick is for.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXIDX } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet, exercisePicker } from './sheets.jsx'

const mounted = []
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
// A menu row's button holds its label and its detail line; the label is the bold part.
const button = (host, label) => [...host.querySelectorAll('button')].find(b => (b.querySelector('b') || b).textContent.trim() === label)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg' } }))
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('Replace exercise', () => {
  it('sits on the settings sheet of a routine exercise and closes it before handing over', () => {
    const onReplace = vi.fn()
    exConfigSheet(EXIDX['0025'], { sets: 3, mode: 'reps', reps: 10, weight: 60 }, vi.fn(), vi.fn(), null, null, onReplace)
    const host = renderTop()
    const replace = button(host, 'Replace exercise')
    expect(replace).toBeTruthy()
    act(() => replace.click())
    expect(onReplace).toHaveBeenCalledOnce()
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('names its save button after what saving does, when the caller says', () => {
    exConfigSheet(EXIDX['0289'], { sets: 3, mode: 'reps', reps: 10, weight: 30 }, vi.fn(), null, null, null, null, 'Replace')
    const host = renderTop()
    expect(button(host, 'Replace')).toBeTruthy()
    expect(button(host, 'Done')).toBeUndefined()
    exConfigSheet(EXIDX['0289'], { sets: 3, mode: 'reps', reps: 10, weight: 30 }, vi.fn(), null, null)
    expect(button(renderTop(), 'Done')).toBeTruthy()
    exConfigSheet(EXIDX['0289'], null, vi.fn(), null, null)
    expect(button(renderTop(), 'Add to routine')).toBeTruthy()
  })

  it('shows the Replace row with its line, and the Remove row naming an Undo only when the caller offers one', () => {
    exConfigSheet(EXIDX['0025'], { sets: 3, mode: 'reps', reps: 10, weight: 60 }, vi.fn(), vi.fn(), null, null, vi.fn())
    let host = renderTop()
    expect(button(host, 'Replace exercise').textContent).toContain('Similar exercises first')
    expect(button(host, 'Remove from routine').textContent).not.toContain('Undo')
    exConfigSheet(EXIDX['0025'], { sets: 3, mode: 'reps', reps: 10, weight: 60 }, vi.fn(), vi.fn(), null, null, null, null, { removeUndo: true })
    host = renderTop()
    expect(button(host, 'Remove from routine').textContent).toContain('Undo for 8 s')
  })

  it('Remove closes the sheet and hands over to the caller, who owns the Undo', () => {
    const onDelete = vi.fn()
    exConfigSheet(EXIDX['0025'], { sets: 3, mode: 'reps', reps: 10, weight: 60 }, vi.fn(), onDelete)
    // Rendered before the act: a render nested in the click's act does not flush.
    const remove = button(renderTop(), 'Remove from routine')
    act(() => remove.click())
    expect(onDelete).toHaveBeenCalledOnce()
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('is not offered where there is no slot to replace', () => {
    exConfigSheet(EXIDX['0025'], null, vi.fn(), null, null)
    expect(button(renderTop(), 'Replace exercise')).toBeUndefined()
  })

  it('titles the picker for what the pick is for', () => {
    exercisePicker(vi.fn(), { title: 'Replace exercise' })
    expect(renderTop().querySelector('h2').textContent).toBe('Replace exercise')
    exercisePicker(vi.fn())
    expect(renderTop().querySelector('h2').textContent).toBe('Add exercise')
  })
})
