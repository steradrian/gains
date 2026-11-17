// @vitest-environment happy-dom
// NotificationsScreen (N1.0 to N1.3): the sections, the status line and Mark all read, a row's
// tap, the empty scene, and the permission banner over a list that still fills.
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import NotificationsScreen from './NotificationsScreen.jsx'

const view = useView()
const NOW = new Date(2026, 9, 17, 12).getTime()
const HOUR = 3600000
const item = (id, kind, hoursAgo, title) => ({ id, kind, at: NOW - hoursAgo * HOUR, title, body: title + ' body', target: { route: '/x' } })

const BEST = item('best:0025:w2', 'best', 2, 'New best: Bench press')
const STREAK = item('streak:2026-10-05', 'streak', 6 * 24, '6 weeks on plan')
const MILESTONE = item('milestone:50', 'milestone', 15 * 24, '50 workouts')
const SECTIONS = { new: [BEST], thisWeek: [STREAK], earlier: [MILESTONE] }
const NONE = { new: [], thisWeek: [], earlier: [] }

const show = (over = {}) => {
  const props = {
    sections: SECTIONS, unreadCount: 1, isUnread: i => i.id === BEST.id, now: NOW, permission: 'on', homeScreen: false, hasReminders: true,
    onOpen: vi.fn(), onMarkAllRead: vi.fn(), onTurnOn: vi.fn(), onReminders: vi.fn(), onBack: vi.fn(), ...over,
  }
  view.render(<NotificationsScreen {...props} />)
  return props
}
const text = () => view.host.textContent
const groupTitles = () => [...view.host.querySelectorAll('.g-ngroup h2')].map(h => h.textContent)
const button = label => [...view.host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const rows = () => [...view.host.querySelectorAll('.g-nrow')]

describe('NotificationsScreen', () => {
  it('N1.0: the heading, its line, and New, This week and Earlier with their rows', () => {
    show()
    expect([...view.host.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Notifications'])
    expect(view.host.querySelector('.g-sptitle h1').textContent).toBe('Notifications')
    expect(text()).toContain('Reminders you set, streaks, new bests and Coach changes')
    expect(groupTitles()).toEqual(['New', 'This week', 'Earlier'])
    expect(rows().map(r => (r.querySelector('b .g-sr') || r.querySelector('b')).textContent)).toEqual(['New: New best: Bench press', '6 weeks on plan', '50 workouts'])
    expect(rows()[0].classList.contains('g-nrow-new')).toBe(true)
    expect(rows()[1].classList.contains('g-nrow-new')).toBe(false)
    expect(rows()[1].querySelector('small').textContent).toMatch(/^Streak · /)
    expect(view.host.querySelector('.g-snote').textContent).toBe('Kept for 30 days.')
    expect(text()).not.toContain('Me ›')
  })

  it('leaves out a section with nothing in it', () => {
    show({ sections: { ...SECTIONS, earlier: [] } })
    expect(groupTitles()).toEqual(['New', 'This week'])
  })

  it('"1 new · Mark all read": the pill marks everything read and focus goes to the heading', () => {
    const { onMarkAllRead } = show()
    expect(view.host.querySelector('.g-ssec-line .g-ssec-t').textContent).toBe('1 new')
    click(button('Mark all read'))
    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(view.host.querySelector('.g-sptitle h1'))
  })

  it('N1.2: with nothing unread there is no status row at all, and every row stays', () => {
    show({ sections: { new: [], thisWeek: [BEST, STREAK], earlier: [MILESTONE] }, unreadCount: 0, isUnread: () => false })
    expect(view.host.querySelector('.g-ssec-line')).toBeNull()
    expect(text()).not.toContain('Nothing unread')
    expect(button('Mark all read')).toBeUndefined()
    expect(rows()).toHaveLength(3)
    expect(view.host.querySelector('.g-nrow-dot')).toBeNull()
  })

  it('a row opens its item', () => {
    const { onOpen } = show()
    click(rows()[1])
    expect(onOpen).toHaveBeenCalledWith(STREAK)
  })

  it('Back, the gear and the Reminders row at the end of the list go where they say', () => {
    const { onBack, onReminders } = show()
    click(button('Back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    click(button('Reminder settings'))
    click(button('Reminders'))
    expect(onReminders).toHaveBeenCalledTimes(2)
    expect(view.host.querySelector('.notif-rem .g-glist-chev')).toBeTruthy()
  })

  it('the Reminders row gives way to the banner button while notifications are off, and is absent off the phone app', () => {
    show({ permission: 'off' })
    expect(view.host.querySelector('.notif-rem')).toBeNull()
    show({ hasReminders: false })
    expect(view.host.querySelector('.notif-rem')).toBeNull()
  })

  it('N1.1: nothing yet is the bell scene with Set a reminder, and no status line or footer', () => {
    const { onReminders } = show({ sections: NONE, unreadCount: 0 })
    expect(text()).toContain('Nothing new')
    expect(text()).toContain('Reminders you set, streaks, new bests and Coach changes show up here.')
    expect(view.host.querySelector('.g-ssec-line')).toBeNull()
    expect(view.host.querySelector('.g-snote')).toBeNull()
    expect(view.host.querySelector('.g-sempty')).toBeTruthy()
    expect(view.host.querySelector('.g-sempty-card')).toBeNull()
    click(button('Set a reminder'))
    expect(onReminders).toHaveBeenCalledTimes(1)
  })

  it('off the phone app, where no reminder lands here, it never promises one', () => {
    show({ hasReminders: false })
    expect(text()).toContain('Streaks, new bests and Coach changes')
    expect(text()).not.toContain('Reminders you set')
    show({ sections: NONE, unreadCount: 0, hasReminders: false })
    expect(text()).toContain('Streaks, new bests and Coach changes show up here.')
    expect(text()).not.toContain('Reminders you set')
    expect(button('Set a reminder')).toBeUndefined()
    expect(view.host.querySelector('.g-sempty-btn')).toBeNull()
  })

  it('N1.3: off on this phone is a banner with Turn on and Reminders, over a list that still fills', () => {
    const { onTurnOn, onReminders } = show({ permission: 'off' })
    const banner = view.host.querySelector('.g-sbanner')
    expect(banner.textContent).toContain('Notifications are off on this phone')
    expect(banner.textContent).toContain('They still land here, but your phone won’t buzz.')
    expect(banner.textContent).not.toContain('On iPhone')
    click(button('Turn on'))
    expect(onTurnOn).toHaveBeenCalledTimes(1)
    click(button('Reminders'))
    expect(onReminders).toHaveBeenCalledTimes(1)
    expect(rows()).toHaveLength(3)
  })

  it('tells an iPhone browser to add Gains to the Home Screen; no banner while on or not yet known', () => {
    show({ permission: 'off', homeScreen: true })
    expect(view.host.querySelector('.g-sbanner').textContent).toContain('On iPhone, add Gains to the Home Screen first.')
    show({ permission: null })
    expect(view.host.querySelector('.g-sbanner')).toBeNull()
    show({ permission: 'unsupported' })
    expect(view.host.querySelector('.g-sbanner')).toBeNull()
  })
})

// Friends surfaces m1: the cheer and invite rows, and a page that names Friends only while it is on.
describe('NotificationsScreen with Friends', () => {
  const CHEER = { id: 'cheer:2026-10-17', kind: 'cheer', at: NOW - 2 * HOUR, title: 'Cheers for you', body: 'Mara and 2 others cheered you', target: { route: '/me/groups/cheers' } }
  const INVITE = { id: 'group-invite:K7M2X9QPA4', kind: 'invite', at: NOW - 3 * HOUR, title: 'Mara invited you to Iron Sunday', body: 'See what the group shares, then join', target: { route: '/me/groups/join/K7M2X9QPA4' } }

  it('draws a cheer row and an invite row with their own meta lines, and a tap opens them', () => {
    const props = show({ sections: { new: [CHEER, INVITE], thisWeek: [], earlier: [] }, unreadCount: 2, isUnread: () => true, friends: true })
    expect(rows().map(r => r.querySelector('b .g-sr').textContent)).toEqual(['New: Cheers for you', 'New: Mara invited you to Iron Sunday'])
    expect(text()).toContain('Mara and 2 others cheered you')
    expect(text()).toContain('Cheer · 2 hours ago')
    expect(text()).toContain('Invite · 3 hours ago')
    click(rows()[0])
    expect(props.onOpen).toHaveBeenCalledWith(CHEER)
  })

  it('names Friends in its line and its empty scene only while Friends is on', () => {
    show({ friends: true })
    expect(text()).toContain('Reminders you set, streaks, new bests, Coach changes and Friends')
    show({ friends: false })
    expect(text()).not.toContain('Friends')
    show({ sections: NONE, unreadCount: 0, friends: true, hasReminders: false })
    expect(text()).toContain('Streaks, new bests, Coach changes and Friends show up here.')
  })
})
