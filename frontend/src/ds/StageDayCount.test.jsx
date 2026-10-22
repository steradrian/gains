// @vitest-environment happy-dom
// StageDayCount: a radio group of day counts; a tap commits, an arrow only moves the choice.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import StageDayCount from './StageDayCount.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const keys = () => [...view.host.querySelectorAll('[role="radio"]')]
const DAYS = [0, 1, 2, 3, 4, 5, 6]

describe('StageDayCount', () => {
  it('is one radio group, the chosen key checked and the only one in the tab order', () => {
    view.render(<StageDayCount values={DAYS} value={4} onPick={() => {}} labelledBy="q" />)
    expect(view.host.querySelector('[role="radiogroup"]').getAttribute('aria-labelledby')).toBe('q')
    expect(keys().map(k => k.textContent)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(keys().map(k => k.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'false', 'true', 'false', 'false'])
    expect(keys().map(k => k.tabIndex)).toEqual([-1, -1, -1, -1, 0, -1, -1])
    expect(keys()[4].classList.contains('on')).toBe(true)
  })

  it('starts the tab order on the first key when nothing is chosen, and names a key by labelOf', () => {
    view.render(<StageDayCount values={DAYS} value={null} onPick={() => {}} labelOf={n => (n === 0 ? 'Only food' : undefined)} />)
    expect(keys()[0].tabIndex).toBe(0)
    expect(keys()[0].getAttribute('aria-label')).toBe('Only food')
    expect(keys()[1].hasAttribute('aria-label')).toBe(false)
  })

  it('draws every key as flat glass, the chosen one included', () => {
    view.render(<StageDayCount values={DAYS} value={4} onPick={() => {}} />)
    expect(keys().every(k => k.dataset.glass === 'flat')).toBe(true)
  })

  it('commits a tap, and moves with an arrow without committing', () => {
    const onPick = vi.fn()
    view.render(<StageDayCount values={DAYS} value={2} onPick={onPick} />)
    click(keys()[3])
    expect(onPick).toHaveBeenLastCalledWith(3, { viaKey: false })
    keys()[2].focus()
    act(() => { keys()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(onPick).toHaveBeenLastCalledWith(3, { viaKey: true })
    expect(document.activeElement).toBe(keys()[3])
  })
})
