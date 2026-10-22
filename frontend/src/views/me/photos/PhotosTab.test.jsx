// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtDate } from '../../../lib/format.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import PhotosTab from './PhotosTab.jsx'
import { PhotoSourceContext } from './PhotoThumb.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))
vi.mock('../../../components/CustomMediaField.jsx', () => ({
  useMediaPicker: () => ({ pick: vi.fn(), busy: false, canAdd: true, showAdd: true, note: null }),
}))

const hex = c => c.repeat(64)
const img = c => ({ kind: 'image', hash: hex(c), mime: 'image/jpeg', size: 1000, width: 800, height: 600, at: 1 })
const own = (id, d, c) => ({ id, d, ref: img(c), addedAt: 10 })

const mounted = []
let host
const S = () => useStore.getState().S
const setS = over => useStore.setState(s => ({ S: { ...s.S, unit: 'kg', bodyweight: [], bodyPhotos: [], workouts: [], photoBackup: false, ...over } }))
const mount = (source = () => ({ url: 'blob:x', status: 'ready' })) => {
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<PhotoSourceContext.Provider value={source}><PhotosTab /></PhotoSourceContext.Provider>))
}
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  document.body.innerHTML = ''
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('the Photos tab', () => {
  const two = { bodyweight: [{ d: '2026-10-18', w: 81.4 }], bodyPhotos: [own('p1', '2026-10-18', 'a'), own('p2', '2026-10-04', 'b')] }

  it('lists the photos newest first, each with its day and that day\'s weight, and opens one on tap', () => {
    setS(two)
    mount()
    const tiles = [...host.querySelectorAll('.g-phgrid .g-ptile')]
    expect(tiles.map(t => t.querySelector('.g-ptile-date').textContent)).toEqual([fmtDate('2026-10-18', true), fmtDate('2026-10-04', true)])
    expect(tiles[0].querySelector('.g-ptile-cap').textContent).toBe('81.4 kg')
    expect(tiles[1].querySelector('.g-ptile-cap')).toBeNull()
    act(() => tiles[0].click())
    expect(useUI.getState().sheets.at(-1).kind).toBe('viewer')
  })

  it('shows Back up photos off, the phone wording and the footer that matches', () => {
    setS(two)
    mount()
    expect(host.querySelector('.g-grow b').textContent).toBe('Back up photos')
    expect(host.querySelector('.g-grow .g-grow-k').textContent).toBe('Off · turn on to keep them across devices')
    expect(host.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('false')
    expect(host.querySelector('.g-ssec h2').textContent).toBe('On this phone')
    expect(host.querySelector('.g-ssec-act').textContent).toBe('2')
    expect(host.querySelector('.g-snote').textContent).toBe('Stored on this phone only. Only you see them; Friends never do.')
    expect(host.textContent).not.toMatch(/encrypt/i)
  })

  it('turning backup on writes the setting and offers Undo for the photos going up', () => {
    setS(two)
    mount()
    act(() => host.querySelector('[role="switch"]').click())
    expect(S().photoBackup).toBe(true)
    expect(useUI.getState().toastMsg).toBe('Backing up 2 photos to your account')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(host.querySelector('.g-ssec h2').textContent).toBe('In your account')
    expect(host.querySelector('.g-snote').textContent).toBe('Backed up to your account. Only you see them; Friends never do.')
    act(() => useUI.getState().runToastAction())
    expect(S().photoBackup).toBe(false)
  })

  it('turning backup off needs no toast, and turning it on with nothing held says nothing', () => {
    setS({ ...two, photoBackup: true })
    mount()
    act(() => host.querySelector('[role="switch"]').click())
    expect(S().photoBackup).toBe(false)
    expect(useUI.getState().toastMsg).toBe('')
    setS({ bodyPhotos: [], workouts: [{ id: 'w1', d: '2026-10-10', start: 5, end: 6, entries: [], media: [img('c')] }] })
    act(() => host.querySelector('[role="switch"]').click())
    expect(S().photoBackup).toBe(true)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('opens the Add photo drawer from the button and Compare from the other', () => {
    setS(two)
    mount()
    act(() => button('Add photo').click())
    expect(useUI.getState().sheets.at(-1).variant).toBe('ds')
    useUI.setState({ sheets: [] })
    act(() => button('Compare').click())
    expect(useUI.getState().sheets.at(-1).kind).toBe('viewer')
  })

  it('with one photo, Compare is a disabled button and the line says why', () => {
    setS({ bodyPhotos: [own('p1', '2026-10-18', 'a')] })
    mount()
    const compare = button('Compare')
    expect(compare.disabled).toBe(true)
    const line = host.querySelector('.ph-line')
    expect(line.textContent).toBe('Add one more photo to compare.')
    expect(compare.getAttribute('aria-describedby')).toBe(line.id)
  })

  it('reads "On another phone" for a file no device here has', () => {
    setS(two)
    mount(photo => (photo.key === 'own:p2' ? { url: null, status: 'missing' } : { url: 'blob:x', status: 'ready' }))
    const tiles = [...host.querySelectorAll('.g-ptile')]
    expect(tiles[0].querySelector('img')).not.toBeNull()
    expect(tiles[1].querySelector('.g-ptile-gone').textContent).toBe('On another phone')
    expect(tiles[1].querySelector('img')).toBeNull()
  })

  it('shows quiet glass, not "On another phone", while a picture loads', () => {
    setS(two)
    mount(() => ({ url: null, status: 'loading' }))
    expect(host.querySelector('.g-ptile-gone')).toBeNull()
  })

  it('with no photos it is the empty state: no Compare, no grid, Add photo opens the drawer', () => {
    setS({})
    mount()
    const empty = host.querySelector('.g-sempty')
    expect(empty.className).not.toContain('g-sempty-card')
    expect(empty.querySelector('b').textContent).toBe('No photos yet')
    expect(empty.textContent).toContain('Take one every two weeks, same light and pose. Compare lines up any two by date. They stay on this phone unless you turn on backup.')
    expect(button('Compare')).toBeUndefined()
    expect(host.querySelector('.g-phgrid')).toBeNull()
    act(() => button('Add photo').click())
    expect(useUI.getState().sheets.at(-1).variant).toBe('ds')
  })
})
