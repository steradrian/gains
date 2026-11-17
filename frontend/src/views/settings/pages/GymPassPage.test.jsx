// @vitest-environment happy-dom
//
// The Gym check-in page (board St1GymPass; route /train/checkin). The rail reopens where you left
// it, a card is removed without a confirm and comes back with Undo, the ◀ ▶ buttons reorder, and
// the Card rows open the drawer. The drawer itself is in views/CheckIn.test.jsx.
//
// Traps: happy-dom reports clientWidth 0 for everything and the rail divides by it, so the tests
// that touch scrolling install a width on HTMLElement.prototype for their duration.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  S: null,
  writes: [],          // { push } per update() call, in order
  toast: vi.fn(),
  back: vi.fn(),
  sheets: [],          // every openSheet render fn, in order
}))

const update = vi.fn((mut, push = true) => {
  const next = structuredClone(mocks.S)
  mut(next)
  mocks.S = next
  mocks.writes.push({ push })
})

vi.mock('../../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, update })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({
    toast: (...a) => mocks.toast(...a),
    openSheet: render => { mocks.sheets.push(render); return { id: 's', close: () => {}, lock: () => {} } },
  })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: (...a) => mocks.back(...a) }))
vi.mock('../../../components/QrCanvas.jsx', () => ({ default: ({ value }) => <i data-qr={value} /> }))
// The drawer's device surfaces; its own behaviour is in views/CheckIn.test.jsx.
vi.mock('../../../lib/scan.js', () => ({ scanCode: vi.fn(), importCodeFromImage: vi.fn() }))
vi.mock('../../../components/CameraScan.jsx', () => ({ default: () => null }))

import GymPassPage from './GymPassPage.jsx'

const card = (id, over = {}) => ({ id, label: id.toUpperCase(), value: 'code-' + id, fmt: 'qrcode', ...over })

let host, root, sheetHost, sheetRoot, widthSpy
beforeEach(() => {
  mocks.S = { gymCards: [], lastGymCardId: null }
  mocks.writes.length = 0
  mocks.sheets.length = 0
  mocks.toast.mockClear(); mocks.back.mockClear()
  update.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  sheetHost = document.createElement('div'); document.body.appendChild(sheetHost); sheetRoot = createRoot(sheetHost)
})
afterEach(() => {
  act(() => sheetRoot.unmount()); sheetHost.remove()
  act(() => root.unmount()); host.remove()
  if (widthSpy) { delete HTMLElement.prototype.clientWidth; widthSpy = null }
})

const withRailWidth = w => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => w })
  widthSpy = true
}
const mount = () => act(() => { root.render(<GymPassPage />) })
const rail = () => host.querySelector('.ci-rail')
const faces = () => [...host.querySelectorAll('.ci-card')]
const dots = () => [...host.querySelectorAll('.ci-dot')]
const litDots = () => dots().map(d => d.className.includes('on'))
const byLabel = (scope, label) => [...scope.querySelectorAll('[aria-label="' + label + '"]')]
const row = title => [...host.querySelectorAll('.g-glist-row, .g-danger-row')].find(r => r.querySelector('b')?.textContent === title)
const tap = async el => { await act(async () => { el.click(); await new Promise(r => setTimeout(r, 0)) }) }
const scrollTo = px => act(() => {
  rail().scrollLeft = px
  rail().dispatchEvent(new Event('scroll', { bubbles: true }))
})

