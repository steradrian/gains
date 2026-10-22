// @vitest-environment happy-dom
// Settings v1.3.11: the root, the pages, the search and the rest wheels. Every row the search
// knows has to be a row on its page, and every page and row title has a word in each pack.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAvailableOverride } from '../lib/friends/api.js'
import { PAGES, PAGE_IDS, SEARCH, featuresFor, pageExists, pageVisible, searchSettings, pageTrail, fold } from './settings-pages.js'

await preloadPages()
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, sync: null, MOBILE: false, push: false, sheets: [], navs: [], backs: [], toast: null }
  state.snapshot = () => ({
    S: state.S, user: state.user, coachLocal: null, sync: state.sync, config: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
    replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(), setUnit: vi.fn(),
    resetEverything: vi.fn(), resetDemo: vi.fn(), importBackup: vi.fn(), importConflict: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: mocks.toast, openSheet: render => { mocks.sheets.push(render); return { close: vi.fn() } } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => mocks.navs.push(a) }))
// A page's back is the tab's back, handed the page's own parent for a cold entry.
vi.mock('../lib/use-tab-nav.js', () => ({ back: parent => mocks.backs.push(parent), isSwitching: () => false }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(path => Promise.resolve(path === '/api/account/passkeys' ? { passkeys: [] } : {})), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false }))
vi.mock('../lib/push.js', () => ({ pushSupported: () => mocks.push, pushPermission: () => (mocks.push ? 'default' : 'unsupported'), enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn(), syncPushSubscription: vi.fn(() => Promise.resolve(mocks.pushOn)) }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => true }))
// The rest of the module is for the real store's freshState (the Features test reads it).
vi.mock('../lib/mobile.js', async importOriginal => ({
  ...(await importOriginal()),
  get MOBILE() { return mocks.MOBILE }, isAndroid: () => Promise.resolve(!!mocks.android), shareExport: vi.fn(), shareExportBlob: vi.fn(), syncReminder: vi.fn(),
}))
vi.mock('../lib/update.js', () => ({ checkForUpdate: () => Promise.resolve({ hasUpdate: false }), downloadAndInstall: vi.fn(), fetchChecksum: vi.fn(), RELEASES_PAGE: '' }))
vi.mock('../lib/health-sync.js', async importOriginal => ({
  ...(await importOriginal()),
  healthStatus: () => Promise.resolve({ status: 'available', granted: false }), loadHealth: () => Promise.resolve({ on: false, written: {}, error: null }),
  enableHealth: vi.fn(), disableHealth: vi.fn(), openHealthConnect: vi.fn(), onHealthChange: () => () => {},
}))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('./me/body/measure-drawers.jsx', () => ({ manageMeasurementsSheet: vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(), importFromHevy: vi.fn(),
  menuSheet: vi.fn(),
}))

import Settings from './Settings.jsx'
import { preloadPages } from './settings/pages/index.js'
import { stubHubOffline } from '../lib/nutrition/hub-offline.test-util.js'

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  stubHubOffline()
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: true, vibrate: true, effort: 'none', gifSize: 'full', lang: 'en',
    workouts: [], routines: [], exWeights: {}, equipProfiles: [{ id: 'p1', name: 'Home', equipment: [] }], activeEquipId: 'p1',
    reminder: { on: false, time: '17:30' },
  }
  mocks.user = null
  mocks.sync = null
  mocks.MOBILE = false
  mocks.android = false
  mocks.push = false
  mocks.pushOn = false
  mocks.toast = vi.fn()
  mocks.sheets = []
  mocks.navs = []
  Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true, writable: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  setAvailableOverride(null)
  delete navigator.vibrate
})

