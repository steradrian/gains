// @vitest-environment happy-dom
// BigStepper: a count a step at a time. The value, the stops, and the words all-the-caller's.
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import BigStepper from './BigStepper.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const less = () => view.host.querySelector('.g-bstep-row button:first-child')
const more = () => view.host.querySelector('.g-bstep-row button:last-child')
const shown = () => view.host.querySelector('.g-bstep-v b').textContent

describe('BigStepper', () => {
  it('shows the label, the value and its unit, and the hint under the row', () => {
    view.render(<BigStepper label="25 kg plates, pairs" value={2} unit="pairs" hint="Per side" lessLabel="Fewer" moreLabel="More" />)
    expect(view.host.querySelector('.g-bstep-l').textContent).toBe('25 kg plates, pairs')
    expect(shown()).toBe('2')
    expect(view.host.querySelector('.g-bstep-v span').textContent).toBe('pairs')
    expect(view.host.querySelector('.g-bstep-h').textContent).toBe('Per side')
  })

  it('is a group named by its label, and its buttons are named by the caller alone', () => {
    view.render(<BigStepper label="25 kg plates, pairs" value={2} lessLabel="Fewer 25 kg plates" moreLabel="More 25 kg plates" />)
    const group = view.host.querySelector('[role="group"]')
    expect(group.getAttribute('aria-labelledby')).toBe(view.host.querySelector('.g-bstep-l').id)
    expect(less().getAttribute('aria-label')).toBe('Fewer 25 kg plates')
    expect(more().getAttribute('aria-label')).toBe('More 25 kg plates')
  })

  it('has no English default for the buttons', () => {
    view.render(<BigStepper value={1} />)
    expect(less().hasAttribute('aria-label')).toBe(false)
    expect(more().hasAttribute('aria-label')).toBe(false)
    expect(view.host.querySelector('[role="group"]').hasAttribute('aria-labelledby')).toBe(false)
  })

  it('announces a change: the value is a polite live region', () => {
    view.render(<BigStepper value={1} />)
    expect(view.host.querySelector('.g-bstep-v').getAttribute('aria-live')).toBe('polite')
  })

  it('keeps its own value when uncontrolled, from min, and reports each change', () => {
    const onChange = vi.fn()
    view.render(<BigStepper min={1} onChange={onChange} />)
    expect(shown()).toBe('1')
    click(more())
    click(more())
    expect(shown()).toBe('3')
    click(less())
    expect(shown()).toBe('2')
    expect(onChange.mock.calls).toEqual([[2], [3], [2]])
  })

  it('follows the caller when controlled: a tap reports, the value waits for the caller', () => {
    const onChange = vi.fn()
    view.render(<BigStepper value={4} onChange={onChange} />)
    click(more())
    expect(onChange).toHaveBeenCalledWith(5)
    expect(shown()).toBe('4')
    function Held() {
      const [n, setN] = useState(4)
      return <BigStepper value={n} onChange={setN} />
    }
    view.render(<Held />)
    click(more())
    expect(shown()).toBe('5')
  })

  it('stops at min (0 by default) and at max, marking the end button disabled but keeping it a tab stop', () => {
    const onChange = vi.fn()
    view.render(<BigStepper value={0} max={2} onChange={onChange} />)
    expect(less().getAttribute('aria-disabled')).toBe('true')
    expect(less().disabled).toBe(false)
    click(less())
    expect(onChange).not.toHaveBeenCalled()
    view.render(<BigStepper value={2} max={2} onChange={onChange} />)
    expect(more().getAttribute('aria-disabled')).toBe('true')
    click(more())
    expect(onChange).not.toHaveBeenCalled()
    view.render(<BigStepper value={1} max={2} onChange={onChange} />)
    expect(less().hasAttribute('aria-disabled')).toBe(false)
    expect(more().hasAttribute('aria-disabled')).toBe(false)
  })

  it('steps by a fraction without drifting, and shows the step\'s places', () => {
    const onChange = vi.fn()
    view.render(<BigStepper value={0.2} step={0.1} onChange={onChange} />)
    expect(shown()).toBe('0.2')
    click(more())
    expect(onChange).toHaveBeenCalledWith(0.3)
    view.render(<BigStepper value={20} step={2.5} onChange={onChange} />)
    expect(shown()).toBe('20.0')
    view.render(<BigStepper value={20} step={2.5} decimals={0} />)
    expect(shown()).toBe('20')
  })

  it('the stage tone puts its buttons on the glass material, the light tone does not', () => {
    view.render(<BigStepper value={1} tone="stage" lessLabel="Less" moreLabel="More" />)
    expect(less().classList.contains('g-glass')).toBe(true)
    expect(more().classList.contains('g-glass')).toBe(true)
    view.render(<BigStepper value={1} lessLabel="Less" moreLabel="More" />)
    expect(less().classList.contains('g-glass')).toBe(false)
  })

  it('takes the stage tone', () => {
    view.render(<BigStepper value={1} tone="stage" />)
    expect(view.host.firstElementChild.classList.contains('g-bstep-stage')).toBe(true)
    expect(() => view.render(<BigStepper value={1} tone="dark" />)).toThrow()
  })
})
