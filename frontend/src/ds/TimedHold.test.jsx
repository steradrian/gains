// @vitest-environment happy-dom
// TimedHold (boards W1.41, W1.42): the ring with the side and the time left, Pause and Switch side,
// and a note. The countdown is the caller's; every string is too.
import { describe, expect, it, vi } from 'vitest'
import TimedHold from './TimedHold.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const pause = () => view.host.querySelector('.g-th-b.g-glass')
const swap = () => view.host.querySelector('.g-th-main')
const hold = (props = {}) => (
  <TimedHold
    side="Left side" left="0:18" detail="of 0:30 · round 1 of 2" progress={0.4} ringLabel="Left side, 18 seconds left"
    pauseLabel="Pause" resumeLabel="Resume" switchLabel="Switch side" {...props}
  />
)

describe('TimedHold', () => {
  it('draws the side, the time left and the line under it, and names the ring as a timer', () => {
    view.render(hold())
    const centre = view.host.querySelector('.g-th-c')
    expect(centre.querySelector('span').textContent).toBe('Left side')
    expect(centre.querySelector('b').textContent).toBe('0:18')
    expect(centre.querySelector('small').textContent).toBe('of 0:30 · round 1 of 2')
    const ring = view.host.querySelector('.g-th-ring')
    expect(ring.getAttribute('role')).toBe('timer')
    expect(ring.getAttribute('aria-label')).toBe('Left side, 18 seconds left')
  })

  it('runs the arc down as time goes: nothing gone is a full ring', () => {
    view.render(hold({ progress: 0 }))
    const arc = () => view.host.querySelector('.g-th-arc')
    expect(Number(arc().style.getPropertyValue('--o'))).toBe(0)
    const full = Number(arc().style.getPropertyValue('--c'))
    expect(full).toBeCloseTo(2 * Math.PI * 92, 5)
    view.render(hold({ progress: 0.4 }))
    expect(Number(arc().style.getPropertyValue('--o'))).toBeCloseTo(full * 0.4, 5)
    view.render(hold({ progress: 2 }))
    expect(Number(arc().style.getPropertyValue('--o'))).toBeCloseTo(full, 5)
  })

  it('takes its tone for the ring: white, mint or peach', () => {
    view.render(hold())
    expect(view.host.querySelector('.g-th').classList.contains('g-th-main')).toBe(true)
    view.render(hold({ tone: 'cool' }))
    expect(view.host.querySelector('.g-th').classList.contains('g-th-cool')).toBe(true)
    view.render(hold({ tone: 'warm' }))
    expect(view.host.querySelector('.g-th').classList.contains('g-th-warm')).toBe(true)
  })

  it('Pause says the caller\'s word, Resume when paused, and calls onPause', () => {
    const onPause = vi.fn()
    view.render(hold({ onPause, pauseLabel: 'Pause', resumeLabel: 'Reprendre' }))
    expect(pause().textContent).toBe('Pause')
    click(pause())
    expect(onPause).toHaveBeenCalledTimes(1)
    view.render(hold({ onPause, paused: true, pauseLabel: 'Pause', resumeLabel: 'Reprendre' }))
    expect(pause().textContent).toBe('Reprendre')
  })

  it('Switch side calls onSwitch, and is a link with an href', () => {
    const onSwitch = vi.fn()
    view.render(hold({ onSwitch }))
    expect(swap().tagName).toBe('BUTTON')
    expect(swap().textContent).toBe('Switch side')
    click(swap())
    expect(onSwitch).toHaveBeenCalledTimes(1)
    view.render(hold({ switchHref: '#/other' }))
    expect(swap().tagName).toBe('A')
  })

  it('has no Switch side for a hold with one side, and no note without one', () => {
    view.render(hold({ switchLabel: undefined }))
    expect(swap()).toBeNull()
    expect(view.host.querySelector('.g-th-note')).toBeNull()
    view.render(hold({ switchLabel: undefined, note: 'A chime at 0:00.' }))
    expect(view.host.querySelector('.g-th-note').textContent).toBe('A chime at 0:00.')
  })

  it('leaves out the side and the line when there are none', () => {
    view.render(hold({ side: undefined, detail: undefined }))
    const centre = view.host.querySelector('.g-th-c')
    expect(centre.querySelector('span')).toBeNull()
    expect(centre.querySelector('small')).toBeNull()
  })

  it('rejects an unknown tone while developing', () => {
    expect(() => view.render(hold({ tone: 'hot' }))).toThrow()
  })
})
