// @vitest-environment happy-dom
//
// The gym card's add/edit drawer. `moveGymCard` (the pure reorder helper) is covered by
// CheckIn.reorder.test.jsx, the shape of the stored data by store/useStore.gymcards.test.jsx, and
// the page (the rail, remove with Undo, the rows) by settings/pages/GymPassPage.test.jsx. This
// file is the drawer, the only thing in the app that turns a photo of a membership card into
// synced profile data.
//
// These tests assert what reaches the store (and with which push flag), and what the sheet
// refuses, rather than that anything rendered.
//
// Traps this file is written around:
//   · globalThis.IS_REACT_ACT_ENVIRONMENT = true is required.
//   · el.value = x does NOT reach React — every value goes through the native prototype setter.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  S: null,
  MOBILE: false,
  writes: [],          // { push } per update() call, in order
  sheets: [],          // every openSheet render fn, in order
  camera: null,        // the props the browser CameraScan sheet was handed
  toast: vi.fn(),
  scanCode: vi.fn(),
  importCodeFromImage: vi.fn(),
}))

const update = vi.fn((mut, push = true) => {
  const next = structuredClone(mocks.S)
  mut(next)
  mocks.S = next
  mocks.writes.push({ push })
})

vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, update })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({
    toast: (...a) => mocks.toast(...a),
    openSheet: render => { mocks.sheets.push(render); return { id: 's', close: () => {}, lock: () => {} } },
  })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../lib/scan.js', () => ({
  scanCode: (...a) => mocks.scanCode(...a),
  importCodeFromImage: (...a) => mocks.importCodeFromImage(...a),
}))
vi.mock('../lib/mobile.js', () => ({ get MOBILE() { return mocks.MOBILE } }))
// The browser camera sheet is a device surface; capture its props so a test can answer as the
// camera would. It renders nothing.
vi.mock('../components/CameraScan.jsx', () => ({ default: props => { mocks.camera = props; return null } }))
// lean-qr loads through a dynamic import and draws to a real canvas. The value it is asked to
// draw is the part that matters here, so the stub simply reflects it back into the DOM.
vi.mock('../components/QrCanvas.jsx', () => ({ default: ({ value }) => <i data-qr={value} /> }))

import { openAddCard, openEditCard } from './CheckIn.jsx'

/* ------------------------------- harness ------------------------------- */

const card = (id, over = {}) => ({ id, label: id.toUpperCase(), value: 'code-' + id, fmt: 'qrcode', ...over })

let sheetHost, sheetRoot, camHost, camRoot

beforeEach(() => {
  mocks.S = { gymCards: [], lastGymCardId: null }
  mocks.MOBILE = false
  mocks.writes.length = 0
  mocks.sheets.length = 0
  mocks.camera = null
  mocks.toast.mockClear()
  mocks.scanCode.mockReset(); mocks.importCodeFromImage.mockReset()
  update.mockClear()
  sheetHost = document.createElement('div'); document.body.appendChild(sheetHost); sheetRoot = createRoot(sheetHost)
  camHost = document.createElement('div'); document.body.appendChild(camHost); camRoot = createRoot(camHost)
})
afterEach(() => {
  act(() => camRoot.unmount()); camHost.remove()
  act(() => sheetRoot.unmount()); sheetHost.remove()
})

const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

// Renders the sheet the last openAddCard/openEditCard asked for into its own root.
const openSheet = async () => {
  expect(mocks.sheets.length).toBeGreaterThan(0)
  const close = vi.fn()
  act(() => { sheetRoot.render(mocks.sheets.at(-1)(close)) })
  await settle()
  return { close }
}
const sheetBtn = label => [...sheetHost.querySelectorAll('button')].find(b => b.textContent === label)
const labelField = () => sheetHost.querySelector('.g-tfield input')
const numberField = () => [...sheetHost.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label')?.textContent === 'Card number')?.querySelector('input')
const fileInput = () => sheetHost.querySelector('input[type="file"]')
const tap = async el => { await act(async () => { el.click(); await new Promise(r => setTimeout(r, 0)) }) }
const typeInto = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})

/* ================================ tests ================================ */

