// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './Modals.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import { drawerFlow, useUI } from '../store/useUI.js'
import { sheetEntryCount } from '../lib/sheet-nav.js'
import { sheetEntriesLive } from '../lib/nav.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
const q = s => document.querySelector(s)
const all = s => [...document.querySelectorAll(s)]
const ui = () => useUI.getState()
const click = el => act(async () => { el.click() })
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }

const Plus = () => <BottomSheet title="Add to Today"><button id="to-food" onClick={() => drawerFlow(() => ui().openSheet(c => <Food close={c} />, { variant: 'ds' }))}>Log food</button></BottomSheet>
const Food = ({ close }) => <BottomSheet title="Log food" footer={<button id="food-done" onClick={close}>Done</button>}><p>list</p></BottomSheet>
const openPlus = () => act(async () => { ui().openSheet(() => <Plus />, { variant: 'ds' }) })
const openFood = () => act(async () => { ui().openSheet(c => <Food close={c} />, { variant: 'ds' }) })

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div><div id="root"></div>'
  useUI.setState({ sheets: [] })
  vi.spyOn(history, 'go').mockImplementation(() => {})
  root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(<Modals />) })
})
afterEach(async () => {
  await act(async () => { ui().closeAll(); root.unmount() })
  await settle()
  while (scrollRestorePending()) await act(async () => { await new Promise(r => setTimeout(r, 25)) })
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('a sheet opened from the page starts a fresh stack', () => {
  it('after the + drawer and its Log food panel were closed with the x', async () => {
    await openPlus()
    await click(q('#to-food'))
    expect(ui().sheets[0].panels).toHaveLength(1)
    await click(q('.g-bs-pane[data-pos="active"] .g-bs-x'))
    expect(ui().sheets).toHaveLength(0)
    await openFood()
    expect(ui().sheets).toHaveLength(1)
    expect(ui().sheets[0].panels).toHaveLength(0)
    expect(all('.g-bs-back')).toHaveLength(0)
    expect(sheetEntryCount(ui().sheets)).toBe(1)
  })

  it('after Log food finished through its own close', async () => {
    await openPlus()
    await click(q('#to-food'))
    await click(q('#food-done'))
    await settle()
    await openFood()
    expect(ui().sheets.map(s => s.panels.length)).toEqual([0])
    expect(all('.g-bs-back')).toHaveLength(0)
  })

  it('when it opens in the same tick the drawer closes', async () => {
    let drawer
    await act(async () => { drawer = ui().openSheet(() => <Plus />, { variant: 'ds' }) })
    await act(async () => { drawer.close(); ui().openSheet(c => <Food close={c} />, { variant: 'ds' }) })
    expect(ui().sheets).toHaveLength(1)
    expect(ui().sheets[0].panels).toHaveLength(0)
    await settle()
    expect(all('.g-bs-back')).toHaveLength(0)
    expect(sheetEntriesLive()).toBe(1)
  })

  it('after the drawer goes through the backdrop', async () => {
    await openPlus()
    await click(q('#to-food'))
    await click(q('.g-bs-scrim'))
    await settle()
    await openFood()
    expect(ui().sheets.map(s => s.panels.length)).toEqual([0])
    expect(sheetEntriesLive()).toBe(1)
  })

  it('still pushes a sub-panel when opened from inside a sheet, and back pops to the sheet', async () => {
    await openPlus()
    await click(q('#to-food'))
    expect(all('.g-bs-pane-sub .g-bs-back')).toHaveLength(1)
    await click(q('.g-bs-pane-sub .g-bs-back'))
    expect(ui().sheets[0].panels).toHaveLength(0)
  })
})

// No layout engine here: the parts of a panel report the heights a real one would. A flexing body
// is as tall as the room it was given, or as its content once taken out of the flex (what the panel
// measures it by); the panes box is as tall as the script set it.
describe('a sub-panel sizes to its own content', () => {
  let heights
  beforeEach(() => {
    heights = { body: 50, room: 300 }
    const own = el => {
      if (el.classList.contains('g-bs-panes')) return parseFloat(el.style.height) || 200
      if (el.classList.contains('g-bs-head')) return 60
      if (el.classList.contains('g-bs-foot')) return 40
      if (el.classList.contains('g-bs-body')) return ['none', '0 0 auto'].includes(el.style.flex) ? heights.body : Math.max(heights.body, heights.room)
      return 0
    }
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () { return own(this) })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () { return own(this) })
  })

  const Loader = () => {
    const [rows, setRows] = React.useState(0)
    return (
      <BottomSheet title="Log food" footer={<button id="foot">Scan</button>}>
        <button id="load" onClick={() => setRows(8)}>load</button>
        {rows ? <ul id="rows"><li>row</li></ul> : <p id="skeleton">loading</p>}
      </BottomSheet>
    )
  }
  const panesHeight = () => parseFloat(q('.g-bs-panes').style.height)

  it('fits the panel at once, however much room it is given', async () => {
    await openPlus()
    await act(async () => { ui().openSheet(() => <Loader />, { variant: 'ds' }) })
    expect(panesHeight()).toBe(60 + 50 + 40)
  })

  it('follows the list that loads after it, and shrinks back when the content does', async () => {
    await openPlus()
    await act(async () => { ui().openSheet(() => <Loader />, { variant: 'ds' }) })
    heights.body = 420
    await click(q('#load'))
    await settle()
    expect(panesHeight()).toBe(60 + 420 + 40)
    heights.body = 120
    await act(async () => { q('#rows').appendChild(document.createElement('li')) })
    await settle()
    expect(panesHeight()).toBe(60 + 120 + 40)
  })
})

