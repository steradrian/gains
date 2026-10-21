// @vitest-environment happy-dom
// T3.5 the Plan menu and T3.6 Share your plan (sheets/plan.jsx), which take over the old PlanTools
// sheet: sharing needs a routine with an exercise in it (the empty-plan hint says so), a plan file
// is picked here, ready-made plans, and the coach only when there is one.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { setNav } from './lib/nav.js'
import { planShareSheet, planToolsSheet } from './sheets.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []
const EMPTY_HINT = 'Add an exercise to a routine first. An empty plan has nothing to share.'

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const items = host => [...host.querySelectorAll('.g-menuitem')]
const item = (host, label) => items(host).find(b => b.querySelector('b').textContent === label)
const install = (routines, extra = {}) => {
  const st = clone(DEF)
  Object.assign(st, { routines, week: {}, dayPlan: {} })
  useStore.setState({ S: st, user: null, config: null, ...extra })
}
const push = { id: 'p', name: 'Push A', emoji: null, ex: [{ id: '0025', sets: 3 }, { id: '0025', sets: 3 }] }
const pull = { id: 'q', name: 'Pull A', emoji: null, ex: [{ id: '0025', sets: 3 }] }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(r => r.unmount()) })
  setNav(() => {})
})

describe('T3.5 the Plan menu', () => {
  it('is titled Plan and lists Share, Import and Ready-made plans; Coach only when there is one', () => {
    install([push])
    planToolsSheet()
    const host = renderTop()
    expect(host.querySelector('h2').textContent).toBe('Plan')
    expect(items(host).map(b => b.querySelector('b').textContent)).toEqual(['Share your plan', 'Import a plan file', 'Ready-made plans'])
    expect(item(host, 'Import a plan file').textContent).toContain('Got a plan from a friend?')
    install([push], { config: { coach: { enabled: true } }, user: { id: 'u1', name: 'Alex' } })
    useUI.setState({ sheets: [] })
    planToolsSheet()
    expect(items(renderTop()).map(b => b.querySelector('b').textContent)).toContain('Coach')
  })

  it('an empty plan cannot be shared, and says why', () => {
    install([{ id: 'e', name: 'Empty', emoji: null, ex: [] }])
    planToolsSheet()
    const share = item(renderTop(), 'Share your plan')
    expect(share.disabled).toBe(true)
    expect(share.textContent).toContain(EMPTY_HINT)
  })

  it('Share opens T3.6 in its place', () => {
    install([push])
    planToolsSheet()
    act(() => { item(renderTop(), 'Share your plan').click() })
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(renderTop().querySelector('h2').textContent).toBe('Share your plan')
  })

  it('takes a plan file, .gains or .json', () => {
    install([push])
    planToolsSheet()
    expect(renderTop().querySelector('input[type=file]').getAttribute('accept')).toBe('application/json,.json,.gains')
  })

  it('Coach goes to the coach, closing the menu', () => {
    const go = vi.fn()
    setNav(go)
    install([push], { config: { coach: { enabled: true } }, user: { id: 'u1', name: 'Alex' } })
    planToolsSheet()
    act(() => { item(renderTop(), 'Coach').click() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(go.mock.calls[0][0]).toBe('/train/coach')
  })
})

describe('T3.6 Share your plan', () => {
  it('previews what goes out: the routines with exercises and how many exercises', () => {
    install([push, pull, { id: 'e', name: 'Empty', emoji: null, ex: [] }])
    planShareSheet()
    const host = renderTop()
    expect(host.querySelector('.g-tr3-card b').textContent).toBe('Weekly Training Plan')
    expect(host.querySelector('.g-tr3-card span').textContent).toBe('Push A · Pull A · 3 exercises')
    expect(item(host, 'Export plan file').textContent).toContain('A .json file a friend can import')
    expect(item(host, 'Print / Save as PDF').textContent).toContain('one page per plan')
    expect(item(host, 'Export plan file').disabled).toBe(false)
  })

  it('with nothing to share, both are off and the card says why', () => {
    install([])
    planShareSheet()
    const host = renderTop()
    expect(item(host, 'Export plan file').disabled).toBe(true)
    expect(item(host, 'Print / Save as PDF').disabled).toBe(true)
    expect(host.querySelector('.g-tr3-card span').textContent).toBe(EMPTY_HINT)
  })
})
