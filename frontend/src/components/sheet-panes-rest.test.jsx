// @vitest-environment happy-dom
// A drawer's panes rest at x 0. In production a drawer's body was left scrolled 8px sideways (a menu
// list's bleed made it wider than the body, and iOS scrolled it to reveal a field), so everything in
// it sat cut off at the left edge while the header, outside the body, was whole. The body has room
// for that bleed now (ds.css), and the drawer puts back any sideways scroll of its own boxes.
import React, { act, useState } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals, { scrollRestorePending } from './Modals.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import { drawerFlow, useUI } from '../store/useUI.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
const q = s => document.querySelector(s)
const all = s => [...document.querySelectorAll(s)]
const ui = () => useUI.getState()
const click = el => act(async () => { el.click() })
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) }) }

let grow = () => {}
const Detail = ({ close }) => {
  const [rows, setRows] = useState(1)
  grow = () => setRows(n => n + 3)
  return (
    <BottomSheet title="Detail" footer={<button id="detail-done" onClick={close}>Done</button>}>
      {Array.from({ length: rows }, (_, i) => <p key={i}>row {i}</p>)}
    </BottomSheet>
  )
}
const Root = () => (
  <BottomSheet title="Exercise">
    <input id="field" />
    <button id="push" onClick={() => drawerFlow(() => ui().openSheet(c => <Detail close={c} />, { variant: 'ds' }))}>More</button>
  </BottomSheet>
)
const open = () => act(async () => { ui().openSheet(() => <Root />, { variant: 'ds' }) })

// Every box of the drawer's that could hold its content off to one side.
const frameBoxes = () => [q('#modal-root .g-bs'), q('#modal-root .g-bs-panes'), ...all('#modal-root .g-bs-pane'), ...all('#modal-root .g-bs-body')]
const atRest = () => frameBoxes().every(el => !el.scrollLeft && !(el.style.transform || '').includes('translate'))
// What iOS does to a box that is a few px too narrow for its content: scrolls it sideways.
const nudge = el => act(async () => { el.scrollLeft = 8; el.dispatchEvent(new Event('scroll')) })

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

describe('a drawer\'s panes rest at x 0', () => {
  it('when it opens, and a sideways scroll of its body, pane or panel is put back', async () => {
    await open()
    await settle()
    expect(atRest()).toBe(true)
    for (const el of frameBoxes()) {
      await nudge(el)
      expect(el.scrollLeft).toBe(0)
    }
  })

  it('after a panel is pushed and popped', async () => {
    await open()
    await click(q('#push'))
    await settle()
    expect(q('.g-bs-pane[data-pos="active"] h2').textContent).toBe('Detail')
    expect(atRest()).toBe(true)
    await nudge(q('.g-bs-pane[data-pos="active"] .g-bs-body'))
    expect(atRest()).toBe(true)

    await click(q('.g-bs-pane[data-pos="active"] .g-bs-back'))
    await settle()
    expect(ui().sheets[0].panels).toHaveLength(0)
    expect(q('.g-bs-pane-root').getAttribute('data-pos')).toBe('active')
    expect(atRest()).toBe(true)
  })

  it('a box left scrolled before a push is levelled by the push', async () => {
    await open()
    const body = q('.g-bs-pane-root .g-bs-body')
    body.scrollLeft = 8 // no scroll event: set by script, as a WebKit reveal can be
    await click(q('#push'))
    await settle()
    expect(body.scrollLeft).toBe(0)
  })

  it('after the panel\'s content changes and the panes refit', async () => {
    await open()
    await click(q('#push'))
    await settle()
    const body = q('.g-bs-pane[data-pos="active"] .g-bs-body')
    body.scrollLeft = 8
    await act(async () => { grow() })
    await settle()
    expect(all('.g-bs-pane[data-pos="active"] .g-bs-body p')).toHaveLength(4)
    expect(body.scrollLeft).toBe(0)
    expect(atRest()).toBe(true)
  })

  it('leaves a strip that scrolls sideways on purpose alone', async () => {
    await open()
    const strip = document.createElement('div')
    strip.className = 'g-cgroup-scroll'
    q('.g-bs-pane-root .g-bs-body').appendChild(strip)
    await nudge(strip)
    expect(strip.scrollLeft).toBe(8)
  })
})

describe('the drawer body has room for the kit\'s bleed and does not scroll sideways', () => {
  const css = readFileSync(join(import.meta.dirname, '../ds/ds.css'), 'utf8')
  const rule = sel => css.match(new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm'))?.[1] || ''

  it('body: overflow-x hidden, an 8px gutter each side that its content does not move for', () => {
    const body = rule('.g-bs-body')
    expect(body).toMatch(/overflow-x: hidden/)
    expect(body).toMatch(/margin-inline: calc\(-1 \* var\(--space-2\)\)/)
    expect(body).toMatch(/padding-inline: var\(--space-2\)/)
  })

  it('no bleed in the kit is wider than that gutter (the menu list is the widest, 8px)', () => {
    expect(rule('.g-menulist')).toMatch(/margin: 0 calc\(-1 \* var\(--space-2\)\)/)
    const px = [...css.matchAll(/margin(?:-inline)?: (?:-?\d+px )?-(\d+)px/g)].map(m => Number(m[1]))
    // The drawer's own panes undo its side padding (20px), and are not content.
    expect(px.filter(n => n > 8 && n !== 20 && n !== 18 && n !== 320)).toEqual([])
  })

  it('a legacy pane, which scrolls itself, does not scroll sideways either', () => {
    expect(rule('.g-bs-pane-legacy')).toMatch(/overflow-x: hidden/)
  })
})
