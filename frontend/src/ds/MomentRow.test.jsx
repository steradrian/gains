// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import MomentRow from './MomentRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = props => view.render(<ul><MomentRow people={[{ uid: 'm', initial: 'M', tone: 'blue' }]} title="Mara finished Legs" detail="54 min" time="2 hours ago" {...props} /></ul>)
const pill = () => view.host.querySelector('button.g-btn')

describe('MomentRow', () => {
  it('draws the initial, title and a detail line with when it happened', () => {
    row({})
    expect(view.host.textContent).toContain('M')
    expect(view.host.querySelector('b').textContent).toBe('Mara finished Legs')
    expect(view.host.querySelector('.g-mrow-sub').textContent).toBe('54 min · 2 hours ago')
  })

  it('cheers through the Cheer pill, named for what it cheers', () => {
    const onCheer = vi.fn()
    row({ onCheer, cheerLabel: 'Cheer Mara finished Legs' })
    expect(pill().textContent).toBe('Cheer')
    expect(pill().getAttribute('aria-label')).toBe('Cheer Mara finished Legs')
    click(pill())
    expect(onCheer).toHaveBeenCalledTimes(1)
  })

  it('shows a still white Cheered after a cheer: nothing to tap, undo is the toast\'s', () => {
    row({ cheered: true })
    expect(pill()).toBeNull()
    const done = view.host.querySelector('.g-mrow-on')
    expect(done.textContent).toBe('Cheered')
    expect(done.tagName).toBe('SPAN')
  })

  it('has no pill on the person\'s own moment', () => {
    row({ mine: true })
    expect(view.host.querySelector('.g-btn')).toBeNull()
    expect(view.host.querySelector('.g-mrow-on')).toBeNull()
  })

  it('carries a kind tag only when given, and a ⋯ only with onMore', () => {
    row({})
    expect(view.host.querySelector('.g-tag')).toBeNull()
    expect(view.host.querySelector('.g-iconbtn')).toBeNull()
    const onMore = vi.fn()
    row({ kind: 'NEW BEST', onMore, moreLabel: 'Options for Mara finished Legs' })
    expect(view.host.querySelector('.g-tag').textContent).toBe('NEW BEST')
    click(view.host.querySelector('.g-iconbtn'))
    expect(onMore).toHaveBeenCalledTimes(1)
  })

  it('stacks several initials for a moment two people share', () => {
    view.render(<ul><MomentRow people={[{ uid: 'a', initial: 'A', tone: 'mint' }, { uid: 'i', initial: 'I', tone: 'orange' }]} title="You and Ioana trained together" /></ul>)
    expect(view.host.querySelectorAll('.g-mavatar')).toHaveLength(2)
  })
})
