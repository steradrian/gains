// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* A2.7 and A2.8, Download my data: what the drawer says the file holds (counted from the profile),
   Prepare download building a JSON file or, with photos and videos, the .zip, and the toast whose
   Save hands the built file over. */
const mocks = vi.hoisted(() => ({ S: {}, files: [], toast: null, buildJson: null, buildZip: null, saveFile: null }))
vi.mock('../../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: vi.fn() })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../../lib/media-refs.js', () => ({ referencedFiles: () => mocks.files }))
vi.mock('../use-data-actions.js', () => ({
  useDataActions: () => ({ buildJson: (...a) => mocks.buildJson(...a), buildZip: (...a) => mocks.buildZip(...a), saveFile: (...a) => mocks.saveFile(...a) }),
}))

const { DownloadSheet } = await import('./download-sheet.jsx')

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const items = n => Array.from({ length: n }, (_, i) => ({ id: i }))
const rowText = (host, title) => [...host.querySelectorAll('.g-drow')].find(r => r.querySelector('b').textContent === title)?.textContent

beforeEach(() => {
  mocks.S = { workouts: items(212), routines: items(6), bodyweight: items(1), measurements: items(41) }
  mocks.files = []
  mocks.toast = vi.fn()
  mocks.buildJson = vi.fn(() => ({ name: 'gains-backup-2026-10-22.json', json: '{}' }))
  mocks.buildZip = vi.fn(async () => ({ name: 'gains-backup-2026-10-22.zip', blob: new Blob(['z']), missing: 0 }))
  mocks.saveFile = vi.fn(async () => true)
})
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('A2.7 Download my data', () => {
  it('says what the file holds, counted from the profile, and leaves out photos when there are none', () => {
    const host = mount(<DownloadSheet close={() => {}} />)
    expect(host.querySelector('h2').textContent).toBe('Download my data')
    expect(rowText(host, 'Training')).toContain('212 workouts, 6 routines')
    expect(rowText(host, 'Body')).toContain('1 weigh-in, 41 measurements')
    expect(rowText(host, 'Photos')).toBeUndefined()
    expect(host.textContent).toContain('A JSON file anyone can read.')
  })

  it('lists the photos and videos, and promises a .zip, when the profile has them', () => {
    mocks.files = items(6)
    const host = mount(<DownloadSheet close={() => {}} />)
    expect(rowText(host, 'Photos')).toContain('6 photos or videos')
    expect(host.textContent).toContain('A .zip with your data')
  })

  it('a profile with nothing counts zero rather than inventing numbers', () => {
    mocks.S = {}
    const host = mount(<DownloadSheet close={() => {}} />)
    expect(rowText(host, 'Training')).toContain('0 workouts, 0 routines')
  })
})

describe('Prepare download and A2.8 Save', () => {
  it('builds the JSON file, closes, and Save in the toast hands that file over', async () => {
    const close = vi.fn()
    const host = mount(<DownloadSheet close={close} />)
    await act(async () => { button(host, 'Prepare download').click() })
    expect(mocks.buildJson).toHaveBeenCalledTimes(1)
    expect(mocks.buildZip).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledTimes(1)
    const [message, opts] = mocks.toast.mock.calls.at(-1)
    expect(message).toBe('Your data is ready')
    expect(opts.action).toBe('Save')
    expect(opts.body).toBe('gains-backup-2026-10-22.json')
    // Nothing is saved until the person taps Save.
    expect(mocks.saveFile).not.toHaveBeenCalled()
    opts.onAction()
    expect(mocks.saveFile).toHaveBeenCalledWith({ name: 'gains-backup-2026-10-22.json', json: '{}' })
  })

  it('with photos and videos it builds the .zip instead', async () => {
    mocks.files = items(2)
    const close = vi.fn()
    const host = mount(<DownloadSheet close={close} />)
    await act(async () => { button(host, 'Prepare download').click() })
    expect(mocks.buildZip).toHaveBeenCalledTimes(1)
    expect(mocks.buildJson).not.toHaveBeenCalled()
    expect(mocks.toast.mock.calls.at(-1)[1].body).toBe('gains-backup-2026-10-22.zip')
    expect(close).toHaveBeenCalled()
  })

  it('a zip that could not be built stays on the drawer, with no toast (the builder said why)', async () => {
    mocks.files = items(2)
    mocks.buildZip = vi.fn(async () => null)
    const close = vi.fn()
    const host = mount(<DownloadSheet close={close} />)
    await act(async () => { button(host, 'Prepare download').click() })
    expect(close).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(button(host, 'Prepare download')).toBeTruthy()
  })
})
