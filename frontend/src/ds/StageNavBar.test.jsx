// @vitest-environment happy-dom
// StageNavBar: a named glass Back, the centred title, and trailing glass icon buttons named by
// their outcome; each is a button, or a link when it has an href.
import { describe, expect, it, vi } from 'vitest'
import StageNavBar from './StageNavBar.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const back = () => view.host.querySelector('.g-snav-back')
const ends = () => [...view.host.querySelectorAll('.g-snav-end > *')]

describe('StageNavBar', () => {
  it('says the title as the page heading, with a Back named "Back"', () => {
    view.render(<StageNavBar title="Notifications" onBack={() => {}} />)
    expect(view.host.querySelector('h1').textContent).toBe('Notifications')
    expect(back().getAttribute('aria-label')).toBe('Back')
    expect(back().tagName).toBe('BUTTON')
    expect(back().classList.contains('g-glass')).toBe(true)
  })

  it('names Back for where it goes when told', () => {
    view.render(<StageNavBar title="Mon 19 Oct" onBack={() => {}} backLabel="Back to Train" />)
    expect(back().getAttribute('aria-label')).toBe('Back to Train')
  })

  it('calls onBack, and is a link with backHref', () => {
    const onBack = vi.fn()
    view.render(<StageNavBar title="x" onBack={onBack} />)
    click(back())
    expect(onBack).toHaveBeenCalledTimes(1)
    view.render(<StageNavBar title="x" backHref="#/train" />)
    expect(back().tagName).toBe('A')
    expect(back().getAttribute('href')).toBe('#/train')
  })

  it('draws no Back for a page that has nowhere to go back to', () => {
    view.render(<StageNavBar title="x" />)
    expect(back()).toBeNull()
  })

  it('keeps the middle empty, with no heading, when the page passes no title', () => {
    view.render(<StageNavBar onBack={() => {}} />)
    expect(view.host.querySelector('h1')).toBeNull()
  })

  it('draws the actions as named glass buttons that call their handlers', () => {
    const onSettings = vi.fn()
    view.render(<StageNavBar title="x" onBack={() => {}} actions={[{ icon: 'gear', label: 'Reminder settings', onClick: onSettings }]} />)
    expect(ends().map(e => [e.tagName, e.getAttribute('aria-label'), e.classList.contains('g-glass')])).toEqual([['BUTTON', 'Reminder settings', true]])
    click(ends()[0])
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('draws an action with an href as a link, and two actions in the order given', () => {
    view.render(<StageNavBar title="x" onBack={() => {}} actions={[
      { icon: 'chevronLeft', label: 'Previous week', href: '#/week/1' },
      { icon: 'chevronRight', label: 'Next week', onClick: () => {} },
    ]} />)
    expect(ends().map(e => [e.tagName, e.getAttribute('aria-label')])).toEqual([['A', 'Previous week'], ['BUTTON', 'Next week']])
  })

  it('has no actions by default', () => {
    view.render(<StageNavBar title="x" onBack={() => {}} />)
    expect(ends()).toHaveLength(0)
  })
})
