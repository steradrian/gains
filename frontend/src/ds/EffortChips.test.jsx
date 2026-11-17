// @vitest-environment happy-dom
// EffortChips: reps in the tank as wrapping pills. A labelled radio group with one tab stop, the
// arrows move and choose; light in a drawer, stage under the set just done.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import EffortChips from './EffortChips.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const OPTIONS = ['0 · failure', '1', '2', '3', '4+']
const group = () => view.host.querySelector('[role="radiogroup"]')
const chips = () => [...view.host.querySelectorAll('[role="radio"]')]
const checked = () => chips().filter(c => c.getAttribute('aria-checked') === 'true').map(c => c.textContent)
const key = (el, k) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })

describe('EffortChips', () => {
  it('is a radio group named by the label the caller gives, with a pill for each option', () => {
    view.render(<EffortChips options={OPTIONS} label="How hard was that set? Reps left in the tank" hint="Optional" />)
    expect(document.getElementById(group().getAttribute('aria-labelledby')).textContent).toBe('How hard was that set? Reps left in the tank')
    expect(document.getElementById(group().getAttribute('aria-describedby')).textContent).toBe('Optional')
    expect(chips().map(c => c.textContent)).toEqual(OPTIONS)
    expect(chips().map(c => c.tagName)).toEqual(Array(5).fill('BUTTON'))
    expect(checked()).toEqual([])
  })

  it('marks the value, takes { value, label } options, and has one tab stop (the chosen pill, else the first)', () => {
    view.render(<EffortChips options={[{ value: 0, label: '0 · failure' }, { value: 1, label: '1' }]} value={1} onChange={() => {}} label="RIR" />)
    expect(checked()).toEqual(['1'])
    expect(chips().map(c => c.tabIndex)).toEqual([-1, 0])
    view.render(<EffortChips options={OPTIONS} value={null} onChange={() => {}} label="RIR" />)
    expect(chips().map(c => c.tabIndex)).toEqual([0, -1, -1, -1, -1])
  })

  it('keeps its own answer when uncontrolled, and tells onChange', () => {
    const onChange = vi.fn()
    view.render(<EffortChips options={OPTIONS} label="RIR" onChange={undefined} />)
    click(chips()[2])
    expect(checked()).toEqual(['2'])
    view.render(<EffortChips options={OPTIONS} label="RIR" value="3" onChange={onChange} />)
    click(chips()[4])
    expect(onChange).toHaveBeenCalledWith('4+')
    expect(checked()).toEqual(['3'])
  })

  it('moves and chooses with the arrows, wrapping round, and moves focus with it', () => {
    const onChange = vi.fn()
    view.render(<EffortChips options={OPTIONS} label="RIR" value="1" onChange={onChange} />)
    key(chips()[1], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('2')
    expect(document.activeElement).toBe(chips()[2])
    key(chips()[1], 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('0 · failure')
    key(chips()[0], 'ArrowUp')
    expect(onChange).toHaveBeenLastCalledWith('4+')
    key(chips()[4], 'ArrowDown')
    expect(onChange).toHaveBeenLastCalledWith('0 · failure')
    onChange.mockClear()
    key(chips()[1], 'a')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tone stage adds the stage class; light does not', () => {
    view.render(<EffortChips options={OPTIONS} label="RIR" tone="stage" />)
    expect(view.host.firstElementChild.classList.contains('g-effort-stage')).toBe(true)
    view.render(<EffortChips options={OPTIONS} label="RIR" />)
    expect(view.host.firstElementChild.classList.contains('g-effort-stage')).toBe(false)
  })

  it('draws no label or hint line when the caller gives none', () => {
    view.render(<EffortChips options={OPTIONS} />)
    expect(view.host.querySelector('.g-effort-l')).toBeNull()
    expect(view.host.querySelector('.g-effort-h')).toBeNull()
    expect(group().hasAttribute('aria-labelledby')).toBe(false)
  })
})
