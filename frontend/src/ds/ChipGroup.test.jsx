// @vitest-environment happy-dom
// ChipGroup: pill chips for a single choice. A named group of toggles, light or on the stage,
// wrapping or one scrolling row; controlled with `value` or keeping its own.
import { describe, expect, it, vi } from 'vitest'
import ChipGroup from './ChipGroup.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const group = () => view.host.firstElementChild
const chips = () => [...view.host.querySelectorAll('.g-cchip')]
const pressed = () => chips().filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.textContent)

describe('ChipGroup', () => {
  it('is a labelled group of toggles, the first one pressed unless told otherwise', () => {
    view.render(<ChipGroup label="Fasting plan" options={['16:8', '18:6', 'OMAD']} />)
    expect(group().getAttribute('role')).toBe('group')
    expect(group().getAttribute('aria-label')).toBe('Fasting plan')
    expect(chips().map(c => c.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON'])
    expect(pressed()).toEqual(['16:8'])
    expect(chips()[0].classList.contains('on')).toBe(true)
  })

  it('takes ariaLabel too, and label wins', () => {
    view.render(<ChipGroup ariaLabel="Muscle" options={['a']} />)
    expect(group().getAttribute('aria-label')).toBe('Muscle')
    view.render(<ChipGroup label="Group" ariaLabel="Muscle" options={['a']} />)
    expect(group().getAttribute('aria-label')).toBe('Group')
  })

  it('keeps its own choice when uncontrolled, and tells onChange', () => {
    const onChange = vi.fn()
    view.render(<ChipGroup label="Plan" options={['16:8', '18:6']} onChange={onChange} />)
    click(chips()[1])
    expect(pressed()).toEqual(['18:6'])
    expect(onChange).toHaveBeenCalledWith('18:6')
  })

  it('is controlled with value: only the parent moves it', () => {
    const onChange = vi.fn()
    view.render(<ChipGroup label="Plan" options={['16:8', '18:6']} value="16:8" onChange={onChange} />)
    click(chips()[1])
    expect(onChange).toHaveBeenCalledWith('18:6')
    expect(pressed()).toEqual(['16:8'])
  })

  it('takes { value, label } options, and a link for one with an href', () => {
    view.render(<ChipGroup label="Plan" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', href: '#/b' }]} value="b" />)
    expect(chips().map(c => c.textContent)).toEqual(['Alpha', 'Beta'])
    expect(chips()[1].tagName).toBe('A')
    expect(chips()[1].getAttribute('href')).toBe('#/b')
    expect(chips()[1].getAttribute('aria-current')).toBe('true')
    expect(chips()[0].hasAttribute('aria-current')).toBe(false)
  })

  it('scroll makes one row, and says so in the class the stylesheet clips', () => {
    view.render(<ChipGroup label="Muscle" options={['a', 'b']} />)
    expect(group().classList.contains('g-cgroup-scroll')).toBe(false)
    view.render(<ChipGroup label="Muscle" options={['a', 'b']} scroll />)
    expect(group().classList.contains('g-cgroup-scroll')).toBe(true)
  })

  it('is light unless tone is stage, and refuses another tone', () => {
    view.render(<ChipGroup label="Muscle" options={['a']} />)
    expect(group().classList.contains('g-cgroup-stage')).toBe(false)
    view.render(<ChipGroup label="Muscle" options={['a']} tone="stage" />)
    expect(group().classList.contains('g-cgroup-stage')).toBe(true)
    expect(() => view.render(<ChipGroup label="Muscle" options={['a']} tone="dark" />)).toThrow(/tone="dark"/)
  })

  it('stage chips are flat glass; light chips carry no glass attribute', () => {
    view.render(<ChipGroup label="Muscle" options={['a', { value: 'b', href: '#/b' }]} tone="stage" />)
    expect(chips().map(c => c.getAttribute('data-glass'))).toEqual(['flat', 'flat'])
    view.render(<ChipGroup label="Muscle" options={['a']} />)
    expect(chips()[0].hasAttribute('data-glass')).toBe(false)
  })

  it('multi takes several: each tap toggles its chip and hands over the list it leaves', () => {
    const onChange = vi.fn()
    view.render(<ChipGroup multi label="Intensifier" options={['a', 'b', 'c']} onChange={onChange} />)
    expect(pressed()).toEqual([])
    click(chips()[0])
    click(chips()[2])
    expect(pressed()).toEqual(['a', 'c'])
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c'], 'c')
    click(chips()[0])
    expect(pressed()).toEqual(['c'])
    expect(onChange).toHaveBeenLastCalledWith(['c'], 'a')
  })

  it('multi and controlled: the array value lights its chips, and only the parent moves them', () => {
    const onChange = vi.fn()
    view.render(<ChipGroup multi label="Intensifier" options={['a', 'b', 'c']} value={['a', 'b']} onChange={onChange} />)
    expect(pressed()).toEqual(['a', 'b'])
    click(chips()[1])
    expect(onChange).toHaveBeenCalledWith(['a'], 'b')
    expect(pressed()).toEqual(['a', 'b'])
  })

  it('has no options and renders an empty group', () => {
    view.render(<ChipGroup label="Muscle" />)
    expect(chips()).toHaveLength(0)
  })
})