describe('the card drawer — adding a card', () => {
  const openAdd = async (opts) => { openAddCard(opts); return openSheet() }

  it('a profile saved before gym cards existed can still be given one', async () => {
    mocks.MOBILE = true
    mocks.S = {}                                    // no gymCards key at all
    mocks.scanCode.mockResolvedValue({ value: 'FIRST-EVER', fmt: 'qrcode' })
    await openAdd()
    await tap(sheetBtn('Scan'))
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards).toHaveLength(1)
    expect(mocks.S.gymCards[0].value).toBe('FIRST-EVER')
  })

  it('a label alone cannot create a card — Save stays refused until a code has been captured', async () => {
    await openAdd()
    typeInto(labelField(), 'FitZone downtown')
    expect(sheetBtn('Save card').disabled).toBe(true)
    await tap(sheetBtn('Save card'))
    expect(update).not.toHaveBeenCalled()
    expect(mocks.S.gymCards).toEqual([])
  })

  it('a scanned code plus Save writes the card, points the memory at it, and pushes', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue({ value: 'MEMBER-9931', fmt: 'qrcode' })
    const { close } = await openAdd()
    typeInto(labelField(), 'FitZone downtown')
    await tap(sheetBtn('Scan'))
    await tap(sheetBtn('Save card'))

    expect(mocks.S.gymCards).toHaveLength(1)
    const saved = mocks.S.gymCards[0]
    expect(saved).toMatchObject({ label: 'FitZone downtown', value: 'MEMBER-9931', fmt: 'qrcode' })
    expect(saved.id).toBeTruthy()
    expect(mocks.S.lastGymCardId).toBe(saved.id)
    expect(mocks.writes).toEqual([{ push: true }])
    expect(mocks.toast).toHaveBeenCalledWith('Card added')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('"Scan a new card" opens the drawer already scanning', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue({ value: 'AUTO-1', fmt: 'qrcode' })
    await openAdd({ scan: true })
    expect(mocks.scanCode).toHaveBeenCalledTimes(1)
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('AUTO-1')
  })

  it('"Type the number" shows the number field, and a typed number draws its QR and saves', async () => {
    await openAdd({ typing: true })
    expect(numberField()).toBeTruthy()
    expect(sheetBtn('Save card').disabled).toBe(true)
    typeInto(numberField(), '  2041 7788 0193 ')
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('2041 7788 0193')
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[0]).toMatchObject({ value: '2041 7788 0193', fmt: 'qrcode' })
  })

  it('the number field is not offered unless asked for', async () => {
    await openAdd()
    expect(numberField()).toBeUndefined()
  })

  it('an unnamed card gets a name, and a code with stray whitespace is stored trimmed', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue({ value: '  MEMBER-9931  ', fmt: 'qrcode' })
    await openAdd()
    typeInto(labelField(), '   ')
    await tap(sheetBtn('Scan'))
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[0]).toMatchObject({ label: 'Gym card', value: 'MEMBER-9931' })
  })

  it('a second card is appended and takes over the memory', async () => {
    mocks.MOBILE = true
    mocks.S = { gymCards: [card('a')], lastGymCardId: 'a' }
    mocks.scanCode.mockResolvedValue({ value: 'SECOND', fmt: 'qrcode' })
    await openAdd()
    await tap(sheetBtn('Scan'))
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards.map(c => c.value)).toEqual(['code-a', 'SECOND'])
    expect(mocks.S.lastGymCardId).toBe(mocks.S.gymCards[1].id)
  })

  it('a barcode we could read but could not redraw is refused, and never reaches the form', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue({ value: '5901234123457', fmt: 'EAN_13' })
    await openAdd()
    await tap(sheetBtn('Scan'))
    expect(mocks.toast).toHaveBeenCalledWith("That's not a QR code. Only QR cards can be shown here")
    expect(sheetBtn('Save card').disabled).toBe(true)
    expect(sheetHost.querySelector('[data-qr]')).toBeFalsy()
  })

  it('backing out of the native scanner leaves the form as it was and re-enables the buttons', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue(null)
    await openAdd()
    typeInto(labelField(), 'FitZone')
    await tap(sheetBtn('Scan'))
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(labelField().value).toBe('FitZone')
    expect(sheetBtn('Scan').disabled).toBe(false)     // busy was cleared
    expect(sheetBtn('Save card').disabled).toBe(true)
  })

  it.each([
    ['permission-denied', 'Camera permission is needed to scan. Enable it in Settings.'],
    ['unsupported', 'Scanning is not available on this device.'],
    ['ENOENT something else', 'Could not start the scanner'],
  ])('a %s scanner failure is explained as something the user can act on', async (thrown, message) => {
    mocks.MOBILE = true
    mocks.scanCode.mockRejectedValue(new Error(thrown))
    await openAdd()
    await tap(sheetBtn('Scan'))
    expect(mocks.toast).toHaveBeenCalledWith(message)
    expect(sheetBtn('Scan').disabled).toBe(false)
  })

  it('in a browser the scan opens our own camera sheet instead of the native one', async () => {
    mocks.MOBILE = false
    await openAdd()
    await tap(sheetBtn('Scan'))
    expect(mocks.scanCode).not.toHaveBeenCalled()
    expect(mocks.sheets).toHaveLength(2)

    const closeCam = vi.fn()
    act(() => { camRoot.render(mocks.sheets.at(-1)(closeCam)) })
    await act(async () => { mocks.camera.onFound({ value: 'WEB-CODE', fmt: 'QR_CODE' }) })
    expect(closeCam).toHaveBeenCalledTimes(1)
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('WEB-CODE')

    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[0].value).toBe('WEB-CODE')
  })

  it('the browser camera closes even when what it found cannot be used', async () => {
    mocks.MOBILE = false
    await openAdd()
    await tap(sheetBtn('Scan'))
    const closeCam = vi.fn()
    act(() => { camRoot.render(mocks.sheets.at(-1)(closeCam)) })
    await act(async () => { mocks.camera.onFound({ value: '5901234123457', fmt: 'EAN_13' }) })
    expect(closeCam).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith("That's not a QR code. Only QR cards can be shown here")
    expect(sheetBtn('Save card').disabled).toBe(true)
  })
})

