// @vitest-environment happy-dom
// StageSegmented: a radio group on the stage. The lit option is the only tab stop, the arrow keys
// move the choice, and it is controlled with `value` or keeps its own.
import { act, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import StageSegmented from './StageSegmented.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const group = () => view.host.firstElementChild
const radios = () => [...view.host.querySelectorAll('[role="radio"]')]
const checked = () => radios().findIndex(r => r.getAttribute('aria-checked') === 'true')
const press = (el, key) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })

describe('StageSegmented', () => {
  it('is a labelled radio group of the options, the first lit unless told otherwise', () => {
    view.render(<StageSegmented label="Range" options={['Week', '30d', '90d']} />)
    expect(group().getAttribute('role')).toBe('radiogroup')
    expect(group().getAttribute('aria-label')).toBe('Range')
    expect(radios().map(r => r.textContent)).toEqual(['Week', '30d', '90d'])
    expect(checked()).toBe(0)
  })

  it('takes ariaLabel too, and label wins', () => {
    view.render(<StageSegmented ariaLabel="Chart range" options={['a', 'b']} />)
    expect(group().getAttribute('aria-label')).toBe('Chart range')
    view.render(<StageSegmented label="Range" ariaLabel="Chart range" options={['a', 'b']} />)
    expect(group().getAttribute('aria-label')).toBe('Range')
  })

  it('keeps its own choice when uncontrolled, and tells onChange', () => {
    const onChange = vi.fn()
    view.render(<StageSegmented label="Range" options={['Week', '30d', '90d']} onChange={onChange} />)
    click(radios()[2])
    expect(checked()).toBe(2)
    expect(onChange).toHaveBeenCalledWith('90d')
  })

  it('is controlled with value: it shows the value, and only the parent moves it', () => {
    const onChange = vi.fn()
    view.render(<StageSegmented label="Range" options={['Week', '30d', '90d']} value="30d" onChange={onChange} />)
    expect(checked()).toBe(1)
    click(radios()[0])
    expect(onChange).toHaveBeenCalledWith('Week')
    expect(checked()).toBe(1)
  })

  it('takes { value, label } options and drives the thumb with --n and --i', () => {
    view.render(<StageSegmented label="Range" options={[{ value: 'w', label: 'This week' }, { value: 'a', label: 'All time' }]} value="a" />)
    expect(radios().map(r => r.textContent)).toEqual(['This week', 'All time'])
    expect(group().style.getPropertyValue('--n')).toBe('2')
    expect(group().style.getPropertyValue('--i')).toBe('1')
    expect(group().querySelector('.g-sseg-thumb').getAttribute('aria-hidden')).toBe('true')
  })

  it('makes only the lit option a tab stop', () => {
    view.render(<StageSegmented label="Range" options={['a', 'b', 'c']} value="b" />)
    expect(radios().map(r => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('moves the choice and the focus with the arrow keys, wrapping, and with Home and End', () => {
    const onChange = vi.fn()
    view.render(<StageSegmented label="Range" options={['a', 'b', 'c']} onChange={onChange} />)
    press(radios()[0], 'ArrowRight')
    expect(checked()).toBe(1)
    expect(document.activeElement).toBe(radios()[1])
    expect(onChange).toHaveBeenLastCalledWith('b')
    press(radios()[1], 'ArrowDown')
    press(radios()[2], 'ArrowRight')
    expect(checked()).toBe(0)
    press(radios()[0], 'ArrowLeft')
    expect(checked()).toBe(2)
    press(radios()[2], 'Home')
    expect(checked()).toBe(0)
    press(radios()[0], 'End')
    expect(checked()).toBe(2)
  })

  it('leaves other keys alone', () => {
    view.render(<StageSegmented label="Range" options={['a', 'b']} />)
    press(radios()[0], 'x')
    expect(checked()).toBe(0)
  })

  it('mirrors Left and Right in right-to-left text', () => {
    view.host.setAttribute('dir', 'rtl')
    view.render(<StageSegmented label="Range" options={['a', 'b', 'c']} />)
    press(radios()[0], 'ArrowLeft')
    expect(checked()).toBe(1)
    press(radios()[1], 'ArrowRight')
    expect(checked()).toBe(0)
  })

  it('renders an option with an href as a link in the radio group', () => {
    view.render(<StageSegmented label="Range" options={[{ value: 'a', label: 'A', href: '#/a' }, 'b']} />)
    expect(radios()[0].tagName).toBe('A')
    expect(radios()[0].getAttribute('href')).toBe('#/a')
    expect(radios()[1].tagName).toBe('BUTTON')
  })

  it('works inside a parent that keeps the value', () => {
    function Host() {
      const [v, setV] = useState('b')
      return <StageSegmented label="Range" options={['a', 'b', 'c']} value={v} onChange={setV} />
    }
    view.render(<Host />)
    press(radios()[1], 'ArrowRight')
    expect(checked()).toBe(2)
  })
})
