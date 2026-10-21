// @vitest-environment happy-dom
// StageSwitch: a switch that says whether it is on, is named by its caller, and toggles on a tap.
import { describe, expect, it, vi } from 'vitest'
import StageSwitch from './StageSwitch.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const sw = () => view.host.querySelector('button')

describe('StageSwitch', () => {
  it('is a switch button, off by default, named by the caller', () => {
    view.render(<StageSwitch label="Filter by equipment" />)
    expect(sw().getAttribute('role')).toBe('switch')
    expect(sw().getAttribute('aria-checked')).toBe('false')
    expect(sw().getAttribute('aria-label')).toBe('Filter by equipment')
    expect(sw().classList.contains('on')).toBe(false)
  })

  it('takes ariaLabel too, and label wins when both are given', () => {
    view.render(<StageSwitch ariaLabel="Reminders" />)
    expect(sw().getAttribute('aria-label')).toBe('Reminders')
    view.render(<StageSwitch label="Filter" ariaLabel="Other" />)
    expect(sw().getAttribute('aria-label')).toBe('Filter')
  })

  it('has no name of its own when the caller gives none', () => {
    view.render(<StageSwitch />)
    expect(sw().hasAttribute('aria-label')).toBe(false)
  })

  it('keeps its own state when uncontrolled, and reports each change', () => {
    const onChange = vi.fn()
    view.render(<StageSwitch label="x" onChange={onChange} />)
    click(sw())
    expect(sw().getAttribute('aria-checked')).toBe('true')
    expect(sw().classList.contains('on')).toBe(true)
    click(sw())
    expect(sw().getAttribute('aria-checked')).toBe('false')
    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  it('starts on with checked, and follows the caller when controlled', () => {
    const onChange = vi.fn()
    view.render(<StageSwitch label="x" checked onChange={onChange} />)
    expect(sw().getAttribute('aria-checked')).toBe('true')
    click(sw())
    expect(onChange).toHaveBeenCalledWith(false)
    expect(sw().getAttribute('aria-checked')).toBe('true')
    view.render(<StageSwitch label="x" checked={false} onChange={onChange} />)
    expect(sw().getAttribute('aria-checked')).toBe('false')
  })

  it('disabled ignores taps and says so', () => {
    const onChange = vi.fn()
    view.render(<StageSwitch label="x" disabled onChange={onChange} />)
    expect(sw().disabled).toBe(true)
    click(sw())
    expect(onChange).not.toHaveBeenCalled()
    expect(sw().getAttribute('aria-checked')).toBe('false')
  })

  it('disabled keeps its state and does not tell the caller', () => {
    const onChange = vi.fn()
    view.render(<StageSwitch label="x" checked disabled onChange={onChange} />)
    expect(sw().disabled).toBe(true)
    expect(sw().getAttribute('aria-checked')).toBe('true')
    click(sw())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hides its knob from a screen reader', () => {
    view.render(<StageSwitch label="x" />)
    expect(sw().querySelector('i').getAttribute('aria-hidden')).toBe('true')
  })
})
