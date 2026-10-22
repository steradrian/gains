// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtDate } from '../../../lib/format.js'
import { _setMediaStore, createMediaStore, memoryBackend } from '../../../lib/media-store.js'
import { allPhotos } from '../../../lib/me/photos.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { openCompare, openViewer } from './photo-overlays.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))
vi.mock('../../../lib/media-sync.js', async orig => ({ ...(await orig()), syncMedia: vi.fn() }))

const hex = c => c.repeat(64)
const img = c => ({ kind: 'image', hash: hex(c), mime: 'image/jpeg', size: 4, width: 800, height: 600, at: 1 })
const SIX = [['p1', '2026-10-18', '1', 81.4], ['p2', '2026-10-04', '2', 82.1], ['p3', '2026-09-20', '3', 83], ['p4', '2026-09-06', '4', 83.6], ['p5', '2026-08-23', '5', 84.3], ['p6', '2026-08-02', '6', 85]]
const S = () => useStore.getState().S
const setS = (rows = SIX, over = {}) => useStore.setState(s => ({
  S: {
    ...s.S, unit: 'kg', photoBackup: false, workouts: [], deleted: {}, measurements: [],
    bodyweight: rows.map(([, d, , w]) => ({ d, w })),
    bodyPhotos: rows.map(([id, d, c]) => ({ id, d, ref: img(c), addedAt: 10 })),
    ...over,
  },
}))
const source = () => ({ url: 'blob:x', status: 'ready' })
const photos = () => allPhotos(S())

const mounted = []
const renderSheet = sheet => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const renderTop = () => renderSheet(useUI.getState().sheets.at(-1))
const button = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label)
const key = (host, k) => act(() => { host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })
const count = host => host.querySelector('.g-pstage-count').textContent

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('dir')
  _setMediaStore(createMediaStore(memoryBackend()))
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  setS()
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }); _setMediaStore(null) })

