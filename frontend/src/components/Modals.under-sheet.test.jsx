// @vitest-environment happy-dom
// The strip under a drawer on an installed iPhone app. Once a keyboard has been up, WebKit can leave
// the layout viewport 59px short of the screen (932 → 873 on a 15 Pro Max): #modal-root, a fixed box,
// ends there, and WebKit fills the strip below with the page's background, the beige canvas, where no
// box (not the scrim, not the drawer's colour shadow) can draw. While a drawer is the one on top, the
// page's background is the drawer's colour, so the strip reads as the drawer reaching the edge.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './Modals.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import { useUI } from '../store/useUI.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
const html = () => document.documentElement
const ui = () => useUI.getState()
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }
const under = () => html().hasAttribute('data-sheet-up') ? html().style.getPropertyValue('--under-sheet') : null

beforeEach(async () => {
  document.head.innerHTML = '<style>.g-bs{background-color:rgb(255, 255, 255)}.sheet{background-color:rgb(22, 22, 21)}</style>'
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
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('the page under a drawer takes the drawer\'s colour', () => {
  it('a design-system drawer: its surface, while it is up, and the page\'s own again once it goes', async () => {
    expect(under()).toBe(null)
    let drawer
    await act(async () => { drawer = ui().openSheet(() => <BottomSheet title="Exercise"><p>body</p></BottomSheet>, { variant: 'ds' }) })
    expect(under()).toBe('rgb(255, 255, 255)')
    await act(async () => { drawer.close() })
    await settle()
    expect(under()).toBe(null)
    expect(html().style.getPropertyValue('--under-sheet')).toBe('')
  })

  it('an older sheet: its own background', async () => {
    await act(async () => { ui().openSheet(() => <p>legacy</p>) })
    expect(under()).toBe('rgb(22, 22, 21)')
  })

  it('a centred dialog is not a drawer: the page keeps its background', async () => {
    await act(async () => { ui().openSheet(() => <p>Sure?</p>, { kind: 'center' }) })
    expect(document.querySelector('.center')).not.toBe(null)
    expect(under()).toBe(null)
  })

  it('a dialog over a drawer: the drawer is still on screen, so the page keeps its colour', async () => {
    await act(async () => { ui().openSheet(() => <BottomSheet title="Exercise"><p>body</p></BottomSheet>, { variant: 'ds' }) })
    let dialog
    await act(async () => { dialog = ui().openSheet(() => <p>Sure?</p>, { kind: 'center' }) })
    expect(ui().sheets).toHaveLength(2)
    expect(under()).toBe('rgb(255, 255, 255)')
    await act(async () => { dialog.close() })
    await settle()
    expect(under()).toBe('rgb(255, 255, 255)')
  })

  it('one drawer swapped for another in one tap: the new one\'s colour, nothing left over', async () => {
    let first
    await act(async () => { first = ui().openSheet(() => <p>legacy</p>) })
    await act(async () => { first.close(); ui().openSheet(() => <BottomSheet title="Next"><p>body</p></BottomSheet>, { variant: 'ds' }) })
    await settle()
    expect(under()).toBe('rgb(255, 255, 255)')
  })
})