const mount = (page = null, find = null, via = null) => act(() => root.render(<Settings page={page} find={find} via={via} />))
// A legacy row is `.lrow` with a `.lrow-t`; a row on the stage is `.g-glist-row` with its title in the <b>.
const rowTitled = title => [...host.querySelectorAll('.lrow, .g-glist-row')].find(r => (r.querySelector('.lrow-t') ?? r.querySelector('b'))?.textContent === title)
// The layout tiles (a radiogroup, not a row) are a search hit of their own, named by their aria-label;
// a stage page's section headings count as titles too.
const titles = () => [...host.querySelectorAll('.lrow .lrow-t, .g-glist-row b, .g-danger-row b, .set-tiles, .g-ssec h2')].map(e => e.getAttribute('aria-label') ?? e.textContent)
const valueOf = row => (row.querySelector('.g-gvr-val') || row.querySelector('.lrow-v')).textContent

// This test's guest in a browser, as the page itself sees it.
const guestWeb = {
  user: null, mobile: false, android: false, demo: false, wakeOK: true, hasMedia: false, pwOn: false, webauthn: false,
  sound: true, playOnSilent: false, canVibrate: true, vibrate: true, profiles: true, nameLang: false,
  pushOK: false, reminderOn: false, nudge: false, autoBackup: false, synced: false, installTip: true, androidWeb: false,
}

// The root (rows, values, banner, search, sign out) is tested in settings/SettingsRoot.test.jsx,
// SettingsRootScreen.test.jsx, row-values.test.js and search-hits.test.js.

