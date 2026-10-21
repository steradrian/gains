// @vitest-environment happy-dom
// StageSection: the title, and a right-hand value that is a link or button only when it goes
// somewhere.
import { describe, expect, it, vi } from 'vitest'
import StageSection from './StageSection.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const act = () => view.host.querySelector('.g-ssec-act')

describe('StageSection', () => {
  it('is a heading with a link on the right when it has an href', () => {
    view.render(<StageSection title="Food" action="See day" actionHref="#/eat" />)
    expect(view.host.querySelector('h2').textContent).toBe('Food')
    expect(act().tagName).toBe('A')
    expect(act().getAttribute('href')).toBe('#/eat')
  })

  it('is a button with a callback', () => {
    const onAction = vi.fn()
    view.render(<StageSection title="Food" action="See day" onAction={onAction} />)
    expect(act().tagName).toBe('BUTTON')
    click(act())
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('says a value without making it tappable', () => {
    view.render(<StageSection title="Water" action="1.25 of 2.5 L" />)
    expect(act().tagName).toBe('SPAN')
    expect(act().textContent).toBe('1.25 of 2.5 L')
    expect(view.host.querySelector('button, a')).toBeNull()
  })

  it('is the title alone with no action', () => {
    view.render(<StageSection title="Up next" />)
    expect(act()).toBeNull()
  })

  describe('variant', () => {
    it('label is the small heading over a group', () => {
      view.render(<StageSection variant="label" title="This week" />)
      expect(view.host.querySelector('.g-ssec').classList.contains('g-ssec-label')).toBe(true)
      expect(view.host.querySelector('h2').textContent).toBe('This week')
    })

    it('line is a status text, not a heading, with a glass pill button to act on it', () => {
      const onAction = vi.fn()
      view.render(<StageSection variant="line" title="2 new" action="Mark all read" onAction={onAction} />)
      expect(view.host.querySelector('h2')).toBeNull()
      expect(view.host.querySelector('.g-ssec-t').textContent).toBe('2 new')
      expect(view.host.querySelector('.g-ssec-t').getAttribute('aria-live')).toBe('polite')
      expect(act().tagName).toBe('BUTTON')
      expect(act().classList.contains('g-glass')).toBe(true)
      click(act())
      expect(onAction).toHaveBeenCalledTimes(1)
    })

    it('line says "Nothing unread" as plain text once there is nothing to mark', () => {
      view.render(<StageSection variant="line" title="All read" action="Nothing unread" />)
      expect(act().tagName).toBe('SPAN')
      expect(act().classList.contains('g-glass')).toBe(false)
      expect(view.host.querySelector('button, a')).toBeNull()
    })

    it('line keeps its live text element when "2 new" turns into "All read"', () => {
      view.render(<StageSection variant="line" title="2 new" action="Mark all read" onAction={() => {}} />)
      const text = view.host.querySelector('.g-ssec-t')
      view.render(<StageSection variant="line" title="All read" action="Nothing unread" />)
      expect(view.host.querySelector('.g-ssec-t')).toBe(text)
      expect(text.textContent).toBe('All read')
    })

    it('rejects a variant it has no style for', () => {
      expect(() => view.render(<StageSection variant="big" title="x" />)).toThrow(/variant="big"/)
    })
  })
})
