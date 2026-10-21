// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import WhenChip from './WhenChip.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const chip = () => view.host.querySelector('.g-chip-when')

describe('WhenChip', () => {
  it('names the day and meal a log goes to, and changes them on a tap', () => {
    const onClick = vi.fn()
    view.render(<WhenChip day="Today" meal="Lunch" onClick={onClick} />)
    expect(chip().textContent).toBe('Logging to Today, Lunch')
    expect(chip().querySelector('b').textContent).toBe('Today, Lunch')
    expect(chip().getAttribute('aria-label')).toBe('Logging to Today, Lunch. Change meal')
    click(chip())
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('names the day alone when there is no meal', () => {
    view.render(<WhenChip day="Tue 13 Oct" />)
    expect(chip().textContent).toBe('Logging to Tue 13 Oct')
    expect(chip().getAttribute('aria-label')).toBe('Logging to Tue 13 Oct')
  })
})