describe('the photo viewer', () => {
  it('shows the day as the title, the count, the picture and that day\'s weight', () => {
    openViewer(photos()[2], { source })
    const host = renderTop()
    expect(useUI.getState().sheets[0].kind).toBe('viewer')
    expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Photo')
    expect(host.querySelector('.g-pstage-title').textContent).toBe(fmtDate('2026-09-20', true, true))
    expect(count(host)).toBe('3 of 6')
    expect(host.querySelector('.g-pstage-count').getAttribute('aria-live')).toBe('polite')
    expect(host.querySelector('.g-pstage-pic img').getAttribute('src')).toBe('blob:x')
    expect(host.querySelector('.g-pstage-cap b').textContent).toBe(fmtDate('2026-09-20', true))
    expect(host.querySelector('.g-pstage-cap span').textContent).toBe('83 kg that day')
  })

  it('leaves the weight out when that day has none', () => {
    setS(SIX, { bodyweight: [] })
    openViewer(photos()[0], { source })
    expect(renderTop().querySelector('.g-pstage-cap span')).toBeNull()
  })

  it('moves with the arrow keys and the edge buttons, announces the count, and stops at both ends', () => {
    openViewer(photos()[0], { source })
    const host = renderTop()
    expect(button(host, 'Previous photo')).toBeUndefined()
    key(host, 'ArrowRight')
    expect(count(host)).toBe('2 of 6')
    key(host, 'ArrowLeft')
    expect(count(host)).toBe('1 of 6')
    key(host, 'ArrowLeft')
    expect(count(host)).toBe('1 of 6')
    act(() => button(host, 'Next photo').click())
    expect(count(host)).toBe('2 of 6')
    for (let n = 0; n < 8; n++) key(host, 'ArrowRight')
    expect(count(host)).toBe('6 of 6')
    expect(button(host, 'Next photo')).toBeUndefined()
    expect(host.querySelector('.g-pstage-title').textContent).toBe(fmtDate('2026-08-02', true, true))
  })

  it('swaps the arrow keys in a right-to-left language', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    openViewer(photos()[0], { source })
    const host = renderTop()
    key(host, 'ArrowLeft')
    expect(count(host)).toBe('2 of 6')
  })

  it('swipes: a drag toward the start edge shows the next photo', () => {
    openViewer(photos()[0], { source })
    const host = renderTop()
    const pic = host.querySelector('.g-pstage-pic')
    const drag = (from, to) => act(() => {
      pic.dispatchEvent(new MouseEvent('pointerdown', { clientX: from, bubbles: true }))
      pic.dispatchEvent(new MouseEvent('pointerup', { clientX: to, bubbles: true }))
    })
    drag(200, 120)
    expect(count(host)).toBe('2 of 6')
    drag(200, 180)
    expect(count(host)).toBe('2 of 6')
    drag(100, 200)
    expect(count(host)).toBe('1 of 6')
  })

  it('opens Compare with this photo and the nearest older one, over the viewer; Close leaves', () => {
    openViewer(photos()[1], { source })
    const host = renderTop()
    act(() => button(host, 'Compare').click())
    expect(useUI.getState().sheets).toHaveLength(2)
    const cmp = renderTop()
    expect([...cmp.querySelectorAll('.g-cmp-cap b')].map(b => b.textContent)).toEqual([fmtDate('2026-09-20', true), fmtDate('2026-10-04', true)])
    act(() => button(cmp, 'Close').click())
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('has Compare disabled when it is the only photo', () => {
    setS(SIX.slice(0, 1))
    openViewer(photos()[0], { source })
    const host = renderTop()
    expect(count(host)).toBe('1 of 1')
    expect(button(host, 'Compare').disabled).toBe(true)
    expect(button(host, 'Next photo')).toBeUndefined()
  })

  it('reads "On another phone" for a file no device here has', () => {
    openViewer(photos()[0], { source: () => ({ url: null, status: 'missing' }) })
    expect(renderTop().querySelector('.g-pstage-gone').textContent).toBe('On another phone')
  })

  it('Delete asks first, says what goes, and on confirm removes the photo and closes the viewer', async () => {
    openViewer(photos()[1], { source })
    const host = renderTop()
    act(() => button(host, 'Delete').click())
    expect(useUI.getState().sheets).toHaveLength(2)
    expect(S().bodyPhotos).toHaveLength(6)
    const ask = renderTop()
    expect(ask.textContent).toContain('Delete this photo?')
    expect(ask.textContent).toContain('This photo goes from your photos.')
    expect(ask.textContent).not.toContain('workout')
    expect(ask.textContent).not.toContain('backup')
    act(() => ask.querySelector('.g-confirm-danger').click())
    await vi.waitFor(() => expect(S().bodyPhotos.map(p => p.id)).not.toContain('p2'))
    await vi.waitFor(() => expect(useUI.getState().sheets).toHaveLength(0))
    expect(useUI.getState().toastMsg).toBe('Photo deleted')
  })

  it('Cancel leaves the photo and the viewer alone', () => {
    openViewer(photos()[1], { source })
    const host = renderTop()
    act(() => button(host, 'Delete').click())
    const ask = renderTop()
    act(() => button(ask, 'Cancel').click())
    expect(S().bodyPhotos).toHaveLength(6)
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('names the workout and the backup in the confirm only when they apply', () => {
    setS(SIX.slice(0, 1), {
      photoBackup: true,
      workouts: [{ id: 'w1', d: '2026-10-11', start: 1, end: 2, entries: [], media: [img('a')] }],
    })
    const w = photos().find(p => p.source === 'workout')
    openViewer(w, { source })
    const viewer = renderTop()
    act(() => button(viewer, 'Delete').click())
    const ask = renderTop()
    expect(ask.textContent).toContain('Photos in a workout leave that workout too.')
    expect(ask.textContent).toContain('It is also removed from your backup.')
  })
})

describe('Compare', () => {
  const open = (opts = {}) => { openCompare(photos(), { source, ...opts }); return renderTop() }

  it('starts on the oldest and the newest with the change between them', () => {
    setS(SIX, { measurements: [{ d: '2026-08-01', waist: 92 }, { d: '2026-10-10', waist: 88 }] })
    const host = open()
    expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Compare photos')
    expect([...host.querySelectorAll('.g-cmp-cap')].map(c => c.textContent)).toEqual([
      fmtDate('2026-08-02', true) + '85 kg', fmtDate('2026-10-18', true) + '81.4 kg',
    ])
    expect(host.querySelector('.g-cmp-line').textContent).toBe('77 days apart · -3.6 kg · waist -4 cm')
    expect(host.querySelector('.g-cmp-pair').getAttribute('dir')).toBe('ltr')
    expect([...host.querySelectorAll('.g-cmp-side button')].map(b => b.textContent)).toEqual(['Change before', 'Change after'])
  })

  it('leaves the weight and waist out without weigh-ins or measurements', () => {
    setS(SIX, { bodyweight: [] })
    const host = open()
    expect([...host.querySelectorAll('.g-cmp-cap')].map(c => c.textContent)).toEqual([fmtDate('2026-08-02', true), fmtDate('2026-10-18', true)])
    expect(host.querySelector('.g-cmp-line').textContent).toBe('77 days apart')
  })

  it('opens a picker of the other photos inside the overlay, and the pick goes back in date order', () => {
    const host = open()
    act(() => button(host, 'Change before').click())
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(host.querySelector('.g-pstage-title').textContent).toBe('Choose the before photo')
    expect(host.querySelectorAll('.g-ptile')).toHaveLength(5)
    act(() => host.querySelectorAll('.g-ptile')[2].click())
    expect([...host.querySelectorAll('.g-cmp-cap b')].map(b => b.textContent)).toEqual([fmtDate('2026-09-06', true), fmtDate('2026-10-18', true)])
    expect(host.querySelector('.g-cmp-line').textContent).toBe('42 days apart · -2.2 kg')
  })

  it('picking a newer photo for "before" swaps the sides, and Back returns without changing', () => {
    const host = open({ pair: [photos()[3], photos()[1]] })
    act(() => button(host, 'Change after').click())
    act(() => button(host, 'Back').click())
    expect(host.querySelector('.g-cmp-line').textContent).toContain('28 days apart')
    act(() => button(host, 'Change before').click())
    act(() => host.querySelectorAll('.g-ptile')[0].click())
    expect([...host.querySelectorAll('.g-cmp-cap b')].map(b => b.textContent)).toEqual([fmtDate('2026-10-04', true), fmtDate('2026-10-18', true)])
  })

  it('an empty side (no device here has the file) says so, keeps its day and weight, and the other side still shows', () => {
    const host = open({ source: p => (p.id === 'p6' ? { url: null, status: 'missing' } : source()) })
    const sides = [...host.querySelectorAll('.g-cmp-side')]
    expect(sides[0].querySelector('.g-pstage-gone').textContent).toBe('On another phone')
    expect(sides[0].querySelector('.g-cmp-cap').textContent).toBe(fmtDate('2026-08-02', true) + '85 kg')
    expect(sides[1].querySelector('img')).not.toBeNull()
    expect(sides[1].querySelector('.g-pstage-gone')).toBeNull()
    // The empty side can still be changed.
    act(() => button(host, 'Change before').click())
    act(() => host.querySelectorAll('.g-ptile')[0].click())
    expect(host.querySelector('.g-cmp-side .g-pstage-gone')).toBeNull()
  })

  it('needs two photos', () => {
    openCompare([photos()[0]])
    openCompare(undefined)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('keeps the pair left-to-right in a right-to-left language, before on the left', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    const host = open()
    expect(host.querySelector('.g-cmp-pair').getAttribute('dir')).toBe('ltr')
    expect(host.querySelector('.g-cmp-side .g-cmp-cap b').textContent).toBe(fmtDate('2026-08-02', true))
  })
})
