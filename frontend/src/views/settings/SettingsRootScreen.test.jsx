// @vitest-environment happy-dom
// SettingsRootScreen (A1.0, A3.3, A1.1): the groups in order, the account card and sync pill, the
// deletion banner, the search overlay, Sign out, and the slots other boards fill.
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import SettingsRootScreen from './SettingsRootScreen.jsx'

const view = useView()
const row = (key, title, extra = {}) => ({ key, icon: 'info', title, onClick: vi.fn(), ...extra })

const show = (over = {}) => {
  const props = {
    account: { initial: 'A', name: 'Adrian', line: 'Admin · 2 passkeys · this iPhone', onOpen: vi.fn() },
    pill: { state: 'ok', label: 'All synced', trail: '2 min ago' }, onPill: vi.fn(),
    groups: [
      { key: 'yours', title: 'Make it yours', rows: [row('appearance', 'Appearance', { value: 'Cobalt' })] },
      { key: 'help', title: 'Help', rows: [row('about', 'About and updates')] },
    ],
    search: { open: false, query: '', rows: [], onOpen: vi.fn(), onQuery: vi.fn(), onClose: vi.fn() },
    signOut: { title: 'Sign out', sub: 'This iPhone only', onClick: vi.fn() },
    footer: 'Gains 0.1.0', ...over,
  }
  view.render(<SettingsRootScreen {...props} />)
  return props
}
const rowTitles = () => [...view.host.querySelectorAll('.g-glist-row b, .g-danger-row b')].map(b => b.textContent)
const rowEl = title => [...view.host.querySelectorAll('.g-glist-row, .g-danger-row')].find(r => r.querySelector('b').textContent === title)

describe('SettingsRootScreen', () => {
  it('draws the title, the account card, the pill, the groups in order and Sign out', () => {
    show()
    expect(view.host.querySelector('.g-sptitle h1').textContent).toBe('Settings')
    expect(rowTitles()).toEqual(['Adrian', 'Appearance', 'About and updates', 'Sign out'])
    expect([...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)).toEqual(['Make it yours', 'Help'])
    expect(rowEl('Appearance').textContent).toContain('Cobalt')
    expect(view.host.querySelector('.sroot-pill').textContent).toBe('All synced · 2 min ago')
    expect(view.host.querySelector('.sroot-foot').textContent).toBe('Gains 0.1.0')
    expect(view.host.querySelector('button[aria-label="Back"]')).toBeNull()
  })

  it('the card, the pill, a row and Sign out are wired', () => {
    const p = show()
    click(rowEl('Adrian'))
    click(view.host.querySelector('.sroot-pill'))
    click(rowEl('Appearance'))
    click(rowEl('Sign out'))
    expect(p.account.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onPill).toHaveBeenCalledTimes(1)
    expect(p.groups[0].rows[0].onClick).toHaveBeenCalledTimes(1)
    expect(p.signOut.onClick).toHaveBeenCalledTimes(1)
  })

  it('has no Sign out and no pill for a guest', () => {
    show({ signOut: null, pill: null })
    expect(rowTitles()).not.toContain('Sign out')
    expect(view.host.querySelector('.sroot-pill')).toBeNull()
  })

  it('shows each pill state', () => {
    show({ pill: { state: 'waiting', label: '3 changes waiting', trail: null } })
    expect(view.host.querySelector('.sroot-pill').textContent).toBe('3 changes waiting')
    expect(view.host.querySelector('.sroot-dot-waiting')).not.toBeNull()
    show({ pill: { state: 'paused', label: 'Sync paused', trail: 'deletion scheduled' } })
    expect(view.host.querySelector('.sroot-pill').textContent).toBe('Sync paused · deletion scheduled')
  })

  it('a deletion banner says the date, and Cancel deletion calls back', () => {
    const onCancel = vi.fn()
    show({ banner: { date: 'Sun 25 Oct', busy: false, onCancel } })
    const text = view.host.querySelector('.sroot-banner').textContent
    expect(text).toContain('Your account is scheduled for deletion')
    expect(text).toContain('Deleted on Sun 25 Oct')
    expect(text).toContain('Sync is paused.')
    click([...view.host.querySelectorAll('.sroot-banner button')].find(b => b.textContent === 'Cancel deletion'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('no banner without a scheduled deletion', () => {
    show()
    expect(view.host.querySelector('.sroot-banner')).toBeNull()
  })

  it('a row another board adds to a group is drawn like the others', () => {
    show({ groups: [{ key: 'yours', title: 'Make it yours', rows: [row('appearance', 'Appearance'), row('groups', 'Groups', { sub: 'Friends' })] }] })
    expect(rowTitles()).toEqual(['Adrian', 'Appearance', 'Groups', 'Sign out'])
  })

  it('focusing the search field opens the overlay', () => {
    const p = show()
    view.host.querySelector('.sroot-search input').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(p.search.onOpen).toHaveBeenCalled()
  })

  it('the overlay replaces the page: hits, their count, and close', () => {
    const hit = row('appearance:Theme', 'Theme', { sub: 'Appearance · Dark, Light, System' })
    const p = show({ search: { open: true, query: 'the', rows: [hit], onOpen: vi.fn(), onQuery: vi.fn(), onClose: vi.fn() } })
    expect(view.host.querySelector('.g-sptitle')).toBeNull()
    expect(view.host.querySelector('.g-ssec-t').textContent).toBe('1 setting')
    expect(rowTitles()).toEqual(['Theme'])
    click(rowEl('Theme'))
    expect(hit.onClick).toHaveBeenCalledTimes(1)
    click(view.host.querySelector('button[aria-label="Close search"]'))
    expect(p.search.onClose).toHaveBeenCalledTimes(1)
  })

  it('the overlay with nothing typed explains itself; with no match it says so', () => {
    show({ search: { open: true, query: '', rows: [], onOpen: vi.fn(), onQuery: vi.fn(), onClose: vi.fn() } })
    expect(view.host.textContent).toContain('A hit opens its page and flashes the row.')
    show({ search: { open: true, query: 'zzzz', rows: [], onOpen: vi.fn(), onQuery: vi.fn(), onClose: vi.fn() } })
    expect(view.host.textContent).toContain('No setting matches “zzzz”.')
  })
})
