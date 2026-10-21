// @vitest-environment happy-dom
// The inbox route against the real store: a row's tap reads it and opens its target, Mark all read
// clears every dot and deletes nothing, and the bells' count (useUnreadCount) is the unread items.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { isoOf } from '../../lib/format.js'
import { feedOf } from '../../lib/notifications/feed.js'
import { useUnreadCount } from '../../lib/notifications/use-notifications.js'
import { useStore } from '../../store/useStore.js'
import Notifications from './Notifications.jsx'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useLocation: () => ({ pathname: '/home/notifications' }) }))

const view = useView()
const DAY = 86400000
const BENCH = '0025'
const daysAgo = n => { const d = new Date(Date.now() - n * DAY); d.setHours(18, 0, 0, 0); return d }
// One set of one rep: the estimated 1RM is the weight. Ten days ago 90 kg, three days ago 96 kg.
const workout = (id, n, w) => ({ id, d: isoOf(daysAgo(n)), start: daysAgo(n).getTime(), end: daysAgo(n).getTime() + 3600000, entries: [{ id: BENCH, sets: [{ w, r: 1, done: true }] }] })
const BEST_ID = `best:${BENCH}:w2`

let saved
beforeEach(() => {
  navigate.mockReset()
  saved = useStore.getState().S
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', routines: [], week: {}, dayPlan: {}, queue: null, workouts: [workout('w1', 10, 90), workout('w2', 3, 96)], notifRead: { at: 0, ids: [] } } }))
})
afterEach(() => { useStore.setState({ S: saved }) })

const rows = () => [...view.host.querySelectorAll('.g-nrow')]
const rowOf = title => rows().find(r => r.textContent.includes(title))
const button = label => [...view.host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)

function Bell() {
  return <output>{useUnreadCount()}</output>
}

describe('Notifications (the route)', () => {
  it('everything starts unread: the line counts it, every row is lit', () => {
    view.render(<Notifications />)
    const n = feedOf(useStore.getState().S).length
    expect(n).toBeGreaterThan(0)
    expect(view.host.querySelector('.g-ssec-line .g-ssec-t').textContent).toBe(`${n} new`)
    expect(rows().every(r => r.classList.contains('g-nrow-new'))).toBe(true)
  })

  it('a row\'s tap marks it read and opens its target', () => {
    view.render(<Notifications />)
    click(rowOf('New best'))
    expect(useStore.getState().S.notifRead.ids).toEqual([BEST_ID])
    expect(navigate).toHaveBeenCalledWith(`/progress/strength?ex=${BENCH}`, undefined)
    expect(rowOf('New best').classList.contains('g-nrow-new')).toBe(false)
  })

  it('Mark all read clears every dot and keeps every row', () => {
    view.render(<Notifications />)
    const before = rows().length
    click(button('Mark all read'))
    expect(useStore.getState().S.notifRead.at).toBeGreaterThan(0)
    expect(rows()).toHaveLength(before)
    expect(view.host.querySelector('.g-nrow-dot')).toBeNull()
    expect(view.host.querySelector('.g-ssec-line').textContent).toBe('All readNothing unread')
  })

  it('nothing logged: the empty scene, and Set a reminder opens Me › Reminders', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [] } }))
    view.render(<Notifications />)
    expect(rows()).toHaveLength(0)
    click(button('Set a reminder'))
    expect(navigate).toHaveBeenCalledWith('/me/reminders')
  })
})

describe('useUnreadCount (the bells)', () => {
  it('counts the unread items, one less for each read, none after Mark all read', () => {
    view.render(<Bell />)
    const n = feedOf(useStore.getState().S).length
    expect(view.host.textContent).toBe(String(n))
    view.render(<><Bell /><Notifications /></>)
    click(rowOf('New best'))
    expect(view.host.querySelector('output').textContent).toBe(String(n - 1))
    click(button('Mark all read'))
    expect(view.host.querySelector('output').textContent).toBe('0')
  })
})
