// @vitest-environment happy-dom
// Units and language (board St1Units): a unit switch still offers convert-the-numbers or
// keep-and-relabel (issue #22), the language and 1RM formula drawers write the same keys the old
// pickers did, and nothing logged changes.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, sheets: [], menu: vi.fn(), setUnit: vi.fn(), nutrition: false, navs: [] }
  state.snapshot = () => ({
    S: state.S, config: null, setUnit: state.setUnit,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ openSheet: render => { mocks.sheets.push(render); return { close: vi.fn() } } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => mocks.navs.push(a) }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../../../sheets.jsx', () => ({ menuSheet: (...a) => mocks.menu(...a) }))
vi.mock('../use-settings-ctx.js', () => ({ useSettingsCtx: () => ({ nameLang: false, nutrition: mocks.nutrition }) }))

import UnitsPage from './UnitsPage.jsx'

let host, root, sheetHost, sheetRoot
beforeEach(() => {
  mocks.S = { unit: 'kg', lang: 'en', wdec: 1, workouts: [{ id: 'w1' }], exWeights: { a: 60 } }
  mocks.sheets = []
  mocks.navs = []
  mocks.nutrition = false
  mocks.menu.mockClear()
  mocks.setUnit.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  sheetHost = document.createElement('div'); document.body.appendChild(sheetHost); sheetRoot = createRoot(sheetHost)
})
afterEach(() => {
  act(() => sheetRoot.unmount()); sheetHost.remove()
  act(() => root.unmount()); host.remove()
})

const mount = () => act(() => root.render(<UnitsPage />))
const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)
const seg = (title, label) => [...row(title).querySelectorAll('.g-sseg button')].find(b => b.textContent === label)
const openedSheet = () => {
  const close = vi.fn()
  act(() => sheetRoot.render(mocks.sheets.at(-1)(close)))
  return close
}
const radio = label => [...sheetHost.querySelectorAll('[role="radio"]')].find(r => r.querySelector('b')?.textContent === label)

describe('Units and language', () => {
  it('names the page and the units it is in', () => {
    mount()
    expect(host.querySelector('h1').textContent).toBe('Units & language')
    expect(host.querySelector('.g-sptitle p').textContent).toBe('kg · km/h · English')
  })

  it('switching kg to lb still offers to convert the numbers or keep them and relabel', () => {
    mount()
    act(() => seg('Weight unit', 'lb').click())
    expect(mocks.menu).toHaveBeenCalledTimes(1)
    const { title, items } = mocks.menu.mock.calls[0][0]
    expect(title).toBe('Convert to lb?')
    expect(items.map(i => i.label)).toEqual(['Convert the numbers', 'Keep the numbers, change the label'])
    // Nothing is written until one is chosen, and closing the sheet leaves the unit as it was.
    expect(mocks.setUnit).not.toHaveBeenCalled()
    items[0].onClick()
    expect(mocks.setUnit).toHaveBeenLastCalledWith('lb')
    items[1].onClick()
    expect(mocks.setUnit).toHaveBeenLastCalledWith('lb', { convert: false })
  })

  it('choosing the unit already in use asks nothing', () => {
    mount()
    act(() => seg('Weight unit', 'kg').click())
    expect(mocks.menu).not.toHaveBeenCalled()
  })

  it('Weight decimals stores 0, 1 or 2 and changes nothing logged', () => {
    const before = structuredClone(mocks.S)
    mount()
    act(() => seg('Weight decimals', 'None').click())
    expect(mocks.S.wdec).toBe(0)
    act(() => seg('Weight decimals', '2').click())
    expect(mocks.S.wdec).toBe(2)
    expect({ ...mocks.S, wdec: undefined }).toEqual({ ...before, wdec: undefined })
  })

  it('the Language row opens a drawer, and picking a language writes lang and clears the auto mark', () => {
    mocks.S.langAuto = true
    mount()
    act(() => row('Language').click())
    openedSheet()
    expect(radio('English').getAttribute('aria-checked')).toBe('true')
    act(() => radio('Deutsch').click())
    expect(mocks.S.lang).toBe('de')
    expect(mocks.S.langAuto).toBe(false)
  })

  it('the language drawer closes once a language is picked', () => {
    mount()
    act(() => row('Language').click())
    const close = openedSheet()
    act(() => radio('Deutsch').click())
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('the 1RM formula row opens a drawer with an example each, and picking one writes oneRmFormula', () => {
    mount()
    expect(row('1RM formula').querySelector('.g-gvr-val').textContent).toBe('Epley')
    act(() => row('1RM formula').click())
    openedSheet()
    expect(radio('Epley').textContent).toContain('100 kg × 5 reps ≈ 116.7 kg')
    expect(radio('Brzycki').textContent).toContain('100 kg × 5 reps ≈ 112.5 kg')
    expect(radio('Lombardi').textContent).toContain('100 kg × 5 reps ≈ 117.5 kg')
    act(() => radio('Brzycki').click())
    expect(mocks.S.oneRmFormula).toBe('brzycki')
  })

  it('keeps every formula the old picker had', () => {
    mount()
    act(() => row('1RM formula').click())
    openedSheet()
    expect([...sheetHost.querySelectorAll('[role="radio"] b')].map(b => b.textContent))
      .toEqual(['Epley', 'Brzycki', 'Lombardi', 'O’Conner', 'Mayhew', 'Wathan', 'Lander', 'Blend of all'])
  })

  it('the speed unit stores the choice only', () => {
    const before = structuredClone(mocks.S)
    mount()
    act(() => seg('Speed unit', 'mph').click())
    expect(mocks.S.speedUnit).toBe('mph')
    expect({ ...mocks.S, speedUnit: undefined }).toEqual({ ...before, speedUnit: undefined })
  })

  it('points to the Water unit as a row, not as text, only where food is tracked', () => {
    mount()
    expect(row('Water unit')).toBeUndefined()
    mocks.nutrition = true
    mount()
    act(() => row('Water unit').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/water'])
  })
})
