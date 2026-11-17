// @vitest-environment happy-dom
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Tabs from './Tabs.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tabs = () => [...view.host.querySelectorAll('[role="tab"]')]
const selected = () => tabs().filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.textContent)
const key = (el, k) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })

describe('Tabs', () => {
  it('is a tablist named by the caller, the first tab chosen and the only tab stop', () => {
    view.render(<Tabs options={['How to', 'Progress', 'History']} ariaLabel="Exercise views" />)
    const list = view.host.querySelector('.g-tabs')
    expect(list.getAttribute('role')).toBe('tablist')
    expect(list.getAttribute('aria-label')).toBe('Exercise views')
    expect(selected()).toEqual(['How to'])
    expect(tabs().map(b => b.tabIndex)).toEqual([0, -1, -1])
    expect(view.host.querySelector('.g-tabs-ink').getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps its own choice when uncontrolled', () => {
    view.render(<Tabs options={['A', 'B']} label="Views" />)
    click(tabs()[1])
    expect(selected()).toEqual(['B'])
    expect(view.host.querySelector('.g-tabs').getAttribute('aria-label')).toBe('Views')
  })

  it('follows value and onChange when controlled, with value/label options', () => {
    const onChange = vi.fn()
    const opts = [{ value: 'how', label: 'How to' }, { value: 'progress', label: 'Progress' }]
    view.render(<Tabs options={opts} value="how" onChange={onChange} controls="panel-1" />)
    click(tabs()[1])
    expect(onChange).toHaveBeenCalledWith('progress')
    expect(selected()).toEqual(['How to'])
    expect(tabs()[0].getAttribute('aria-controls')).toBe('panel-1')
  })

  it('moves with the arrow keys, wrapping, and Home and End', () => {
    const onChange = vi.fn()
    view.render(<Tabs options={['A', 'B', 'C']} onChange={onChange} />)
    key(tabs()[0], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('B')
    expect(document.activeElement).toBe(tabs()[1])
    key(tabs()[1], 'End')
    expect(onChange).toHaveBeenLastCalledWith('C')
    key(tabs()[2], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('A')
    key(tabs()[0], 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('C')
    key(tabs()[2], 'Home')
    expect(onChange).toHaveBeenLastCalledWith('A')
  })

  it('mirrors the arrows right to left', () => {
    const onChange = vi.fn()
    view.render(<div dir="rtl"><Tabs options={['A', 'B', 'C']} onChange={onChange} /></div>)
    key(tabs()[0], 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('B')
  })

  // The exercise drawer's Progress leaves the drawer: walking past it with the arrows must not
  // (docs/audits/gains-train-review.md #19).
  it('manual: the keys move the focus only, from the focused tab; a click chooses', () => {
    const onChange = vi.fn()
    view.render(<Tabs manual options={['A', 'B', 'C']} value="A" onChange={onChange} />)
    key(tabs()[0], 'ArrowRight')
    expect(document.activeElement).toBe(tabs()[1])
    key(tabs()[1], 'ArrowRight')
    expect(document.activeElement).toBe(tabs()[2])
    key(tabs()[2], 'Home')
    expect(document.activeElement).toBe(tabs()[0])
    key(tabs()[0], 'End')
    expect(document.activeElement).toBe(tabs()[2])
    expect(onChange).not.toHaveBeenCalled()
    expect(selected()).toEqual(['A'])
    click(tabs()[2])
    expect(onChange).toHaveBeenCalledWith('C')
  })
})
