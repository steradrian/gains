// @vitest-environment happy-dom
// Import (boards St1Import to St1Imported): the sources, a file going to the importer with the
// done screen wired in, and the Hevy key fetched with a progress screen, then previewed.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({ toast: vi.fn(), importFromApp: vi.fn(), showHevyPreview: vi.fn(), importHevyData: vi.fn(), keySubmit: null, navs: [] }))
vi.mock('react-router-dom', () => ({ useNavigate: () => p => m.navs.push(p) }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../../../store/useStore.js', () => {
  const snap = () => ({ S: { unit: 'kg', customEx: [] } })
  const useStore = s => (s ? s(snap()) : snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m.toast }) } }))
vi.mock('../../../sheets.jsx', () => ({ importFromApp: (...a) => m.importFromApp(...a), showHevyPreview: (...a) => m.showHevyPreview(...a) }))
vi.mock('../../../lib/import-hevy.js', async orig => ({ ...(await orig()), importHevyData: (...a) => m.importHevyData(...a) }))
vi.mock('./hevy-key-sheet.jsx', () => ({ openHevyKeySheet: fn => { m.keySubmit = fn } }))

const { default: ImportPage } = await import('./ImportPage.jsx')

let host, root
beforeEach(() => {
  Object.values(m).forEach(v => v?.mockClear?.()); m.navs = []; m.keySubmit = null
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const outcome = { kind: 'workouts', source: 'Strong', imported: 2, sets: 6, matched: 3, newNames: [], leftAlone: 0, from: '2026-01-01', to: '2026-01-02' }

describe('ImportPage', () => {
  it('lists the sources the importer reads, and Hevy’s key import', () => {
    act(() => root.render(<ImportPage />))
    for (const s of ['Strong', 'Hevy', 'FitNotes', 'Gravl', 'Apple Health', 'Your own CSV', 'Import from Hevy']) expect(row(s), s).toBeTruthy()
    expect(host.textContent).toContain('so importing twice never duplicates')
  })

  it('a picked file goes to the importer, and what it reports opens the done screen', async () => {
    act(() => root.render(<ImportPage />))
    const input = host.querySelector('input[type="file"]')
    const file = new File(['x'], 'export.csv')
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(m.importFromApp).toHaveBeenCalledTimes(1)
    expect(m.importFromApp.mock.calls[0][0]).toBe(file)
    act(() => { m.importFromApp.mock.calls[0][1].onImported(outcome) })
    expect(host.textContent).toContain('2 workouts imported')
  })

  it('Apple Health offers xml files, the others csv', () => {
    act(() => root.render(<ImportPage />))
    const input = host.querySelector('input[type="file"]')
    vi.spyOn(input, 'click').mockImplementation(() => {})
    act(() => { row('Apple Health').click() })
    expect(input.accept).toContain('.xml')
    act(() => { row('Strong').click() })
    expect(input.accept).toContain('.csv')
  })

  it('Hevy: the key fetches with a progress screen, then the preview opens; the key goes to Hevy only', async () => {
    let progress
    m.importHevyData.mockImplementation(async (key, opts) => {
      progress = opts.onProgress
      await new Promise(r => setTimeout(r, 0))
      return { workouts: { workouts: [{}] }, routines: { routines: [] }, bodyweight: { bodyweight: [] } }
    })
    act(() => root.render(<ImportPage />))
    act(() => { row('Import from Hevy').click() })
    let pending
    act(() => { pending = m.keySubmit('secret-key') })
    expect(m.importHevyData.mock.calls[0][0]).toBe('secret-key')
    expect(host.textContent).toContain('Importing')
    act(() => { progress({ stage: 'workouts', page: 1, pageCount: 2 }) })
    expect(host.textContent).toContain('Fetching workouts… (1/2)')
    await act(async () => { await pending })
    expect(m.showHevyPreview).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('Import')
    act(() => { m.showHevyPreview.mock.calls[0][1].onImported({ ...outcome, kind: 'hevy', source: 'Hevy' }) })
    expect(host.textContent).toContain('Import done')
  })

  it('Cancel stops waiting: a result that arrives later opens nothing', async () => {
    let release
    m.importHevyData.mockImplementation(() => new Promise(r => { release = r }))
    act(() => root.render(<ImportPage />))
    act(() => { row('Import from Hevy').click() })
    act(() => { m.keySubmit('k') })
    act(() => { [...host.querySelectorAll('button')].find(b => b.textContent === 'Cancel').click() })
    expect(row('Strong')).toBeTruthy()
    await act(async () => { release({ workouts: { workouts: [{}] }, routines: { routines: [] }, bodyweight: { bodyweight: [] } }); await settle() })
    expect(m.showHevyPreview).not.toHaveBeenCalled()
  })

  it('a refused key says so and returns to the sources', async () => {
    const { HevyApiError } = await import('../../../lib/import-hevy.js')
    m.importHevyData.mockRejectedValue(new HevyApiError('auth'))
    act(() => root.render(<ImportPage />))
    act(() => { row('Import from Hevy').click() })
    await act(async () => { m.keySubmit('bad'); await settle() })
    expect(m.toast).toHaveBeenCalledWith('That Hevy API key was refused')
    expect(row('Strong')).toBeTruthy()
  })
})