describe('the card drawer — importing a photo', () => {
  const pickFile = async (name = 'card.jpg') => {
    const input = fileInput()
    const file = new File(['bytes'], name, { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise(r => setTimeout(r, 0))
    })
    return file
  }
  const openAdd = async () => { openAddCard(); return openSheet() }

  it('"Import photo" opens the hidden file picker rather than a second sheet', async () => {
    await openAdd()
    const opened = vi.fn()
    fileInput().click = opened
    await tap(sheetBtn('Import photo'))
    expect(opened).toHaveBeenCalledTimes(1)
    expect(mocks.sheets).toHaveLength(1)
  })

  it('a photo with a QR in it fills the form and can then be saved', async () => {
    mocks.importCodeFromImage.mockResolvedValue({ value: 'FROM-PHOTO', fmt: 'QR_CODE' })
    await openAdd()
    await pickFile()
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('FROM-PHOTO')
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[0]).toMatchObject({ value: 'FROM-PHOTO', fmt: 'qrcode' })
  })

  it('dismissing the picker without choosing a photo does nothing at all', async () => {
    await openAdd()
    const input = fileInput()
    Object.defineProperty(input, 'files', { configurable: true, value: [] })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise(r => setTimeout(r, 0))
    })
    expect(mocks.importCodeFromImage).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(sheetBtn('Import photo').disabled).toBe(false)
  })

  it('a photo with nothing in it says so and leaves the form empty', async () => {
    mocks.importCodeFromImage.mockResolvedValue(null)
    await openAdd()
    await pickFile()
    expect(mocks.toast).toHaveBeenCalledWith('No QR code found in that image')
    expect(sheetBtn('Save card').disabled).toBe(true)
  })

  it('a photo of a non-QR barcode is refused for the same reason a scan of one is', async () => {
    mocks.importCodeFromImage.mockResolvedValue({ value: '5901234123457', fmt: 'CODE_128' })
    await openAdd()
    await pickFile()
    expect(mocks.toast).toHaveBeenCalledWith("That's not a QR code. Only QR cards can be shown here")
    expect(sheetBtn('Save card').disabled).toBe(true)
  })

  it('a decoder that throws is reported, not swallowed, and the buttons come back', async () => {
    mocks.importCodeFromImage.mockRejectedValue(new Error('unsupported image'))
    await openAdd()
    await pickFile()
    expect(mocks.toast).toHaveBeenCalledWith('Could not read that image')
    expect(sheetBtn('Import photo').disabled).toBe(false)
  })

  it('the file input is cleared, so the same photo can be tried again after a failure', async () => {
    mocks.importCodeFromImage.mockResolvedValue(null)
    await openAdd()
    await pickFile()
    expect(fileInput().value).toBe('')
    mocks.importCodeFromImage.mockResolvedValue({ value: 'SECOND-TRY', fmt: 'qrcode' })
    await pickFile()
    expect(mocks.importCodeFromImage).toHaveBeenCalledTimes(2)
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('SECOND-TRY')
  })
})

