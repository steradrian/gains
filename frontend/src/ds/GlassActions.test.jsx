// @vitest-environment happy-dom
// GlassActions: three or four round actions, each named by its label; a link with an href, a
// button with a handler; discs only while loading.
import { describe, expect, it, vi } from 'vitest'
import GlassActions from './GlassActions.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = sel => view.host.querySelector(sel)

const FOUR = [
  { icon: 'utensils', label: 'Log food', onClick: () => {} },
  { icon: 'scanBarcode', label: 'Scan', onClick: () => {} },
  { icon: 'droplet', label: 'Water', onClick: () => {} },
  { icon: 'scale', label: 'Weigh-in', href: '#/weigh-in' },
]

describe('GlassActions', () => {
  it('shows each action as a glass disc with its icon and its label under it', () => {
    view.render(<GlassActions items={FOUR} />)
    const acts = [...view.host.querySelectorAll('.g-gact')]
    expect(acts.map(a => a.textContent)).toEqual(['Log food', 'Scan', 'Water', 'Weigh-in'])
    expect(acts.map(a => a.querySelector('.g-glass [data-icon]').getAttribute('data-icon'))).toEqual(['utensils', 'scanBarcode', 'droplet', 'scale'])
  })

  it('makes a button of an action with a handler and a link of one with an href', () => {
    view.render(<GlassActions items={FOUR} />)
    const acts = [...view.host.querySelectorAll('.g-gact')]
    expect(acts.map(a => a.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'A'])
    expect(acts[3].getAttribute('href')).toBe('#/weigh-in')
  })

  it('calls the handler of the action tapped', () => {
    const onClick = vi.fn()
    view.render(<GlassActions items={[{ icon: 'play', label: 'Start', onClick }, ...FOUR.slice(1, 3)]} />)
    click(q('.g-gact'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('lays out as many columns as there are actions', () => {
    view.render(<GlassActions items={FOUR.slice(0, 3)} />)
    expect(q('.g-gacts').style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
    view.render(<GlassActions items={FOUR} />)
    expect(q('.g-gacts').style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))')
  })

  it('draws four bare discs while loading, none tappable', () => {
    view.render(<GlassActions loading />)
    expect(view.host.querySelectorAll('.g-gact-sk')).toHaveLength(4)
    expect(view.host.querySelectorAll('button, a')).toHaveLength(0)
    expect(q('.g-gacts').getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the number of actions it would show for the discs', () => {
    view.render(<GlassActions loading items={FOUR.slice(0, 3)} />)
    expect(view.host.querySelectorAll('.g-gact-sk')).toHaveLength(3)
  })
})
