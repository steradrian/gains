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
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 3 unread')
  })

  it('counts one unread in the bell name, and hides the dot from a screen reader', () => {
    view.render(<StageHeader unread={1} />)
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 1 unread')
    expect(bell().querySelector('.g-sdot').getAttribute('aria-hidden')).toBe('true')
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
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 1 unread')
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

  it('offers the barcode button in the field at rest and open, and scanning does not open the search', () => {
    const onScan = vi.fn()
    const onSearch = vi.fn()
    view.render(<StageHeader searching={false} onSearch={onSearch} query="" onQuery={vi.fn()} onScan={onScan} />)
    expect(q('.g-ssf-scan').getAttribute('aria-label')).toBe('Scan barcode')
    click(q('.g-ssf-scan'))
    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
    view.render(<StageHeader searching onSearch={onSearch} query="" onQuery={vi.fn()} onScan={onScan} />)
    expect(q('.g-ssf-scan')).not.toBeNull()
  })

  it('has no barcode button when no onScan is passed', () => {
    view.render(<StageHeader searching={false} onSearch={vi.fn()} query="" onQuery={vi.fn()} />)
    expect(q('.g-ssf-scan')).toBeNull()
  })
})

describe('StageHeader pinned, on a tab root', () => {
  it('pins itself, names the page for a screen reader only, and keeps a context readout before the bell', () => {
    view.render(<StageHeader pinned title="Today" action={<button className="hdr-left">1,240 left</button>} />)
    expect(q('.g-shdr').classList.contains('g-shdr-pin')).toBe(true)
    expect(q('h1').className).toBe('sr-only')
    expect(q('h1').textContent).toBe('Today')
    expect(q('.g-shdr-act').nextElementSibling).toBe(bell())
    expect(q('.g-shdr-act .hdr-left').textContent).toBe('1,240 left')
  })

  it('nothing in it moves while searching: the same parts, only the bell turned into ×', () => {
    view.render(<StageHeader pinned searching={false} onSearch={vi.fn()} query="" onQuery={vi.fn()} />)
    const before = [...q('.g-shdr').children].map(c => c.className)
    view.render(<StageHeader pinned searching onSearch={vi.fn()} query="" onQuery={vi.fn()} />)
    expect([...q('.g-shdr').children].map(c => c.className.replace(' g-bell-close', ''))).toEqual(before)
    expect(bell().classList.contains('g-bell-close')).toBe(true)
  })

  it('a context readout steps out while searching, so the field keeps its width, and comes back after', () => {
    const readout = <button className="hdr-left">1,240 left</button>
    view.render(<StageHeader pinned searching={false} onSearch={vi.fn()} query="" onQuery={vi.fn()} action={readout} />)
    expect(q('.g-shdr-act')).not.toBeNull()
    view.render(<StageHeader pinned searching onSearch={vi.fn()} query="" onQuery={vi.fn()} action={readout} />)
    expect(q('.g-shdr-act')).toBeNull()
    expect(q('.g-spill-field').nextElementSibling).toBe(bell())
    view.render(<StageHeader pinned searching={false} onSearch={vi.fn()} query="" onQuery={vi.fn()} action={readout} />)
    expect(q('.g-shdr-act').nextElementSibling).toBe(bell())
  })

  it('paints no ground of its own: it floats on the shared stage, with no band under its row', () => {
    view.render(<StageHeader pinned title="Today" />)
    expect(q('.g-shdr-bg')).toBeNull()
    expect(q('.g-shdr .g-stage-art')).toBeNull()
  })

  it('names the discs and the pill as liquid-glass controls, as buttons and as links', () => {
    view.render(<StageHeader />)
    expect([avatar(), pill(), bell()].map(el => el.getAttribute('data-glass'))).toEqual(['control', 'control', 'control'])
    view.render(<StageHeader settingsHref="#/s" searchHref="#/q" bellHref="#/n" />)
    expect([avatar(), pill(), bell()].map(el => el.getAttribute('data-glass'))).toEqual(['control', 'control', 'control'])
  })

  it('names the search field as a control too', () => {
    view.render(<StageHeader onQuery={() => {}} />)
    expect(pill().getAttribute('data-glass')).toBe('control')
  })

  it('is not pinned unless asked (the kit page shows several)', () => {
    view.render(<StageHeader />)
    expect(q('.g-shdr').classList.contains('g-shdr-pin')).toBe(false)
    expect(q('.g-shdr-bg')).toBeNull()
    expect(q('h1')).toBeNull()
  })
})