describe('the card drawer — editing a card', () => {
  const openEdit = async (id, cards = [card('a'), card('b')]) => {
    mocks.S = { gymCards: cards, lastGymCardId: cards[0].id }
    openEditCard(cards.find(c => c.id === id))
    return openSheet()
  }

  it('opens pre-filled with the card it was asked about', async () => {
    await openEdit('b')
    expect(labelField().value).toBe('B')
    expect(numberField().value).toBe('code-b')
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('code-b')
    expect(sheetBtn('Re-scan')).toBeTruthy()
    expect(sheetBtn('Scan')).toBeFalsy()
  })

  it('a rename touches that card only — same id, same slot, same code, siblings untouched', async () => {
    const { close } = await openEdit('b')
    typeInto(labelField(), 'FitZone North')
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards.map(c => c.id)).toEqual(['a', 'b'])
    expect(mocks.S.gymCards[0]).toMatchObject({ label: 'A', value: 'code-a' })
    expect(mocks.S.gymCards[1]).toMatchObject({ id: 'b', label: 'FitZone North', value: 'code-b', fmt: 'qrcode' })
    expect(mocks.toast).toHaveBeenCalledWith('Card updated')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('retyping the number replaces the code and keeps the name', async () => {
    await openEdit('b')
    typeInto(numberField(), 'RETYPED-77')
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[1]).toMatchObject({ id: 'b', label: 'B', value: 'RETYPED-77' })
  })

  it('a re-scan replaces the code and keeps the name', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue({ value: 'RENEWED-2027', fmt: 'qrcode' })
    await openEdit('b')
    await tap(sheetBtn('Re-scan'))
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[1]).toMatchObject({ id: 'b', label: 'B', value: 'RENEWED-2027' })
  })

  it('clearing the name gives it the fallback name rather than an empty label', async () => {
    await openEdit('b')
    typeInto(labelField(), '  ')
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[1].label).toBe('Gym card')
  })

  it('a re-scan that is not a QR code cannot overwrite the working code already on the card', async () => {
    mocks.MOBILE = true
    mocks.scanCode.mockResolvedValue({ value: '5901234123457', fmt: 'EAN_13' })
    await openEdit('b')
    await tap(sheetBtn('Re-scan'))
    await tap(sheetBtn('Save card'))
    expect(mocks.S.gymCards[1].value).toBe('code-b')
  })

  // If the card is removed on another device while this sheet is open, there is nothing to
  // edit. Until 2026-09-22 commit()'s `if (!c) return` bailed out of the MUTATOR and not out of
  // commit, so the screen still said "Card updated", still closed, and still pushed a state
  // write that changed nothing. It looks first now, says what happened, and writes nothing.
  it('editing a card that was removed elsewhere says so, writes nothing, and does not claim success', async () => {
    const { close } = await openEdit('b')
    // …the other device's removal arrives while the sheet is open.
    mocks.S = { gymCards: [card('a')], lastGymCardId: 'a' }
    const writes = update.mock.calls.length
    typeInto(labelField(), 'FitZone North')
    await tap(sheetBtn('Save card'))

    expect(mocks.S.gymCards.map(c => c.id)).toEqual(['a'])
    expect(update.mock.calls.length).toBe(writes)                             // no state write at all
    expect(mocks.toast).toHaveBeenCalledWith('That card was removed on another device')
    expect(mocks.toast).not.toHaveBeenCalledWith('Card updated')
    expect(close).toHaveBeenCalledTimes(1)
  })
})

describe('the card drawer — the openers', () => {
  it('openAddCard opens an empty drawer with nothing captured yet', async () => {
    openAddCard()
    const { close } = await openSheet()
    expect(sheetHost.querySelector('h2').textContent).toBe('Add a card')
    expect(labelField().value).toBe('')
    expect(sheetHost.querySelector('[data-qr]')).toBeFalsy()
    expect(close).not.toHaveBeenCalled()
  })

  it('openEditCard opens the drawer on the card it was handed', async () => {
    openEditCard(card('z', { label: 'Zenith', value: 'Z-1' }))
    await openSheet()
    expect(sheetHost.querySelector('h2').textContent).toBe('Edit card')
    expect(labelField().value).toBe('Zenith')
    expect(sheetHost.querySelector('[data-qr]').getAttribute('data-qr')).toBe('Z-1')
  })
})
