// @vitest-environment happy-dom
// StageHeader: avatar, search pill and bell, each a named link or button; while the search is open
// the bell is its close; the unread dot shows for any count and not while searching.
import { describe, expect, it, vi } from 'vitest'
import StageHeader from './StageHeader.jsx'
import { click, type, useView } from './render.test-util.js'

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

describe('StageHeader as the search field', () => {
  const input = () => q('.g-spill input')

  it('the pill is the real input: focusing it opens the search, the header stays as it is', () => {
    const onSearch = vi.fn(), onQuery = vi.fn()
    view.render(<StageHeader placeholder="Search training" searching={false} onSearch={onSearch} query="" onQuery={onQuery} />)
    expect(pill().tagName).toBe('LABEL')
    expect(pill().getAttribute('role')).toBe('search')
    expect(input().getAttribute('placeholder')).toBe('Search training')
    expect(input().getAttribute('aria-label')).toBe('Search training')
    expect(input().getAttribute('enterkeyhint')).toBe('search')
    input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(onSearch).toHaveBeenCalledWith(true)
    expect([avatar(), pill(), bell()].every(Boolean)).toBe(true)
  })

  it('the header owns the query: it shows it while searching and hands every keystroke up', () => {
    const onQuery = vi.fn()
    view.render(<StageHeader searching onSearch={vi.fn()} query="press" onQuery={onQuery} />)
    expect(input().value).toBe('press')
    type(input(), 'presse')
    expect(onQuery).toHaveBeenCalledWith('presse')
    // Closed, the field is empty again.
    view.render(<StageHeader searching={false} onSearch={vi.fn()} query="press" onQuery={onQuery} />)
    expect(input().value).toBe('')
  })

  it('× in the bell\'s place closes; a scope sits in the field as a chip with its own ×', () => {
    const onSearch = vi.fn(), onClearScope = vi.fn()
    view.render(<StageHeader searching onSearch={onSearch} query="" onQuery={vi.fn()} scope="Workouts" onClearScope={onClearScope} />)
    const chip = q('.g-ssf-scope')
    expect(chip.textContent).toBe('Workouts')
    click(chip.querySelector('button'))
    expect(onClearScope).toHaveBeenCalledTimes(1)
    expect(q('.g-ssf-scope-x').getAttribute('aria-label')).toBe('Remove the Workouts scope')
    click(bell())
    expect(onSearch).toHaveBeenCalledWith(false)
  })

  it('takes the combobox props and a ref onto the input', () => {
    const ref = { current: null }
    const onKeyDown = vi.fn()
    view.render(<StageHeader searching onSearch={vi.fn()} query="" onQuery={vi.fn()} inputRef={ref}
      inputProps={{ role: 'combobox', 'aria-controls': 'gains-search-list', onKeyDown }} />)
    expect(ref.current).toBe(input())
    expect(input().getAttribute('role')).toBe('combobox')
    expect(input().getAttribute('aria-controls')).toBe('gains-search-list')
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})