describe('Gym check-in — the rail reopens where you left it', () => {
  it('opens on the last-used card rather than the first', () => {
    withRailWidth(300)
    mocks.S = { gymCards: [card('a'), card('b'), card('c')], lastGymCardId: 'c' }
    mount()
    expect(rail().scrollLeft).toBe(600)
    expect(litDots()).toEqual([false, false, true])
  })

  it('an id whose card was removed elsewhere falls back to the first card, not to nothing', () => {
    withRailWidth(300)
    mocks.S = { gymCards: [card('a'), card('b')], lastGymCardId: 'gone' }
    mount()
    expect(rail().scrollLeft).toBe(0)
    expect(litDots()).toEqual([true, false])
  })

  it('settling on another card remembers it WITHOUT pushing a sync — a swipe is not a data change', () => {
    withRailWidth(300)
    mocks.S = { gymCards: [card('a'), card('b'), card('c')], lastGymCardId: 'a' }
    mount()
    mocks.writes.length = 0
    scrollTo(600)
    expect(mocks.S.lastGymCardId).toBe('c')
    expect(mocks.writes).toEqual([{ push: false }])
  })

  it('a nudge that settles back on the same card writes nothing — only a real swipe counts', () => {
    withRailWidth(300)
    mocks.S = { gymCards: [card('a'), card('b')], lastGymCardId: 'a' }
    mount()
    scrollTo(320)
    expect(mocks.S.lastGymCardId).toBe('b')
    mocks.writes.length = 0
    scrollTo(290)
    scrollTo(312)
    expect(mocks.writes).toEqual([])
  })

  it('a single card has no dots', () => {
    mocks.S = { gymCards: [card('a')], lastGymCardId: 'a' }
    mount()
    expect(dots()).toHaveLength(0)
  })

  it('the QR is regenerated from the stored value — the value is what is kept, never a picture', () => {
    mocks.S = { gymCards: [card('a', { value: 'MEMBER-9931' })], lastGymCardId: 'a' }
    mount()
    expect(host.querySelector('[data-qr]').getAttribute('data-qr')).toBe('MEMBER-9931')
    expect(host.querySelector('.ci-value').textContent).toBe('MEMBER-9931')
  })

  it('is titled Gym check-in with the card name above the code, and Back steps back through the tab', async () => {
    mocks.S = { gymCards: [card('a', { label: 'World Class' })], lastGymCardId: 'a' }
    mount()
    expect(host.querySelector('h1').textContent).toBe('Gym check-in')
    expect(host.querySelector('.ci-label').textContent).toBe('World Class')
    await tap(host.querySelector('.g-snav-back'))
    expect(mocks.back).toHaveBeenCalledWith('/train')
  })

  it('with no cards it says how to get one and offers scan and type, but nothing to remove', () => {
    mount()
    expect(dots()).toHaveLength(0)
    expect(faces()).toHaveLength(0)
    expect(host.textContent).toContain('Import a photo of your membership card')
    expect(row('Scan a new card')).toBeTruthy()
    expect(row('Type the number')).toBeTruthy()
    expect(row('Remove card')).toBeUndefined()
    expect(row('Edit name or number')).toBeUndefined()
  })
})