// Breakfast card -> meal panel (a sub-panel) -> "Add now": close(); open(Log food) in one handler.
describe('close then open from a sub-panel', () => {
  const Meal = ({ close }) => <BottomSheet title="Breakfast"><button id="add-now" onClick={() => { close(); ui().openSheet(c => <Food close={c} />, { variant: 'ds' }) }}>Add now</button></BottomSheet>
  const Today = () => <BottomSheet title="Today"><button id="to-meal" onClick={() => ui().openSheet(c => <Meal close={c} />, { variant: 'ds' })}>Breakfast</button></BottomSheet>
  const toMeal = async () => {
    await act(async () => { ui().openSheet(() => <Today />, { variant: 'ds' }) })
    await click(q('#to-meal'))
    expect(ui().sheets[0].panels).toHaveLength(1)
  }

  it('opens a fresh root: no chevron, one drawer, no panels', async () => {
    await toMeal()
    await click(q('#add-now'))
    await settle()
    expect(ui().sheets).toHaveLength(1)
    expect(ui().sheets[0].panels).toHaveLength(0)
    expect(all('.g-bs-back')).toHaveLength(0)
    expect(all('.g-bs-head h2').filter(h => h.textContent === 'Log food')).toHaveLength(1)
  })

  it('back closes the sheet and leaves no history entry behind', async () => {
    await toMeal()
    await click(q('#add-now'))
    await settle()
    expect(sheetEntryCount(ui().sheets)).toBe(1)
    expect(sheetEntriesLive()).toBe(1)
    // history.go is mocked: the first popstate is the browser finishing the walk-off of the old panel's entry
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(ui().sheets).toHaveLength(1)
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(ui().sheets).toHaveLength(0)
    await settle()
    expect(sheetEntriesLive()).toBe(0)
  })

  it('a plain close from a sub-panel still pops that one panel', async () => {
    await toMeal()
    let panel
    panel = ui().sheets[0].panels[0]
    await act(async () => { ui().closeSheet(panel.id) })
    await settle()
    expect(ui().sheets).toHaveLength(1)
    expect(ui().sheets[0].panels).toHaveLength(0)
    // and a sheet opened later, not in that tick, is a step of the drawer again
    await act(async () => { ui().openSheet(c => <Food close={c} />, { variant: 'ds' }) })
    expect(ui().sheets[0].panels).toHaveLength(1)
  })
})
