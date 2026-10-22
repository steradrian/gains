// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import DangerRow from './DangerRow.jsx'
import { click, useView } from './render.test-util.js'

describe('DangerRow', () => {
  const view = useView()

  it('is a button with a title and a line, and calls onClick', () => {
    const onClick = vi.fn()
    view.render(<DangerRow title="Start over" sub="Wipes your training data" onClick={onClick} />)
    const row = view.host.querySelector('button.g-danger-row')
    expect(row.textContent).toBe('Start overWipes your training data')
    click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a link with an href, and draws the hairline unless it is first', () => {
    view.render(<DangerRow first={false} title="Delete account" href="#/me/account/delete" />)
    const row = view.host.querySelector('a.g-danger-row')
    expect(row.getAttribute('href')).toBe('#/me/account/delete')
    expect(row.classList.contains('g-danger-line')).toBe(true)
  })
})