// Each search hit is a row on its page, on the device and profile it was offered for. The ctx is
// the one Settings builds (views/Settings.jsx) for the same mocks; push-dependent web rows are
// the exception the page settles on open (`via`), tested on their own below.
describe('the search lands on a row', () => {
  const scenarios = {
    'guest in a browser': () => {},
    'signed in, browser without push': () => { mocks.user = { id: 'u1', name: 'Dana' }; mocks.sync = { status: 'ok', server: 'https://gym.example' } },
    'phone, reminder off': () => { mocks.MOBILE = true },
    'phone, reminder and nudge on': () => { mocks.MOBILE = true; mocks.S.reminder = { on: true, time: '17:30', nudge: true }; mocks.S.autoBackup = true },
    'phone paired with a server': () => { mocks.MOBILE = true; mocks.user = { id: 'u1', name: 'Dana' }; mocks.sync = { status: 'ok', server: 'https://gym.example' } },
  }
  const ctxNow = () => ({
    ...guestWeb, user: mocks.user, mobile: mocks.MOBILE, pushOK: !mocks.MOBILE && mocks.push,
    reminderOn: !!mocks.S.reminder?.on, nudge: !!mocks.S.reminder?.nudge, autoBackup: !!mocks.S.autoBackup,
    synced: !!mocks.sync, installTip: !mocks.MOBILE, hasMedia: false, wakeOK: true,
  })
  for (const [name, setUp] of Object.entries(scenarios)) it(name, async () => {
    setUp()
    // Friends is there when signed in; the hub stub answers /me with nothing, which would mark the
    // routes missing mid-test.
    setAvailableOverride(!!mocks.user)
    const ctx = ctxNow()
    const byPage = {}
    for (const e of SEARCH) if (pageVisible(e.page, ctx) && (!e.when || e.when(ctx))) (byPage[e.page ?? 'root'] ||= []).push(e.title)
    for (const [page, want] of Object.entries(byPage)) {
      // Equipment is Gym setup, outside this Settings shell: GymSetup.test.jsx checks its anchors
      if (page === 'equipment') continue
      mount(page === 'root' ? null : page)
      await act(async () => {})   // the passkey list, asked of the server on open
      // The root draws on the stage: its rows name themselves in a <b>.
      const have = [...titles(), ...[...host.querySelectorAll('.btn')].map(b => b.textContent.trim()),
        ...[...host.querySelectorAll('.g-glist-row b, .g-danger-row b')].map(b => b.textContent)]
      for (const title of want) {
        // Sync now is on the Sync and backup page (data-m1's SyncPage); the old page does not have it.
        if (title === 'Sync now') continue
        expect(have, `${page}: ${title}`).toContain(title)
      }
    }
  })

  it('finds the rows that used to be missing', () => {
    const tr = s => s
    const web = { ...guestWeb, user: { id: 'u' }, synced: true, pushOK: true, reminderOn: true, nudge: true }
    expect(searchSettings('reminder time', web, tr).map(h => h.title)).toEqual(['Reminder time'])
    expect(searchSettings('tone', web, tr).map(h => h.title)).toContain('Nudge tone')
    expect(searchSettings('test notification', web, tr).map(h => h.title)).toEqual(['Send test notification'])
    expect(searchSettings('server', web, tr).map(h => h.title)).toContain('Sync now')
    expect(searchSettings('sync', web, tr).map(h => h.title)).toContain('Sync now')
    expect(searchSettings('loop', web, tr).map(h => h.title)).toContain('How you train')
    expect(searchSettings('swipe', web, tr)[0].title).toBe('Swipe actions')
    expect(searchSettings('gesture', web, tr).map(h => h.title)).toEqual(['Swipe actions'])
    expect(searchSettings('home screen', web, tr).map(h => h.title)).toEqual(['Install'])
    expect(searchSettings('install', { ...web, androidWeb: true }, tr).map(h => h.title)).toEqual(['Install'])
    expect(searchSettings('install', { ...web, installTip: false }, tr)).toEqual([])
    expect(searchSettings('backup folder', { ...guestWeb, mobile: true, android: true, autoBackup: true }, tr).map(h => h.title)).toEqual(['Backup folder'])
    expect(searchSettings('backup folder', { ...guestWeb, mobile: true, android: true }, tr)).toEqual([])
    setAvailableOverride(true)
    expect(searchSettings('groups', web, tr).map(h => h.title)).toContain('Friends')
    setAvailableOverride(false)
    expect(searchSettings('friends', web, tr).map(h => h.title)).not.toContain('Friends')
  })

  it('a web reminder row waits for push to answer, and flashes Push notifications when it stays off', async () => {
    vi.useFakeTimers()
    try {
      mocks.user = { id: 'u1', name: 'Dana' }
      mocks.push = true
      mocks.S.reminder = { on: true, time: '17:30' }
      mount('reminders', 'Nudge me when I skip a planned workout', 'Push notifications')
      await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
      expect(rowTitled('Push notifications').classList.contains('sp-flash')).toBe(true)
      expect(mocks.toast).toHaveBeenCalledWith('Turn on push notifications first.')

      // push on: the row appears once the server answers, and that row is the one flashed
      mocks.pushOn = true
      mocks.toast.mockClear()
      act(() => root.render(null))
      mount('reminders', 'Nudge me when I skip a planned workout', 'Push notifications')
      await act(async () => { await vi.advanceTimersByTimeAsync(50) })
      expect(rowTitled('Nudge me when I skip a planned workout').classList.contains('sp-flash')).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
      expect(mocks.toast).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
})

describe('the pages', () => {
  it('each search entry is a row on its page (guest in a browser)', () => {
    const byPage = {}
    for (const e of SEARCH) if (pageVisible(e.page, guestWeb) && (!e.when || e.when(guestWeb))) (byPage[e.page] ||= []).push(e.title)
    expect(Object.keys(byPage).sort()).toEqual(['about', 'account', 'advanced', 'appearance', 'background', 'backup', 'equipment', 'help', 'import', 'licences', 'schedule', 'units', 'workout'])
    for (const [page, want] of Object.entries(byPage)) {
      // Equipment is Gym setup, a stage page outside this Settings shell (SettingsRoute): its
      // rows and the search's anchors are checked in views/train/gym/GymSetup.test.jsx
      if (page === 'equipment') continue
      mount(page)
      const have = titles()
      for (const title of want) expect(have, `${page}: ${title}`).toContain(title)
    }
  })

  it('every old row has a home: Workout screen holds the rest, the end-of-rest rows and the during rows', () => {
    mount('workout')
    expect([...host.querySelectorAll('.g-ssec h2')].map(e => e.textContent)).toEqual(['On each exercise', 'Rest', 'When a rest ends', 'During a workout'])
    expect([...host.querySelectorAll('.g-glist-row b')].map(e => e.textContent)).toEqual(['Effort per set', 'Shown under each exercise', 'Exercise animations', 'Rest timer', 'Rest-pause rest',
      'Play a sound', 'Sound', 'Vibrate', 'Flash the screen', 'Weigh in before workouts', 'Keep screen awake', 'Fine-tuning'])
    expect(host.querySelector('h1').textContent).toBe('Workout screen')
    mount('advanced')
    expect(titles()).toEqual(['Planned sessions start from', 'Keep timing after target', 'Swipe actions'])
  })

  it('the Fine-tuning row on Workout screen opens Fine-tuning', () => {
    mount('workout')
    act(() => rowTitled('Fine-tuning').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/advanced'])
  })

  it('the Swipe actions switch writes S.wc.swipeSets', () => {
    mount('advanced')
    const sw = rowTitled('Swipe actions').querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-checked')).toBe('true')
    act(() => sw.click())
    expect(mocks.S.wc.swipeSets).toBe(false)
  })

  it('a page on the stage frame has its own title and Back, and no old header over it', () => {
    for (const [page, title] of [['workout', 'Workout screen'], ['advanced', 'Fine-tuning'], ['schedule', 'Schedule'], ['units', 'Units & language'], ['features', 'Features'], ['help', 'Help'], ['about', 'About']]) {
      mount(page)
      expect(host.querySelector('.sub-hdr'), page).toBeNull()
      expect(host.querySelectorAll('h1'), page).toHaveLength(1)
      expect(host.querySelector('h1').textContent).toBe(title)
      act(() => host.querySelector('.g-snav-back').click())
      expect(mocks.backs.at(-1), page).toBe('/me/settings')
    }
  })

  // The stage frame is one structure: Back is the first thing in the page, with nothing above it
  // (no old header, no spacer, no second inset), and the same wrappers around it on every page.
  it('every page draws the same top structure', async () => {
    const shape = () => {
      const nav = host.querySelector('.g-snav')
      if (!nav) return null
      const path = []
      for (let el = nav; el && el !== host; el = el.parentElement) {
        const sibs = [...el.parentElement.children]
        path.push([el.className, sibs.slice(0, sibs.indexOf(el)).map(s => s.className || s.tagName)])
      }
      return JSON.stringify(path)
    }
    const shapes = new Map()
    // Reminders draws four faces; each is a Settings page like the rest.
    for (const [face, set] of [['', () => {}], ['/push', () => { mocks.push = true }]]) {
      set()
      for (const page of PAGE_IDS) {
        if (!pageExists(page, { ...guestWeb, mobile: mocks.MOBILE, pushOK: mocks.push }) || PAGES[page].to || PAGES[page].sheet || page === 'equipment') continue
        mount(page)
        await act(async () => {})
        const s = shape()
        // #app's direct child, or its own top inset is added to #app's (index.css `#app:has(> .g-root.g-screen)`).
        if (s) expect(host.querySelector('.g-root.g-screen')?.parentElement, page).toBe(host)
        if (s) shapes.set(page + face, s)
      }
      act(() => root.unmount()); root = createRoot(host)
    }
    expect(shapes.size).toBeGreaterThan(10)
    const first = [...shapes.values()][0]
    expect([...shapes].filter(([, s]) => s !== first).map(([p]) => p)).toEqual([])
  })

  it('Licences is on the stage frame too, and Back goes to About, where it is opened from', () => {
    mount('licences')
    expect(host.querySelector('.sub-hdr')).toBeNull()
    expect(host.querySelector('h1').textContent).toBe('Licences')
    act(() => host.querySelector('.g-snav-back').click())
    expect(mocks.backs.at(-1)).toBe('/me/about')
  })

  it('a search hit flashes its row', () => {
    mount('workout', 'Flash the screen')
    expect(rowTitled('Flash the screen').classList.contains('sp-flash')).toBe(true)
  })
})

describe('the rest wheels', () => {
  const doneIn = sheet => {
    const close = vi.fn()
    const h = document.createElement('div'); document.body.appendChild(h)
    const r = createRoot(h)
    act(() => r.render(sheet(close)))
    return { h, r, close }
  }
  // The drawer itself (steps, presets, live writes) is rest-timer-sheet.test.jsx.
  it('Rest timer shows the rest and opens its drawer', () => {
    mount('workout')
    expect(valueOf(rowTitled('Rest timer'))).toBe('1:30')
    act(() => rowTitled('Rest timer').click())
    const { h, r } = doneIn(mocks.sheets.at(-1))
    expect(h.querySelector('h2').textContent).toBe('Rest timer')
    expect(h.querySelector('.set-rest-time').textContent).toBe('1:30')
    act(() => r.unmount()); h.remove()
  })

  it('0:00 is the timer off', () => {
    mocks.S.restSec = 0
    mount('workout')
    expect(valueOf(rowTitled('Rest timer'))).toBe('Off')
  })

  it('Rest-pause rest uses the wheel too, 5 s to 5 minutes', () => {
    mount('workout')
    act(() => rowTitled('Rest-pause rest').click())
    const { h, r } = doneIn(mocks.sheets.at(-1))
    const [min, sec] = h.querySelectorAll('[role="spinbutton"]')
    expect(min.getAttribute('aria-valuemax')).toBe('5')
    act(() => { sec.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })) })
    act(() => { [...h.querySelectorAll('button')].find(b => b.textContent === 'Done').click() })
    expect(mocks.S.restPauseSec).toBe(5)
    act(() => r.unmount()); h.remove()
  })
})

describe('searchSettings', () => {
  const tr = s => s
  it('matches titles, synonyms and pages, ignoring case and accents', () => {
    expect(searchSettings('Vibrate', guestWeb, tr).map(h => h.title)).toEqual(['Vibrate'])
    expect(searchSettings('buzz', guestWeb, tr).map(h => h.title)).toEqual(['Vibrate'])
    expect(searchSettings('pounds', guestWeb, tr).map(h => h.title)).toEqual(['Weight unit'])
    expect(searchSettings('dark mode', guestWeb, tr).map(h => h.title)).toEqual(['Theme'])
    expect(searchSettings('gif', guestWeb, tr).map(h => h.title)).toEqual(['Exercise animations'])
    expect(searchSettings('RÉST TIMER', guestWeb, tr)[0].title).toBe('Rest timer')
    expect(fold('Thème')).toBe('theme')
  })

  it('pages are hits too, and a title starting with the query comes first', () => {
    const hits = searchSettings('units', guestWeb, tr)
    expect(hits[0]).toMatchObject({ title: 'Units & language', isPage: true, page: 'units' })
    expect(searchSettings('rest', guestWeb, tr).slice(0, 2).map(h => h.title)).toEqual(['Rest timer', 'Rest-pause rest'])
  })

  it('names the page a row is on (Profile for the root\'s own), and keeps to the rows this device shows', () => {
    expect(pageTrail('advanced', tr)).toBe('Fine-tuning')
    expect(pageTrail(null, tr)).toBe('Profile')
    expect(searchSettings('overtime', guestWeb, tr)[0].trail).toBe('Fine-tuning')
    expect(searchSettings('sign out', { ...guestWeb, user: { id: 'u' }, synced: true }, tr)[0]).toMatchObject({ page: null, trail: 'Profile' })
    expect(searchSettings('sync now', { ...guestWeb, user: { id: 'u' }, synced: true }, tr)[0]).toMatchObject({ page: 'backup', trail: 'Sync and backup' })
    expect(searchSettings('admin', guestWeb, tr)).toEqual([])
    expect(searchSettings('admin', { ...guestWeb, user: { id: 'u', admin: true } }, tr)[0]).toMatchObject({ page: 'admin', isPage: true })
    expect(searchSettings('health connect', guestWeb, tr)).toEqual([])
    expect(searchSettings('nudge', guestWeb, tr)).toEqual([])                              // no Reminders for a web guest
    expect(searchSettings('nudge', { ...guestWeb, user: { id: 'u' } }, tr)).toEqual([])         // no push in this browser
    expect(searchSettings('nudge', { ...guestWeb, user: { id: 'u' }, pushOK: true }, tr)).toEqual([])   // the reminder is off
    expect(searchSettings('nudge', { ...guestWeb, user: { id: 'u' }, pushOK: true, reminderOn: true }, tr).map(h => h.title)).toEqual(['Nudge me when I skip a planned workout'])
    expect(searchSettings('nudge', { ...guestWeb, mobile: true, reminderOn: true }, tr).map(h => h.title)).toEqual(['Nudge me when I skip a planned workout'])
    expect(searchSettings('coach', guestWeb, tr)).toEqual([])
    expect(searchSettings('coach', { ...guestWeb, mobile: true }, tr)[0].page).toBe('coach')
    expect(searchSettings('vibrate silent', { ...guestWeb, mobile: true, android: true }, tr).map(h => h.title)).toEqual(['Vibrate on silent too'])
    expect(searchSettings('   ', guestWeb, tr)).toEqual([])
  })

  it('searches in the app language as well', () => {
    const de = { Vibrate: 'Vibration', 'Workout screen': 'Workout-Ansicht', Settings: 'Einstellungen' }
    const hits = searchSettings('vibration', guestWeb, s => de[s] || s)
    expect(hits[0]).toMatchObject({ title: 'Vibrate', label: 'Vibration', trail: 'Workout-Ansicht' })
  })

  it('finds the translated choices of a row, and words of its own language', async () => {
    const { setLang, t } = await import('../lib/i18n.js')
    try {
      await setLang('de')
      const first = q => searchSettings(q, guestWeb, t)[0]?.title
      expect(first('Dunkel')).toBe('Theme')
      expect(first('Feste Woche')).toBe('How you train')
      expect(first('Wochenstart')).toBe('Week starts on')
      expect(first('wischen')).toBe('Swipe actions')
      expect(first('Geste')).toBe('Swipe actions')
      await setLang('ar')
      expect(searchSettings('تناوب', guestWeb, t).map(h => h.title)).toContain('How you train')
    } finally { await setLang('en') }
  })

  it('finds a tone and a JSON export by their English words', () => {
    expect(searchSettings('tone', { ...guestWeb, user: { id: 'u' }, pushOK: true, reminderOn: true, nudge: true }, s => s).map(h => h.title)).toContain('Nudge tone')
    expect(searchSettings('json', guestWeb, s => s).map(h => h.title)).toContain('Export backup')
  })
})

describe('translations', () => {
  const packs = import.meta.glob('../locales/*.js', { eager: true, import: 'default' })
  it('every page and searchable row title has a word in each pack', () => {
    const keys = [...new Set([...PAGE_IDS.map(id => PAGES[id].title), ...SEARCH.map(e => e.title)])]
    for (const [file, pack] of Object.entries(packs)) {
      const missing = keys.filter(k => !Object.hasOwn(pack, k) || !String(pack[k]).trim())
      expect(missing, file).toEqual([])
    }
  })
})

describe('Features', () => {
  it('lists every switch that starts off, says whether it is on, and opens its page with the switch flashed', () => {
    mocks.S.timerFlash = true
    mount('features')
    const t = titles()
    expect(t).toContain('Flash the screen')
    expect(t).toContain('Keep timing after target')
    expect(t).toContain('Reduce motion')
    expect(t).toContain('Filter by equipment')          // this test's profile has an equipment profile
    expect(t).not.toContain('Workout day reminder')     // no reminders for a guest in a browser
    expect(t).not.toContain('Auto-backup on changes')   // the phone app's
    expect(valueOf(rowTitled('Flash the screen'))).toBe('On')
    expect(rowTitled('Flash the screen').querySelector('.g-glist-body span, .lrow-s').textContent).toBe('Workout screen')
    expect(valueOf(rowTitled('Reduce motion'))).toBe('Off')
    act(() => rowTitled('Flash the screen').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/workout', { state: { find: 'Flash the screen' } }])
  })

  it('a reminder that waits on push opens Reminders with Push notifications to flash instead', () => {
    mocks.MOBILE = true
    mount('features')
    act(() => rowTitled('Workout day reminder').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/reminders', { state: { find: 'Workout day reminder', via: 'Push notifications' } }])
  })

  it('every row it lists starts off in a new profile', async () => {
    const { freshState } = await vi.importActual('../store/useStore.js')
    const listed = SEARCH.filter(e => e.feature)
    expect(listed.length).toBeGreaterThan(10)
    for (const e of listed) expect(e.feature(freshState(), { baseLang: 'de', systemMotion: false }), e.title).not.toBe(true)
  })

  // Every switch a new profile shows off, on every page, has to be on Features: a browser signed
  // in with push, an Android phone, and an Android phone with the reminder on (for its nudge).
  it('lists every switch that is off in a new profile, wherever it is', async () => {
    const { freshState } = await vi.importActual('../store/useStore.js')
    const scenarios = {
      'web, signed in, push': () => { mocks.user = { id: 'u1', name: 'Dana' }; mocks.sync = { status: 'ok', server: 'https://gym.example' }; mocks.push = true },
      'Android phone': () => { mocks.MOBILE = true; mocks.android = true },
      'Android phone, reminder on': () => { mocks.MOBILE = true; mocks.android = true; mocks.S.reminder = { ...mocks.S.reminder, on: true } },
    }
    for (const [name, setUp] of Object.entries(scenarios)) {
      mocks.S = { ...freshState(), lang: 'en', equipProfiles: [{ id: 'p1', name: 'Home', equipment: [] }] }
      mocks.user = null; mocks.sync = null; mocks.MOBILE = false; mocks.android = false; mocks.push = false
      setUp()
      const off = new Set()
      for (const page of PAGE_IDS) {
        // Equipment is Gym setup, off this shell; its one switch is on Features through the search list
        if (page === 'features' || page === 'account' || page === 'equipment' || !pageExists(page, { user: mocks.user, mobile: mocks.MOBILE })) continue
        mount(page)
        await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve() })
        for (const row of host.querySelectorAll('.lrow, .g-glist-row')) {
          if (row.querySelector('[role="switch"][aria-checked="false"]')) off.add((row.querySelector('.lrow-t') || row.querySelector('.g-glist-body > b')).textContent)
        }
        for (const row of host.querySelectorAll('.g-glist-row')) {
          if (row.querySelector('[role="switch"][aria-checked="false"]')) off.add(row.querySelector('b').textContent)
        }
        act(() => root.render(null))
      }
      mount('features')
      await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve() })
      const have = titles()
      expect(off.size, name).toBeGreaterThan(3)
      for (const title of off) expect(have, `${name}: ${title}`).toContain(title)
    }
  })
})

