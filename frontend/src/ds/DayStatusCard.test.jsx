// @vitest-environment happy-dom
// DayStatusCard: a Day page section with nothing to draw says so, with its tag, the planned
// stills and its buttons.
import { describe, expect, it, vi } from 'vitest'
import DayStatusCard from './DayStatusCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const card = () => view.host.querySelector('.g-dstat')

describe('DayStatusCard', () => {
  it('shows the title and the line, with no tag, stills or buttons unless given', () => {
    view.render(<DayStatusCard icon="moon" title="Rest day" body="Nothing planned." />)
    expect(card().querySelector('.g-dstat-b').textContent).toBe('Rest dayNothing planned.')
    expect(card().querySelector('.g-tag')).toBeNull()
    expect(card().querySelector('.g-dstat-stack')).toBeNull()
    expect(card().querySelector('.g-dstat-acts')).toBeNull()
    expect(card().querySelector('.g-dstat-ic').getAttribute('aria-hidden')).toBe('true')
  })

  it('draws the buttons in order, the solid one white, each calling its own tap', () => {
    const add = vi.fn(), skip = vi.fn()
    view.render(<DayStatusCard tone="warn" icon="calendar" title="Legs was planned, not logged"
      actions={[{ label: 'Add past workout', solid: true, onClick: add }, { label: 'Mark skipped', onClick: skip }]} />)
    expect(card().classList.contains('g-dstat-warn')).toBe(true)
    const buttons = [...card().querySelectorAll('.g-dstat-btn')]
    expect(buttons.map(b => b.textContent)).toEqual(['Add past workout', 'Mark skipped'])
    expect(buttons[0].classList.contains('solid')).toBe(true)
    click(buttons[1])
    expect(skip).toHaveBeenCalledTimes(1)
    expect(add).not.toHaveBeenCalled()
  })

  it('shows the planned stills as decoration, a missing picture as a dumbbell tile', () => {
    view.render(<DayStatusCard tone="warn" title="Legs" thumbs={['/a.jpg', null, '/c.jpg']} />)
    const stack = card().querySelector('.g-dstat-stack')
    expect(stack.getAttribute('aria-hidden')).toBe('true')
    expect(stack.querySelectorAll('img')).toHaveLength(2)
    expect(stack.querySelectorAll('i')).toHaveLength(1)
  })

  it('carries a tag, and greys a feature that is off', () => {
    view.render(<DayStatusCard tone="off" icon="utensils" title="Tracking off" body="You don’t track food." tag="Off" />)
    expect(card().classList.contains('g-dstat-off')).toBe(true)
    expect(card().querySelector('.g-tag-glass').textContent).toBe('Off')
  })
})
