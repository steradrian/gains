// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtDate, isoOf, todayISO } from '../../../lib/format.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { openAddPhoto } from './photo-drawers.jsx'

const picker = vi.hoisted(() => ({ pick: vi.fn(), state: { busy: false, canAdd: true, showAdd: true, note: null } }))
vi.mock('../../../components/CustomMediaField.jsx', () => ({ useMediaPicker: () => ({ pick: picker.pick, ...picker.state }) }))
vi.mock('../../../lib/media-sync.js', () => ({ syncMedia: vi.fn() }))
vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))

const REF = { kind: 'image', hash: 'a'.repeat(64), mime: 'image/jpeg', size: 1000, width: 800, height: 600, at: 1 }
const mounted = []
const S = () => useStore.getState().S
const YESTERDAY = isoOf(new Date(Date.now() - 864e5))

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const row = (host, title) => [...host.querySelectorAll('.g-drow')].find(r => r.querySelector('b').textContent === title)
const pickFile = async input => {
  const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  document.body.innerHTML = ''
  picker.pick.mockReset().mockResolvedValue(REF)
  Object.assign(picker.state, { busy: false, canAdd: true, showAdd: true, note: null })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', bodyweight: [], bodyPhotos: [], workouts: [], photoBackup: false } }))
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Add photo', () => {
  it('is a design system drawer on Today with the two ways in and the hint', () => {
    openAddPhoto()
    const host = renderTop()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(host.querySelector('.g-bs h2').textContent).toBe('Add photo')
    expect(host.querySelector('.g-bs-chip').textContent).toBe('Today')
    expect(row(host, 'Take a photo')).toBeDefined()
    expect(row(host, 'Choose from library')).toBeDefined()
    expect(host.querySelector('.ph-hint').textContent).toBe('Same light, same spot, same pose makes Compare honest. Only you see photos.')
  })

  it('saves the chosen photo on Today as a progress photo, closes, and says so', async () => {
    openAddPhoto()
    const host = renderTop()
    await pickFile(host.querySelectorAll('input[type="file"]')[1])
    expect(S().bodyPhotos).toHaveLength(1)
    expect(S().bodyPhotos[0]).toMatchObject({ d: todayISO(), ref: { hash: REF.hash } })
    expect(S().workouts).toEqual([])
    expect(useUI.getState().toastMsg).toBe('Photo added')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('takes a photo through the camera input', () => {
    openAddPhoto()
    const host = renderTop()
    const camera = host.querySelector('input[capture]')
    expect(camera.getAttribute('accept')).toBe('image/*')
    expect(host.querySelectorAll('input[type="file"]')).toHaveLength(2)
  })

  it('saves on a past day picked with the date picker, never one to come', async () => {
    openAddPhoto()
    const host = renderTop()
    const date = host.querySelector('input[type="date"]')
    expect(date.getAttribute('max')).toBe(todayISO())
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(date, YESTERDAY)
      date.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(host.querySelector('.g-bs-chip').textContent).toBe(fmtDate(YESTERDAY, true))
    await pickFile(host.querySelectorAll('input[type="file"]')[1])
    expect(S().bodyPhotos[0].d).toBe(YESTERDAY)
  })

  it('says so, and keeps the drawer, when that photo is already on the day', async () => {
    useStore.setState(s => ({ S: { ...s.S, bodyPhotos: [{ id: 'p1', d: todayISO(), ref: REF, addedAt: 1 }] } }))
    openAddPhoto()
    const host = renderTop()
    await pickFile(host.querySelectorAll('input[type="file"]')[1])
    expect(S().bodyPhotos).toHaveLength(1)
    expect(useUI.getState().toastMsg).toBe('That photo is already on this day.')
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('saves nothing when the file could not be read', async () => {
    picker.pick.mockResolvedValue(null)
    openAddPhoto()
    const host = renderTop()
    await pickFile(host.querySelectorAll('input[type="file"]')[1])
    expect(S().bodyPhotos).toEqual([])
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('offers no way in where the server stores no photos, and says why', () => {
    Object.assign(picker.state, { showAdd: false, canAdd: false, note: 'Your server does not store photos and videos yet.' })
    openAddPhoto()
    const host = renderTop()
    expect(row(host, 'Take a photo')).toBeUndefined()
    expect(host.querySelectorAll('.ph-hint')[0].textContent).toBe('Your server does not store photos and videos yet.')
  })
})