describe('Appearance', () => {
  it('keeps reduce motion, and drops nothing else of its own', () => {
    mount('appearance')
    expect(titles()).toEqual(['Accent color', 'Ready-made', 'Theme', 'Background', 'Pictures', 'Body diagram', 'Exercise drawings',
      'On screen', 'Reduce motion', 'Reduce transparency', 'Gym check-in', 'Add card', 'Show connection status'])
    act(() => rowTitled('Reduce motion').querySelector('[role="switch"]').click())
    expect(mocks.S.reduceMotion).toBe(true)
  })

  it('Background is its own page: the picker for the looks and the Intensity heading search finds', () => {
    mount('background')
    expect(titles()).toEqual(['Intensity', 'Built in', 'Calm behind the ring', 'Quiet under cards', 'Slow drift'])
    expect(host.querySelectorAll('.g-lgrid [role="radio"]')).toHaveLength(6)
  })

  it('reduce motion shows on, and says why, when the device already reduces motion', () => {
    const real = window.matchMedia
    window.matchMedia = q => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
    try {
      mount('appearance')
      const sw = rowTitled('Reduce motion').querySelector('[role="switch"]')
      expect(sw.getAttribute('aria-checked')).toBe('true')
      expect(sw.disabled).toBe(true)
      expect(rowTitled('Reduce motion').querySelector('.g-glist-body > span').textContent).toBe('Follows your phone. Rings appear without drawing in; looks stand still')
      mount('features')
      expect(valueOf(rowTitled('Reduce motion'))).toBe('On')
    } finally { window.matchMedia = real }
  })
})
