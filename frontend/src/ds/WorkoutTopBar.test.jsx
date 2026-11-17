// @vitest-environment happy-dom
// WorkoutTopBar (boards W1.0, W1.29, W1.28, W1.30): Minimise (or ×), the title over the clock or a
// line, and the white pill at the end. Every string and spoken name is the caller's.
import { describe, expect, it, vi } from 'vitest'
import WorkoutTopBar from './WorkoutTopBar.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const left = () => view.host.querySelector('.g-wtop-btn')
const finish = () => view.host.querySelector('.g-wtop-finish')

describe('WorkoutTopBar', () => {
  it('draws the title, the clock and the pill, with the caller\'s words for the glass button', () => {
    view.render(<WorkoutTopBar title="Push A" clock="8:02" minimiseLabel="Réduire" finishLabel="Terminer" />)
    expect(view.host.querySelector('.g-wtop-title').textContent).toBe('Push A')
    expect(view.host.querySelector('.g-wtop-clock').textContent).toBe('8:02')
    expect(left().getAttribute('aria-label')).toBe('Réduire')
    expect(left().classList.contains('g-glass')).toBe(true)
    expect(finish().textContent).toBe('Terminer')
  })

  it('calls onMinimise and onFinish', () => {
    const onMinimise = vi.fn()
    const onFinish = vi.fn()
    view.render(<WorkoutTopBar title="Push A" clock="8:02" minimiseLabel="Minimise" onMinimise={onMinimise} finishLabel="Finish" onFinish={onFinish} />)
    click(left())
    click(finish())
    expect(onMinimise).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('both ends are links with an href', () => {
    view.render(<WorkoutTopBar title="Push A" minimiseLabel="Minimise" minimiseHref="#/train" finishLabel="Finish" finishHref="#/finish" />)
    expect(left().tagName).toBe('A')
    expect(left().getAttribute('href')).toBe('#/train')
    expect(finish().tagName).toBe('A')
    expect(finish().getAttribute('href')).toBe('#/finish')
  })

  it('draws the status line under the clock with its own glyph, and nothing without one', () => {
    view.render(<WorkoutTopBar title="Push A" clock="24:18" status="Offline · 6 waiting" minimiseLabel="Minimise" finishLabel="Finish" />)
    const status = view.host.querySelector('.g-wtop-status')
    expect(status.textContent).toBe('Offline · 6 waiting')
    expect(status.querySelector('svg')).not.toBeNull()
    view.render(<WorkoutTopBar title="Push A" clock="24:18" minimiseLabel="Minimise" finishLabel="Finish" />)
    expect(view.host.querySelector('.g-wtop-status')).toBeNull()
  })

  it('the editor closes with × named closeLabel, and never calls onMinimise', () => {
    const onMinimise = vi.fn()
    const onClose = vi.fn()
    view.render(
      <WorkoutTopBar title="Editing · Sat 17 Oct" closeIcon minimiseLabel="Minimise" onMinimise={onMinimise} closeLabel="Close editor" onClose={onClose} finishLabel="Save" />,
    )
    expect(left().getAttribute('aria-label')).toBe('Close editor')
    click(left())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onMinimise).not.toHaveBeenCalled()
    expect(view.host.querySelector('.g-wtop-clock')).toBeNull()
  })

  it('shows a clock of 0 and leaves an empty one out', () => {
    view.render(<WorkoutTopBar title="Push A" clock={0} minimiseLabel="Minimise" finishLabel="Finish" />)
    expect(view.host.querySelector('.g-wtop-clock').textContent).toBe('0')
    view.render(<WorkoutTopBar title="Push A" clock="" minimiseLabel="Minimise" finishLabel="Finish" />)
    expect(view.host.querySelector('.g-wtop-clock')).toBeNull()
  })
})
