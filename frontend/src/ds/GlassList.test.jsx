// @vitest-environment happy-dom
// GlassList: rows in one card. A row that goes somewhere is a button or a link with a chevron; one
// that only says something is neither, so nothing looks tappable that is not.
import { describe, expect, it, vi } from 'vitest'
import GlassList from './GlassList.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const rows = () => [...view.host.querySelectorAll('.g-glist-row')]

describe('GlassList', () => {
  it('a row with a handler is a button with a chevron and calls it', () => {
    const onClick = vi.fn()
    view.render(<GlassList items={[{ icon: 'lock', title: 'Sign in with password', sub: 'If you set one', onClick }]} />)
    expect(rows()[0].tagName).toBe('BUTTON')
    expect(rows()[0].querySelector('.g-glist-chev')).not.toBeNull()
    expect(rows()[0].textContent).toBe('Sign in with passwordIf you set one')
    click(rows()[0])
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('a row with haptic is a haptic host and still runs its handler once', () => {
    const onClick = vi.fn()
    view.render(<GlassList items={[{ title: 'Create a group', onClick, haptic: true }, { title: 'Join', onClick: () => {} }]} />)
    expect(rows().map(r => r.classList.contains('g-haptic'))).toEqual([true, false])
    click(rows()[0])
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('two rows with the same title are told apart by their key', () => {
    view.render(<GlassList items={[{ key: 'a', title: 'Pull A', sub: 'one' }, { key: 'b', title: 'Pull A', sub: 'two' }]} />)
    expect(rows().map(r => r.textContent)).toEqual(['Pull Aone', 'Pull Atwo'])
  })

  it('a row with an href is a link', () => {
    view.render(<GlassList items={[{ title: 'Settings', href: '#/me' }]} />)
    expect(rows()[0].tagName).toBe('A')
    expect(rows()[0].getAttribute('href')).toBe('#/me')
  })

  it('a row with neither is plain text: no button, no chevron', () => {
    view.render(<GlassList items={[{ icon: 'smartphone', title: 'Where is the code?', sub: 'On your other device' }]} />)
    expect(rows()[0].tagName).toBe('DIV')
    expect(view.host.querySelector('button, a')).toBeNull()
    expect(view.host.querySelector('.g-glist-chev')).toBeNull()
  })

  it('is glass on the stage and its own surface when light, and refuses another tone', () => {
    view.render(<GlassList items={[{ title: 'a' }]} />)
    expect(view.host.firstElementChild.classList.contains('g-glass')).toBe(true)
    view.render(<GlassList tone="light" items={[{ title: 'a' }]} />)
    expect(view.host.firstElementChild.classList.contains('g-glist-light')).toBe(true)
    expect(view.host.firstElementChild.classList.contains('g-glass')).toBe(false)
    expect(() => view.render(<GlassList tone="dark" items={[]} />)).toThrow(/tone="dark"/)
  })
})
