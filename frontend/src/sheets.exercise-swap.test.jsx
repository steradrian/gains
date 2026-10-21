// @vitest-environment happy-dom
// T5.7 Replace: a half drawer of the exercises that train the same muscle, with what you did last
// time only where it was logged, and Search all exercises opening the picker away from the same one.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB, EXIDX } from './lib/exercises.js'
import { exerciseNameFor } from './lib/i18n.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { topSurface } from './lib/sheet-nav.js'
import { replaceExerciseSheet } from './sheets.jsx'

const BENCH = EXIDX['0025']
const mounted = []
function renderTop() {
  const sheet = topSurface(useUI.getState().sheets)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const rows = host => [...host.querySelectorAll('.g-xrow')]
const nameOf = row => row.querySelector('.g-xrow-b b').textContent
const subOf = row => row.querySelector('.g-xrow-b > span').textContent
const logged = (id, w, r) => ({ id: 'w-' + id, d: '2026-10-01', start: Date.UTC(2026, 9, 1, 10), unit: 'kg', entries: [{ id, sets: [{ done: true, w, r, unit: 'kg' }] }] })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: { ...structuredClone(DEF), unit: 'kg' }, user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('replaceExerciseSheet', () => {
  it('is a half drawer titled for the exercise, saying what the list is', () => {
    replaceExerciseSheet(BENCH.id, vi.fn(), { routine: 'Push A' })
    const host = renderTop()
    expect(host.querySelector('.g-bs-half')).toBeTruthy()
    expect(host.querySelector('h2').textContent).toBe('Replace ' + exerciseNameFor(BENCH))
    expect(host.textContent).toContain('Similar exercises · same muscles, your equipment first')
  })

  it('lists exercises that train the same muscle, never the one being replaced', () => {
    replaceExerciseSheet(BENCH.id, vi.fn())
    const host = renderTop()
    const listed = rows(host).filter(r => r.tagName === 'BUTTON')
    expect(listed.length).toBeGreaterThan(1)
    const byName = new Map(EXDB.map(e => [exerciseNameFor(e), e]))
    for (const row of listed) {
      const ex = byName.get(nameOf(row))
      expect(ex.tg).toBe(BENCH.tg)
      expect(ex.id).not.toBe(BENCH.id)
    }
    // the same kit leads
    expect(subOf(listed[0]).endsWith(BENCH.eq)).toBe(true)
  })

  it('says "you did" only for an exercise that was logged with a load', () => {
    replaceExerciseSheet(BENCH.id, vi.fn())
    const first = rows(renderTop()).find(r => r.tagName === 'BUTTON')
    expect(subOf(first)).not.toContain('you did')
    const ex = EXDB.find(e => exerciseNameFor(e) === nameOf(first))
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, workouts: [logged(ex.id, 30, 10)] } }))
    replaceExerciseSheet(BENCH.id, vi.fn())
    const host = renderTop()
    const again = rows(host).find(r => nameOf(r) === nameOf(first))
    expect(subOf(again)).toMatch(/ · you did 30 kg × 10$/)
    // and only that row says it
    expect(rows(host).filter(r => subOf(r).includes('you did'))).toHaveLength(1)
  })

  it('a row replaces at once: it closes the drawer, then hands the exercise over as a quick pick', () => {
    const onPick = vi.fn()
    replaceExerciseSheet(BENCH.id, onPick)
    const host = renderTop()
    const first = rows(host).find(r => r.tagName === 'BUTTON')
    act(() => first.click())
    expect(onPick).toHaveBeenCalledOnce()
    expect(exerciseNameFor(onPick.mock.calls[0][0])).toBe(nameOf(first))
    expect(onPick.mock.calls[0][1]).toBe(true)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('Search all exercises opens the picker away from the same exercise; its pick closes both', () => {
    const onPick = vi.fn()
    replaceExerciseSheet(BENCH.id, onPick, { routine: 'Push A' })
    const host = renderTop()
    const search = [...host.querySelectorAll('button')].find(b => b.textContent === 'Search all exercises')
    act(() => search.click())
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
    const picker = renderTop()
    expect(picker.querySelector('h2').textContent).toBe('Replace exercise')
    expect(picker.querySelector('.g-bs-chip').textContent).toBe('Push A')
    const same = [...picker.querySelectorAll('.g-cchip')].find(c => c.textContent.startsWith('Same muscle'))
    expect(same.classList.contains('on')).toBe(true)
    act(() => picker.querySelector('.g-pk-item button.g-xrow').click())
    expect(onPick).toHaveBeenCalledOnce()
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})
