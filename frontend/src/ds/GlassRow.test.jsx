// @vitest-environment happy-dom
// GlassRow: three lines and one trailing control. The boards draw it four ways (play, resume,
// done, rest); a row that goes nowhere is a plain card.
import { describe, expect, it, vi } from 'vitest'
import GlassRow from './GlassRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.firstElementChild

describe('GlassRow', () => {
  it('Up next: eyebrow, title and sub, a link with the one solid play control', () => {
    view.render(<GlassRow href="#/workout" eyebrow="Training today" title="Push A" sub="6 exercises · about 55 min" trailing="play" />)
    expect(row().tagName).toBe('A')
    expect(row().getAttribute('href')).toBe('#/workout')
    expect(row().textContent).toBe('Training todayPush A6 exercises · about 55 min')
    expect(row().querySelector('.g-trail-solid svg')).not.toBeNull()
  })

  it('running: the pill says Resume', () => {
    view.render(<GlassRow onClick={() => {}} eyebrow="Workout running · 24:18" title="Push A" sub="3 of 6 exercises done" trailing="resume" />)
    expect(row().querySelector('.g-trail-pill').textContent).toBe('Resume')
  })

  it('done is a 48px glass disc and rest a 40px one', () => {
    view.render(<GlassRow onClick={() => {}} title="Push A" trailing="check" />)
    expect(row().querySelector('.g-trail').className).toContain('g-trail-md')
    view.render(<GlassRow onClick={() => {}} title="Recover" trailing="chev" />)
    expect(row().querySelector('.g-trail').className).toContain('g-trail-sm')
  })

  it('draws a node as given and leaves the eyebrow and sub out when absent', () => {
    view.render(<GlassRow onClick={() => {}} title="Legs" trailing={<em>Mon</em>} />)
    expect(row().querySelector('em').textContent).toBe('Mon')
    expect(row().querySelectorAll('.g-grow-k')).toHaveLength(0)
  })

  it('calls onClick when it is a button', () => {
    const onClick = vi.fn()
    view.render(<GlassRow onClick={onClick} title="Push A" trailing="play" />)
    expect(row().tagName).toBe('BUTTON')
    click(row())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a plain card, no button or link, with neither', () => {
    view.render(<GlassRow title="Rest day" sub="Next: Legs, tomorrow" />)
    expect(row().tagName).toBe('DIV')
    expect(view.host.querySelector('button, a')).toBeNull()
  })
})