describe('Gym check-in — the Card rows', () => {
  const drawer = () => {
    act(() => { sheetRoot.render(mocks.sheets.at(-1)(vi.fn())) })
    return sheetHost
  }
  const field = label => [...drawer().querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label')?.textContent === label)

  it('Scan a new card opens the add drawer and starts scanning (a browser opens its camera panel on top)', async () => {
    mount()
    await tap(row('Scan a new card'))
    expect(drawer().querySelector('h2').textContent).toBe('Add a card')
    // In a browser the scan is our own camera panel, a second render on the sheet stack.
    expect(mocks.sheets).toHaveLength(2)
  })

  it('Type the number opens the add drawer with the number field', async () => {
    mount()
    await tap(row('Type the number'))
    expect(mocks.sheets).toHaveLength(1)
    expect(drawer().querySelector('h2').textContent).toBe('Add a card')
    expect(field('Card number')).toBeTruthy()
  })

  it('Edit name or number opens the drawer on the card in view', async () => {
    withRailWidth(300)
    mocks.S = { gymCards: [card('a'), card('b')], lastGymCardId: 'b' }
    mount()
    await tap(row('Edit name or number'))
    expect(drawer().querySelector('h2').textContent).toBe('Edit card')
    expect(field('Label').querySelector('input').value).toBe('B')
  })
})

describe('Gym check-in — removing a card', () => {
  const remove = async (cards, lastGymCardId = cards[0].id) => {
    withRailWidth(300)
    mocks.S = { gymCards: cards, lastGymCardId }
    mount()
    await tap(row('Remove card'))
  }

  it('says Undo for 8 s on the row and asks nothing first', async () => {
    mocks.S = { gymCards: [card('a')], lastGymCardId: 'a' }
    mount()
    expect(row('Remove card').textContent).toContain('Undo for 8 s')
    await tap(row('Remove card'))
    expect(mocks.S.gymCards).toEqual([])
  })

  it('drops the card in view and only that card, then offers Undo', async () => {
    await remove([card('a'), card('b'), card('c')], 'b')
    expect(mocks.S.gymCards.map(c => c.id)).toEqual(['a', 'c'])
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast.mock.calls[0][1].action).toBe('Undo')
  })

  it('Undo puts it back in its old slot', async () => {
    await remove([card('a'), card('b'), card('c')], 'b')
    mocks.toast.mock.calls[0][1].onAction()
    expect(mocks.S.gymCards.map(c => c.id)).toEqual(['a', 'b', 'c'])
    expect(mocks.S.lastGymCardId).toBe('b')
  })

  it('removing the remembered card repoints the memory at the first survivor', async () => {
    await remove([card('a'), card('b')], 'a')
    expect(mocks.S.lastGymCardId).toBe('b')
  })

  it('removing the last card clears the memory to null, not to undefined', async () => {
    await remove([card('a')], 'a')
    expect(mocks.S.gymCards).toEqual([])
    expect(mocks.S.lastGymCardId).toBeNull()
    // null survives JSON; undefined would vanish on the next sync and read as "never set".
    expect(JSON.parse(JSON.stringify(mocks.S))).toHaveProperty('lastGymCardId', null)
  })

  it('a removal is pushed to the other devices, unlike a swipe', async () => {
    withRailWidth(300)
    mocks.S = { gymCards: [card('a'), card('b')], lastGymCardId: 'a' }
    mount()
    mocks.writes.length = 0
    await tap(row('Remove card'))
    expect(mocks.writes).toEqual([{ push: true }])
  })
})

describe('Gym check-in — reordering the rail', () => {
  it('a single card carries no reorder row — there is nowhere to move it', () => {
    mocks.S = { gymCards: [card('a')], lastGymCardId: 'a' }
    mount()
    expect(host.querySelector('.ci-reorder')).toBeFalsy()
  })

  it('the ends are inert: ◀ on the first card and ▶ on the last are disabled', () => {
    mocks.S = { gymCards: [card('a'), card('b'), card('c')], lastGymCardId: 'a' }
    mount()
    expect(byLabel(faces()[0], 'Move left')[0].disabled).toBe(true)
    expect(byLabel(faces()[0], 'Move right')[0].disabled).toBe(false)
    expect(byLabel(faces()[2], 'Move left')[0].disabled).toBe(false)
    expect(byLabel(faces()[2], 'Move right')[0].disabled).toBe(true)
    expect(faces().map(f => f.querySelector('.ci-pos').textContent)).toEqual(['1 / 3', '2 / 3', '3 / 3'])
  })

  it('▶ writes the new order and keeps every card', async () => {
    mocks.S = { gymCards: [card('a'), card('b'), card('c')], lastGymCardId: 'a' }
    mount()
    await tap(byLabel(faces()[0], 'Move right')[0])
    expect(mocks.S.gymCards.map(c => c.id)).toEqual(['b', 'a', 'c'])
    mount()
    expect(faces().map(f => f.querySelector('.ci-label').textContent)).toEqual(['B', 'A', 'C'])
  })

  it('◀ moves a card back one slot', async () => {
    mocks.S = { gymCards: [card('a'), card('b'), card('c')], lastGymCardId: 'a' }
    mount()
    await tap(byLabel(faces()[2], 'Move left')[0])
    expect(mocks.S.gymCards.map(c => c.id)).toEqual(['a', 'c', 'b'])
  })
})
