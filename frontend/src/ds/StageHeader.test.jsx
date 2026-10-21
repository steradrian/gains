// @vitest-environment happy-dom
// StageHeader: avatar, search pill and bell, each a named link or button; while the search is open
// the bell is its close; the unread dot shows for any count and not while searching.
import { describe, expect, it, vi } from 'vitest'
import StageHeader from './StageHeader.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = sel => view.host.querySelector(sel)
const avatar = () => q('.g-sbtn:not(.g-bell)')
const pill = () => q('.g-spill')
const bell = () => q('.g-bell')

describe('StageHeader', () => {
  it('names the three controls and shows the scoped placeholder', () => {
    view.render(<StageHeader initial="m" placeholder="Search food" unread={0} />)
    expect(avatar().getAttribute('aria-label')).toBe('Settings')
    expect(avatar().textContent).toBe('M')
    expect(pill().textContent).toBe('Search food')
    expect(bell().getAttribute('aria-label')).toBe('Notifications')
  })

  it('falls back to the letter A and the plain Search text', () => {
    view.render(<StageHeader />)
    expect(avatar().textContent).toBe('A')
    expect(pill().textContent).toBe('Search')
  })

  it('shows only the first letter of the initial', () => {
    view.render(<StageHeader initial="ștefan" />)
    expect(avatar().textContent).toBe('Ș')
  })

  it('puts a dot on the avatar for an alert, and says why in its name', () => {
    view.render(<StageHeader initial="m" />)
    expect(avatar().querySelector('.g-sdot')).toBeNull()
    expect(avatar().getAttribute('aria-label')).toBe('Settings')
    view.render(<StageHeader initial="m" alert="Connection problem" />)
    expect(avatar().querySelector('.g-sdot')).toBeTruthy()
    expect(avatar().getAttribute('aria-label')).toBe('Settings, Connection problem')
  })

  it('is three buttons that call their handlers when there are no links', () => {
    const onSettings = vi.fn(), onSearch = vi.fn(), onBell = vi.fn()
    view.render(<StageHeader onSettings={onSettings} onSearch={onSearch} onBell={onBell} />)
    expect([avatar(), pill(), bell()].map(el => el.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON'])
    click(avatar()); click(pill()); click(bell())
    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith(true)
    expect(onBell).toHaveBeenCalledTimes(1)
  })

  it('is three links when given hrefs', () => {
    view.render(<StageHeader settingsHref="#/me" searchHref="#/search" bellHref="#/inbox" />)
    expect([avatar(), pill(), bell()].map(el => el.getAttribute('href'))).toEqual(['#/me', '#/search', '#/inbox'])
  })

  it('shows the dot and counts the unread in the bell name', () => {
    view.render(<StageHeader unread={3} />)
    expect(q('.g-sdot')).not.toBeNull()
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 3 new')
  })

  it('has no dot when nothing is unread', () => {
    view.render(<StageHeader unread={0} />)
    expect(q('.g-sdot')).toBeNull()
  })

  it('turns the bell into the close of an open search, without the dot', () => {
    const onSearch = vi.fn(), onBell = vi.fn()
    view.render(<StageHeader searching onSearch={onSearch} onBell={onBell} unread={2} bellHref="#/inbox" />)
    expect(q('.g-shdr').classList.contains('g-shdr-open')).toBe(true)
    expect(bell().getAttribute('aria-label')).toBe('Close search')
    expect(bell().classList.contains('g-bell-close')).toBe(true)
    expect(bell().hasAttribute('href')).toBe(false)
    expect(q('.g-sdot')).toBeNull()
    click(bell())
    expect(onSearch).toHaveBeenCalledWith(false)
    expect(onBell).not.toHaveBeenCalled()
  })

  it('keeps its own open state when nothing controls it', () => {
    view.render(<StageHeader unread={1} />)
    click(pill())
    expect(bell().getAttribute('aria-label')).toBe('Close search')
    click(bell())
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 1 new')
  })
})
