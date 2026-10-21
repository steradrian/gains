// @vitest-environment happy-dom
// Custom units (boards St1CustomUnits, St1CustomUnit): the list, the drawer's add / edit / delete
// with Undo, against the fake hub (which refuses any unit shape but { abbr, full }).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { createFakeNutriTrace } from '../../../lib/nutrition/fake-nutritrace.js'
import CustomUnitsPage from './CustomUnitsPage.jsx'

vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, nt, sheets, sheetRoots
const toast = vi.fn()
const settle = () => act(async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)) })
const puts = () => nt.requests.filter(r => r.method === 'PUT' && r.path === '/nt/api/settings').map(r => r.body)
const rowTitled = title => [...host.querySelectorAll('[data-find]')].find(r => r.dataset.find === title)
const click = async el => { await act(async () => { el.click() }); await settle() }
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function openedSheet() {
  const render = sheets.at(-1)
  const box = document.createElement('div')
  document.body.appendChild(box)
  const sheetRoot = createRoot(box)
  const close = vi.fn()
  act(() => sheetRoot.render(render(close)))
  sheetRoots.push([sheetRoot, box])
  return { box, close }
}
const button = (box, label) => [...box.querySelectorAll('button')].find(b => b.textContent === label)
const inputs = box => box.querySelectorAll('input')

async function mount(customUnits) {
  useNutrition.getState().reset()
  nt = createFakeNutriTrace({ settings: { timeFormat: '24h', customUnits } })
  vi.stubGlobal('fetch', nt.fetch)
  act(() => root.render(<CustomUnitsPage />))
  await settle()
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  sheets = []
  sheetRoots = []
  toast.mockClear()
  useUI.setState({ toast, openSheet: render => { sheets.push(render); return { close: vi.fn() } } })
  useNutrition.getState().reset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  for (const [r, box] of sheetRoots) { act(() => r.unmount()); box.remove() }
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('Custom units page', () => {
  it('lists each unit by its name with the abbreviation under it, and counts them', async () => {
    await mount([{ abbr: 'scoop', full: 'Scoop' }, { abbr: 'sl', full: 'Slice' }])
    expect(host.querySelector('h1').textContent).toBe('Custom units')
    expect(host.querySelector('.g-sptitle p').textContent).toBe('2 units')
    expect(rowTitled('Scoop').querySelector('.g-glist-body span').textContent).toBe('Abbreviation “scoop”')
    expect(rowTitled('Slice')).toBeTruthy()
  })

  it('says there are none yet, and still offers Add a custom unit', async () => {
    await mount([])
    expect(host.textContent).toContain('No custom units yet')
    expect(rowTitled('Add a custom unit')).toBeTruthy()
    expect(host.querySelector('.g-sptitle p')).toBeNull()
  })

  it('adds { abbr, full }, the name defaulting to the abbreviation; the drawer has no weight field', async () => {
    await mount([])
    await click(rowTitled('Add a custom unit'))
    let { box } = openedSheet()
    expect(inputs(box)).toHaveLength(2)
    await type(inputs(box)[0], 'Handful')
    await type(inputs(box)[1], 'hf')
    await click(button(box, 'Add unit'))
    await click(rowTitled('Add a custom unit'))
    ;({ box } = openedSheet())
    await type(inputs(box)[1], 'pinch')
    await click(button(box, 'Add unit'))
    expect(puts().at(-1)).toEqual({ key: 'customUnits', value: [{ abbr: 'hf', full: 'Handful' }, { abbr: 'pinch', full: 'pinch' }] })
    expect(rowTitled('Handful')).toBeTruthy()
  })

  it('refuses a unit the built-in list has, with no write, and keeps the typing', async () => {
    await mount([])
    await click(rowTitled('Add a custom unit'))
    const { box, close } = openedSheet()
    await type(inputs(box)[1], 'Cup')
    await click(button(box, 'Add unit'))
    expect(box.querySelector('[role="alert"]').textContent).toBe('That unit is already in the list.')
    expect(inputs(box)[1].value).toBe('Cup')
    expect(puts()).toEqual([])
    expect(close).not.toHaveBeenCalled()
  })

  it('edits the name only: the abbreviation, which past entries use, is read-only', async () => {
    await mount([{ abbr: 'shot', full: 'shot' }, { abbr: 'sl', full: 'Slice' }])
    await click(rowTitled('shot'))
    const { box } = openedSheet()
    expect(inputs(box)[1].disabled).toBe(true)
    expect(inputs(box)[1].value).toBe('shot')
    await type(inputs(box)[0], 'Shot glass')
    await click(button(box, 'Save unit'))
    expect(puts()).toEqual([{ key: 'customUnits', value: [{ abbr: 'shot', full: 'Shot glass' }, { abbr: 'sl', full: 'Slice' }] }])
  })

  it('an add is made over what the server has now: a unit added elsewhere survives', async () => {
    await mount([{ abbr: 'shot', full: 'shot' }])
    nt.state.settings.customUnits = [{ abbr: 'shot', full: 'shot' }, { abbr: 'scoop', full: 'scoop' }]
    await click(rowTitled('Add a custom unit'))
    const { box } = openedSheet()
    await type(inputs(box)[1], 'stick')
    await click(button(box, 'Add unit'))
    expect(puts().at(-1).value.map(u => u.abbr)).toEqual(['shot', 'scoop', 'stick'])
  })

  it('a failed re-read saves nothing and says so', async () => {
    await mount([])
    await click(rowTitled('Add a custom unit'))
    const { box, close } = openedSheet()
    await type(inputs(box)[1], 'stick')
    nt.failNext('GET', '/nt/api/settings', 'offline')
    await click(button(box, 'Add unit'))
    expect(puts()).toEqual([])
    expect(box.querySelector('[role="alert"]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(close).not.toHaveBeenCalled()
  })

  it('deleting one drops a gram weight an older client may have stored on another', async () => {
    await mount([{ abbr: 'shot', full: 'shot glass' }, { abbr: 'stick', grams: 8 }])
    await click(rowTitled('shot glass'))
    const { box } = openedSheet()
    await click(button(box, 'Delete unit'))
    expect(puts()).toEqual([{ key: 'customUnits', value: [{ abbr: 'stick', full: 'stick' }] }])
  })

  it('deletes with an Undo toast, not a confirm, and Undo puts it back where it was', async () => {
    await mount([{ abbr: 'a', full: 'A' }, { abbr: 'b', full: 'B' }, { abbr: 'c', full: 'C' }])
    await click(rowTitled('B'))
    const { box, close } = openedSheet()
    await click(button(box, 'Delete unit'))
    expect(puts()).toEqual([{ key: 'customUnits', value: [{ abbr: 'a', full: 'A' }, { abbr: 'c', full: 'C' }] }])
    expect(close).toHaveBeenCalled()
    expect(sheets).toHaveLength(1)
    expect(toast).toHaveBeenCalledWith('Deleted B', expect.objectContaining({ action: 'Undo' }))
    await act(async () => { await toast.mock.calls.at(-1)[1].onAction() })
    await settle()
    expect(puts().at(-1).value.map(u => u.abbr)).toEqual(['a', 'b', 'c'])
  })
})
