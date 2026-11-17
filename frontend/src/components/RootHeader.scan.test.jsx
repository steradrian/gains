// @vitest-environment happy-dom
// The barcode button in the search pill logs where the + sheet's Scan does: to the date every
// tab shares and the meal picked, not to today and whatever the clock says. The camera is mocked
// (it hands the sheet a code); NutriTrace is faked at the fetch boundary.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { isoOf, todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { createFakeNutriTrace, fixtureDay } from '../lib/nutrition/fake-nutritrace.js'
import { endSearch } from '../lib/search/session.js'
import { resetCamera, seeCode } from '../lib/use-camera-scan.fake.js'
import RootHeader from './RootHeader.jsx'

vi.mock('../lib/use-camera-scan.js', async () => ({ useCameraScan: (await import('../lib/use-camera-scan.fake.js')).fakeCamera }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoOf(d) })()
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const button = (label, scope = host) => [...scope.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const click = async el => { await act(async () => { el.click() }); await settle() }
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)

beforeEach(() => {
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY), [yesterday]: fixtureDay(yesterday) } })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState(s => ({
    user: { id: 3, name: 'Ana' },
    pushState: vi.fn(async () => {}),
    S: { ...s.S, routines: [], workouts: [], dayPlan: {}, week: {}, active: null, checkIn: false, unit: 'kg' },
  }))
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  resetCamera()
  history.replaceState({ idx: 0 }, '')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  act(() => endSearch())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the search pill\'s barcode button', () => {
  it('logs the scanned food to the shared date and the meal picked', async () => {
    await act(async () => { await useNutrition.getState().loadSettings() })
    act(() => {
      useDiarySelection.getState().setDate(yesterday)
      useDiarySelection.getState().setMeal(2)
    })
    await act(async () => { root.render(<MemoryRouter initialEntries={['/food']}><RootHeader title="Nutrition" /><Sheets /></MemoryRouter>) })
    await act(async () => { host.querySelector('.g-spill-field input').focus() })
    await click(button('Scan barcode'))
    await act(async () => { seeCode('5000000000001') })
    await settle()
    // One of your own foods goes straight to Amount.
    expect(lastSheet().textContent).toContain('Wholemeal bread')
    await click(button('Add to Dinner', lastSheet()))
    const put = nt.writes().find(r => r.method === 'PUT')
    expect(put.path).toBe(`/nt/api/diary/${yesterday}`)
    expect(put.body.items.at(-1)).toMatchObject({ name: 'Wholemeal bread', meal: 2 })
  })
})
