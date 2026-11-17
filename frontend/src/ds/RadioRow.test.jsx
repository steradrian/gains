// @vitest-environment happy-dom
// RadioRow: one option of a choice. A radio that says whether it is checked; a button, or a link
// when it has somewhere to go.
import { describe, expect, it, vi } from 'vitest'
import RadioRow from './RadioRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.firstElementChild

describe('RadioRow', () => {
  it('is a radio button with its title and line, and calls onClick', () => {
    const onClick = vi.fn()
    view.render(<RadioRow title="Kilograms" sub="kg" onClick={onClick} />)
    expect(row().tagName).toBe('BUTTON')
    expect(row().getAttribute('role')).toBe('radio')
    expect(row().textContent).toBe('Kilogramskg')
    click(row())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('announces whether it is selected, and fills the mark when it is', () => {
    view.render(<RadioRow title="Kilograms" selected />)
    expect(row().getAttribute('aria-checked')).toBe('true')
    expect(row().querySelector('.g-radio-mark').classList.contains('on')).toBe(true)
    view.render(<RadioRow title="Kilograms" />)
    expect(row().getAttribute('aria-checked')).toBe('false')
    expect(row().querySelector('.g-radio-mark').classList.contains('on')).toBe(false)
  })

  it('hides the mark from a screen reader: the state is on the radio', () => {
    view.render(<RadioRow title="Kilograms" selected />)
    expect(row().querySelector('.g-radio-mark').getAttribute('aria-hidden')).toBe('true')
  })

  it('is a link with an href, and has no line without a sub', () => {
    view.render(<RadioRow title="Choose days" href="#/train/schedule" />)
    expect(row().tagName).toBe('A')
    expect(row().getAttribute('href')).toBe('#/train/schedule')
    expect(row().getAttribute('role')).toBe('radio')
    expect(row().querySelectorAll('.g-radio-body span')).toHaveLength(0)
  })

  it('passes tabIndex on, so a group can keep one tab stop', () => {
    view.render(<RadioRow title="Pounds" tabIndex={-1} />)
    expect(row().getAttribute('tabindex')).toBe('-1')
  })
})
