// @vitest-environment happy-dom
// SetStepper (board W1.2): a − value + tile; the value can be stepped or typed. The buttons' spoken
// names are the caller's.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import SetStepper from './SetStepper.jsx'
import { click, type, useView } from './render.test-util.js'

const view = useView()
// React hears a blur as focusout
const leave = () => act(() => { input().dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
const less = () => view.host.querySelector('.g-sst-b[aria-label^="Less"]')
const more = () => view.host.querySelector('.g-sst-b[aria-label^="More"]')
const input = () => view.host.querySelector('.g-sst-v')
const stepper = (props = {}) => (
  <SetStepper label="kg" defaultValue={80} step={2.5} hint="2.5 kg steps" lessLabel="Less kg" moreLabel="More kg" {...props} />
)

describe('SetStepper', () => {
  it('draws the label, the value, the hint and the two named buttons', () => {
    view.render(stepper())
    expect(view.host.querySelector('.g-sst-l').textContent).toBe('kg')
    expect(input().value).toBe('80')
    expect(view.host.querySelector('.g-sst-h').textContent).toBe('2.5 kg steps')
    expect(less().getAttribute('aria-label')).toBe('Less kg')
    expect(more().getAttribute('aria-label')).toBe('More kg')
    expect(view.host.querySelector('[role="group"]').getAttribute('aria-label')).toBe('kg')
    expect(input().getAttribute('aria-label')).toBe('kg')
  })

  it('shows an empty field when blank, and a tap counts from the value', () => {
    const onChange = vi.fn()
    view.render(stepper({ value: 0, blank: true, step: 0.5, onChange }))
    expect(input().value).toBe('')
    click(more())
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('takes the spoken names from the caller, whatever the language', () => {
    view.render(stepper({ label: 'Reps', lessLabel: 'Moins de répétitions', moreLabel: 'Plus de répétitions' }))
    expect(view.host.querySelector('.g-sst-b').getAttribute('aria-label')).toBe('Moins de répétitions')
    expect([...view.host.querySelectorAll('.g-sst-b')].at(-1).getAttribute('aria-label')).toBe('Plus de répétitions')
  })

  it('steps by `step` and tells onChange, when it keeps its own value', () => {
    const onChange = vi.fn()
    view.render(stepper({ onChange }))
    click(more())
    expect(input().value).toBe('82.5')
    expect(onChange).toHaveBeenLastCalledWith(82.5)
    click(less())
    click(less())
    expect(input().value).toBe('77.5')
    expect(onChange).toHaveBeenLastCalledWith(77.5)
  })

  it('shows the value it is given when controlled, and only asks', () => {
    const onChange = vi.fn()
    view.render(stepper({ value: 80, onChange }))
    click(more())
    expect(onChange).toHaveBeenCalledWith(82.5)
    expect(input().value).toBe('80')
  })

  it('stops at min (0 unless given)', () => {
    const onChange = vi.fn()
    view.render(stepper({ defaultValue: 1, step: 2.5, onChange }))
    click(less())
    expect(input().value).toBe('0')
    expect(onChange).toHaveBeenLastCalledWith(0)
    view.render(stepper({ defaultValue: 5, step: 1, min: 5, onChange }))
    click(less())
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('does not drift on fractional steps', () => {
    view.render(stepper({ defaultValue: 0.1, step: 0.1, decimals: 1 }))
    click(more())
    click(more())
    expect(input().value).toBe('0.3')
  })

  it('shows as many places as `decimals` says, or one when the step is fractional', () => {
    view.render(stepper({ defaultValue: 80, step: 2.5 }))
    expect(input().value).toBe('80')
    view.render(stepper({ value: 82.5, step: 2.5 }))
    expect(input().value).toBe('82.5')
    view.render(stepper({ value: 82.25, step: 1, decimals: 2 }))
    expect(input().value).toBe('82.25')
    view.render(stepper({ value: 82.25, step: 1 }))
    expect(input().value).toBe('82')
  })

  it('a typed number is accepted as it is typed, a comma too, and the text is tidied on blur', () => {
    const onChange = vi.fn()
    view.render(stepper({ onChange }))
    type(input(), '92,5')
    expect(onChange).toHaveBeenLastCalledWith(92.5)
    expect(input().value).toBe('92,5')
    leave()
    expect(input().value).toBe('92.5')
  })

  it('ignores text that is not a number, and a number under min', () => {
    const onChange = vi.fn()
    view.render(stepper({ onChange }))
    type(input(), 'abc')
    type(input(), '')
    type(input(), '-5')
    expect(onChange).not.toHaveBeenCalled()
    leave()
    expect(input().value).toBe('80')
  })

  it('asks for the decimal keyboard', () => {
    view.render(stepper())
    expect(input().getAttribute('inputmode')).toBe('decimal')
  })

  it('has no hint line without a hint', () => {
    view.render(stepper({ hint: undefined }))
    expect(view.host.querySelector('.g-sst-h')).toBeNull()
  })
})
