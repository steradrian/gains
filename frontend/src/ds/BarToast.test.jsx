// @vitest-environment happy-dom
// BarToast (boards W1.2, W1.7, W1.8, W1.39): a status line over the footer with a picture or a
// glyph and one action. It does not time itself out.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import BarToast from './BarToast.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const toast = () => view.host.querySelector('.g-btoast')
const action = () => view.host.querySelector('.g-btoast-a')

describe('BarToast', () => {
  it('is a status with the caller\'s message and a glyph, a check by default', () => {
    view.render(<BarToast message="Warm-up done · 3 exercises · 6 sets" />)
    expect(toast().getAttribute('role')).toBe('status')
    expect(view.host.querySelector('.g-btoast-m').textContent).toBe('Warm-up done · 3 exercises · 6 sets')
    expect(view.host.querySelector('.g-btoast-ic svg').getAttribute('data-icon')).toBe('check')
  })

  it('takes another glyph, or the exercise picture instead of one', () => {
    view.render(<BarToast message="New best" icon="trophy" />)
    expect(view.host.querySelector('.g-btoast-ic svg').getAttribute('data-icon')).toBe('trophy')
    view.render(<BarToast message="Next" image="data:image/svg+xml,x" />)
    expect(view.host.querySelector('.g-btoast-ic')).toBeNull()
    expect(view.host.querySelector('img.g-wkimg-sm')).not.toBeNull()
  })

  it('takes its message as children as well', () => {
    view.render(<BarToast><b>Round done</b></BarToast>)
    expect(view.host.querySelector('.g-btoast-m b').textContent).toBe('Round done')
  })

  it('has the action only when the caller names it, and calls onAction', () => {
    const onAction = vi.fn()
    view.render(<BarToast message="x" actionLabel="Retour" onAction={onAction} />)
    expect(action().textContent).toBe('Retour')
    expect(action().tagName).toBe('BUTTON')
    click(action())
    expect(onAction).toHaveBeenCalledTimes(1)
    view.render(<BarToast message="x" onAction={onAction} />)
    expect(action()).toBeNull()
  })

  it('the action is a link with an href', () => {
    view.render(<BarToast message="x" actionLabel="Trend" actionHref="#/progress/strength" />)
    expect(action().tagName).toBe('A')
  })

  it('is placed above the bar or above its rest row when asked, and a plain block otherwise', () => {
    view.render(<BarToast message="x" placement="footer" />)
    expect(toast().classList.contains('g-btoast-footer')).toBe(true)
    view.render(<BarToast message="x" placement="rest" />)
    expect(toast().classList.contains('g-btoast-rest')).toBe(true)
    view.render(<BarToast message="x" />)
    expect(toast().className).toBe('g-btoast')
  })

  it('stays until the caller takes it away', () => {
    vi.useFakeTimers()
    try {
      view.render(<BarToast message="x" />)
      act(() => { vi.advanceTimersByTime(60000) })
      expect(toast()).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects an unknown placement while developing', () => {
    expect(() => view.render(<BarToast message="x" placement="top" />)).toThrow()
  })
})
