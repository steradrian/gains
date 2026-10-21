// @vitest-environment happy-dom
// Barcode scanning (boards Ea9*): the dark camera overlay over the + sheet and the picker, down to
// the food logged. The camera is a stand-in (lib/use-camera-scan.fake.js) that reads what the test
// tells it; the lookups run against NutriTrace faked at the fetch boundary, under the hub's rules
// for the proxy.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setNav } from '../lib/nav.js'
import { todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { createFakeNutriTrace, fixtureDay, fixtureOffProduct } from '../lib/nutrition/fake-nutritrace.js'
import { camera, resetCamera, seeCode } from '../lib/use-camera-scan.fake.js'
import { openPlusSheet } from './PlusSheet.jsx'
import FoodPicker from './FoodPicker.jsx'
import { scanSheet } from './ScanSheet.jsx'

vi.mock('../lib/use-camera-scan.js', async () => ({ useCameraScan: (await import('../lib/use-camera-scan.fake.js')).fakeCamera }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  // a drawer's sub-panels are drawn as sheets of their own here
  return sheets.flatMap(s => [s, ...(s.panels || [])]).map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
const settle = async (ms = 0) => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const mount = async el => { await act(async () => { root.render(<>{el}<Sheets /></>) }); await settle() }
const button = (label, scope = host) => [...scope.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const click = async el => { await act(async () => { el.click() }); await settle() }
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)
// Amount's button names the meal ("Add to Lunch").
const addButton = (scope = lastSheet()) => [...scope.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Add to '))
const typeInto = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}
const scan = async value => { await act(async () => { seeCode(value) }); await settle() }
const proxyCalls = () => nt.requests.filter(r => r.path === '/nt/api/proxy')
const overlay = () => host.querySelector('.g-scan')
const open = async (props = {}) => {
  await mount(<div />)
  await act(async () => { scanSheet({ date: TODAY, meal: 1, mealName: 'Lunch', ...props }) })
  await settle()
}
// Type the barcode: the drawer over the overlay.
const typeCode = async value => {
  await click(button('Type the barcode', overlay()))
  const field = lastSheet().querySelector('input[inputmode="numeric"]')
  await typeInto(field, value)
  return lastSheet()
}

beforeEach(() => {
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY) }, offProducts: { '3017620422003': fixtureOffProduct('3017620422003'), '0036000291452': fixtureOffProduct('0036000291452') } })
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
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('the overlay', () => {
  it('is a viewer over what opened it: the dark camera, Point the camera, Type the barcode, and a × that just closes', async () => {
    const go = vi.fn()
    setNav(go)
    await mount(<div />)
    await act(async () => { openPlusSheet('/home') })
    await settle()
    await click(button('Scan', lastSheet()))
    expect(useUI.getState().sheets.map(s => s.kind)).toEqual(['sheet', 'viewer'])
    expect(overlay().querySelector('h2').textContent).toBe('Scan a barcode')
    expect(overlay().textContent).toContain('Point the camera at the barcode')
    expect(button('Type the barcode', overlay())).toBeTruthy()
    await click(button('Close scan', overlay()))
    expect(overlay()).toBeNull()
    // Back on the + sheet it came from, and nothing navigated.
    expect(useUI.getState().sheets.map(s => s.kind)).toEqual(['sheet'])
    expect(go).not.toHaveBeenCalled()
  })

  it('shows the torch only where the camera has one', async () => {
    await open()
    expect(button('Torch', overlay())).toBeUndefined()
    await act(async () => { await useUI.getState().closeAll() })
    camera.torch = { available: true, on: false, toggle: vi.fn() }
    await open()
    await click(button('Torch', overlay()))
    expect(camera.torch.toggle).toHaveBeenCalledTimes(1)
  })

  it('Camera is blocked says how to allow it, offers Type the barcode and Try again, which asks again', async () => {
    camera.error = 'denied'
    await open()
    expect(overlay().textContent).toContain('Camera is blocked')
    expect(overlay().textContent).toContain('Allow the camera for Gains in your browser settings')
    expect(overlay().querySelector('.g-sempty')).not.toBeNull()
    await click(button('Try again', overlay()))
    expect(camera.retry).toHaveBeenCalledTimes(1)
    await click(button('Type the barcode', overlay()))
    expect(lastSheet().querySelector('h2').textContent).toBe('Type the barcode')
  })

  it('no camera at all offers the typed code and no retry', async () => {
    camera.error = 'unavailable'
    await open()
    expect(overlay().textContent).toContain('No camera found')
    expect(button('Try again', overlay())).toBeUndefined()
    expect(button('Type the barcode', overlay())).toBeTruthy()
  })
})

describe('scanning a product', () => {
  it('asks your own foods first: one of them opens Amount at once, with no lookup', async () => {
    await open()
    await scan('5000000000001')
    expect(proxyCalls()).toEqual([])
    expect(overlay()).toBeNull()
    // Amount, as for a food picked from the list.
    expect(lastSheet().textContent).toContain('Wholemeal bread')
    expect(lastSheet().textContent).toContain('Serving size')
    await click(addButton())
    const put = nt.writes().find(r => r.method === 'PUT')
    expect(put.path).toBe(`/nt/api/diary/${TODAY}`)
    expect(put.body.items.at(-1)).toMatchObject({ name: 'Wholemeal bread', food_server_id: 12, quantity: 1, meal: 1 })
    expect(nt.writes().some(r => r.path === '/nt/api/foods')).toBe(false)
    expect(useUI.getState().toastMsg).toBe('Added Wholemeal bread to Today, Lunch')
  })

  it('an own food saved under the UPC form still matches the EAN scan', async () => {
    nt.state.foods[1].barcode = '5000000000001'
    await open()
    await scan('05000000000001')
    expect(lastSheet().textContent).toContain('Wholemeal bread')
  })

  it('then Open Food Facts: the product, its energy and macros, and Log to the meal it was opened for, landing on Amount', async () => {
    await open()
    await scan('3017620422003')
    const card = overlay().querySelector('.g-scan-card')
    expect(card.textContent).toContain('Nutella')
    expect(card.textContent).toContain('Online')
    expect([...card.querySelectorAll('.g-scan-stat span')].map(s => s.textContent)).toEqual(['kcal', 'Protein g', 'Carbs g', 'Fat g'])
    expect(proxyCalls().length).toBe(1)
    expect(proxyCalls()[0].query.url).toBe('https://world.openfoodfacts.org/api/v3/product/3017620422003?lc=en')
    await click(button('Log to Lunch', card))
    expect(overlay()).toBeNull()
    expect(lastSheet().textContent).toContain('Serving size')
    await click(addButton())
    const saved = nt.writes().find(r => r.path === '/nt/api/foods')
    expect(saved.body).toMatchObject({ name: 'Nutella', barcode: '3017620422003', visibility: 'private' })
    expect(saved.body).not.toHaveProperty('imgUrl')
    expect(nt.writes().find(r => r.method === 'PUT').body.items.at(-1)).toMatchObject({ name: 'Nutella', meal: 1 })
    expect(useUI.getState().toastMsg).toBe('Added Nutella to Today, Lunch')
  })

  it('Save food keeps a product in My foods without logging it, and Log then logs that saved food', async () => {
    await open()
    await scan('3017620422003')
    await click(button('Save food', overlay()))
    expect(nt.writes().map(r => `${r.method} ${r.path}`)).toEqual(['POST /nt/api/foods'])
    expect(button('Saved', overlay()).disabled).toBe(true)
    expect(nt.writes().some(r => r.method === 'PUT')).toBe(false)
    expect(useNutrition.getState().foods.list.some(f => f.barcode === '3017620422003')).toBe(true)
    await click(button('Log to Lunch', overlay()))
    await click(addButton())
    expect(nt.writes().filter(r => r.method === 'POST' && r.path === '/nt/api/foods')).toHaveLength(1)
  })

  it('an 8-digit UPC-E is expanded to its UPC-A, then the EAN-13, before the lookup', async () => {
    await open()
    await scan('04252614')
    expect(proxyCalls()[0].query.url).toContain('/product/0042100005264?')
  })

  it('a 12-digit UPC-A is looked up as the EAN-13 Open Food Facts files it under', async () => {
    await open()
    await scan('036000291452')
    expect(proxyCalls()[0].query.url).toContain('/product/0036000291452?')
    expect(overlay().textContent).toContain('Nutella')
  })

  it('moves focus to each step\'s heading, and Scan another goes back to reading', async () => {
    await open()
    await scan('3017620422003')
    expect(document.activeElement.textContent).toBe('Nutella')
    await click(button('Scan another', overlay()))
    expect(overlay().textContent).toContain('Point the camera at the barcode')
    expect(document.activeElement.textContent).toBe('Point the camera at the barcode')
    expect(camera.opts.enabled).toBe(true)
    await scan('9999999999999')
    expect(document.activeElement.tagName).toBe('H2')
  })

  it('a barcode nobody knows says so, and Create food leaves the overlay and opens the editor with the code filled in', async () => {
    const go = vi.fn()
    setNav(go)
    await open()
    await scan('5941234567890')
    const card = overlay().querySelector('.g-scan-card')
    expect(card.textContent).toContain('5 941234 567890')
    expect(card.querySelector('h2').textContent).toBe('Not in Open Food Facts yet')
    expect(card.textContent).toContain('Next time this barcode opens it straight away.')
    expect(button('Scan again', card)).toBeTruthy()
    await click(button('Create food with this barcode', card))
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(go).toHaveBeenCalledWith('/food/my-foods/foods/new', { state: { prefill: { barcode: '5941234567890' } } })
  })

  it('offers Search foods only when the opener can search, and Quick kcal', async () => {
    const onSearch = vi.fn()
    await open({ onSearch })
    await scan('9999999999999')
    expect(button('Quick kcal', overlay())).toBeTruthy()
    await click(button('Search foods', overlay()))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(overlay()).toBeNull()
    await open()
    await scan('9999999999999')
    expect(button('Search foods', overlay())).toBeUndefined()
  })

  it('with Open Food Facts off, a miss says only your foods were asked', async () => {
    nt.state.settings.offEnabled = false
    await useNutrition.getState().loadSettings()
    await open()
    await scan('3017620422003')
    expect(proxyCalls()).toEqual([])
    expect(overlay().querySelector('.g-scan-card h2').textContent).toBe('Not in your foods yet')
  })

  it('a product listed without calories cannot be logged and says why', async () => {
    const bare = fixtureOffProduct('1234567890128')
    bare.product.nutriments = { proteins_100g: 3 }
    nt = createFakeNutriTrace({ offProducts: { '1234567890128': bare } })
    vi.stubGlobal('fetch', nt.fetch)
    await open()
    await scan('1234567890128')
    expect(overlay().textContent).toContain('No energy value for 1234567890128')
    expect(button('Log to Lunch', overlay())).toBeUndefined()
  })

  it('a lookup that fails is not a miss: it says so and tries again', async () => {
    await open()
    nt.failNext('GET', '/nt/api/proxy', 'offline')
    await scan('3017620422003')
    expect(overlay().querySelector('[role="alert"]').textContent).toBe('The lookup did not go through: no connection.')
    expect(overlay().textContent).toContain('3 017620 422003')
    await click(button('Try again', overlay()))
    expect(overlay().textContent).toContain('Nutella')
  })

  it('too many lookups asks to wait', async () => {
    await open()
    nt.failNext('GET', '/nt/api/proxy', { status: 429 })
    await scan('3017620422003')
    expect(overlay().querySelector('[role="alert"]').textContent).toBe('Too many lookups. Wait a minute and try again.')
  })
})

describe('Type the barcode', () => {
  it('keeps Look up off until the digits are a barcode, and says why', async () => {
    await open()
    await click(button('Type the barcode', overlay()))
    const sheet = lastSheet()
    expect(sheet.querySelector('h2').textContent).toBe('Type the barcode')
    expect(sheet.textContent).toContain('The 8 or 13 digits under the bars.')
    expect(button('Look up', sheet).disabled).toBe(true)
    const field = sheet.querySelector('input[inputmode="numeric"]')
    await typeInto(field, '30176')
    expect(sheet.textContent).toContain('Barcodes are 8 to 14 digits, numbers only.')
    expect(button('Look up', sheet).disabled).toBe(true)
    await typeInto(field, '3017620422004')
    expect(sheet.textContent).toContain('The last digit does not match the others. Check for a typo.')
    expect(button('Look up', sheet).disabled).toBe(true)
    await typeInto(field, '3017 6204 22003')
    expect(button('Look up', sheet).disabled).toBe(false)
    expect(proxyCalls()).toEqual([])
  })

  it('looks the number up on the overlay under it, spaces and all', async () => {
    await open()
    await typeCode('3017 6204 22003')
    await click(button('Look up', lastSheet()))
    expect(useUI.getState().sheets.map(s => s.kind)).toEqual(['viewer'])
    expect(overlay().textContent).toContain('Nutella')
    expect(proxyCalls()).toHaveLength(1)
  })
})

describe('the picker', () => {
  it('has a barcode button in its search field that scans for the same date and meal', async () => {
    await mount(<FoodPicker date={TODAY} meal={2} mealName="Dinner" />)
    await click(button('Scan a barcode'))
    await scan('5000000000001')
    await click(button('Add to Dinner', lastSheet()))
    expect(nt.writes().find(r => r.method === 'PUT').body.items.at(-1)).toMatchObject({ name: 'Wholemeal bread', meal: 2 })
  })
})
