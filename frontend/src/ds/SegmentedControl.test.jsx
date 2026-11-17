// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl from './SegmentedControl.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const buttons = () => [...view.host.querySelectorAll('.g-seg button')]
const pressed = () => buttons().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)

describe('SegmentedControl', () => {
  it('is a named group of pressed buttons, the first chosen by default, keeping its own choice', () => {
    view.render(<SegmentedControl options={['Recent', 'Saved meals', 'My foods']} label="Food source" />)
    const group = view.host.querySelector('.g-seg')
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-label')).toBe('Food source')
    expect(group.style.getPropertyValue('--n')).toBe('3')
    expect(pressed()).toEqual(['Recent'])
    click(buttons()[2])
    expect(pressed()).toEqual(['My foods'])
    expect(group.style.getPropertyValue('--i')).toBe('2')
  })

  it('follows value and onChange when controlled, with value/label options', () => {
    const onChange = vi.fn()
    const opts = [{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]
    view.render(<SegmentedControl options={opts} value="lb" onChange={onChange} />)
    expect(pressed()).toEqual(['Pounds'])
    click(buttons()[0])
    expect(onChange).toHaveBeenCalledWith('kg')
    expect(pressed()).toEqual(['Pounds'])
  })
})
