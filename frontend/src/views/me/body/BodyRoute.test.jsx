// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import BodyRoute from './BodyRoute.jsx'

// The other two tabs are the pages they were; this page only mounts them.
vi.mock('../../Measurements.jsx', () => ({ default: () => <div data-testid="measurements" /> }))
vi.mock('../photos/PhotosTab.jsx', () => ({ default: () => <div data-testid="photos" /> }))
vi.mock('../../../lib/nutrition/sync.js', () => ({ syncNow: vi.fn(() => Promise.resolve()) }))
vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
const DAY_MS = 864e5
const isoOf = n => { const d = new Date(Date.now() - n * DAY_MS); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function Where() {
  const { pathname, search } = useLocation()
  return <span data-testid="where">{pathname + search}</span>
}
const where = () => host.querySelector('[data-testid="where"]').textContent
const mount = async at => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[at]}><Where /><Routes><Route path="/me/body/*" element={<BodyRoute />} /></Routes></MemoryRouter>)
  })
}
const tabs = () => [...host.querySelectorAll('.g-tabs [role="tab"]')]
const tab = label => tabs().find(b => b.textContent === label)
const click = async el => { await act(async () => { el.click() }) }

beforeEach(() => {
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  useStore.setState(s => ({ user: null, S: { ...s.S, unit: 'kg', targetW: 78, weighIn: undefined,
    bodyweight: [{ d: isoOf(14), w: 82.1, t: 1 }, { d: isoOf(7), w: 81.7, t: 2 }, { d: isoOf(0), w: 81.4, t: 3 }] } }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('the Body page', () => {
  it('titles the page with the latest weigh-in and lists the weigh-ins newest first', async () => {
    await mount('/me/body?range=0')
    expect(host.querySelector('.g-spage-title').textContent).toBe('Body')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('81.4 kg today · −0.3 kg in 7 days')
    expect([...host.querySelectorAll('.g-grow b')].map(b => b.textContent)).toEqual(['81.4 kg', '81.7 kg', '82.1 kg'])
    expect(host.querySelector('.g-ssec-act').textContent).toBe('3 shown')
    expect(host.querySelector('.g-tc-cap').textContent).toBe('Target 78 kg')
  })

  it('has the three tabs, on the address each keeps, switching by replace and keeping ?range=', async () => {
    await mount('/me/body?range=365')
    expect(tabs().map(b => b.textContent)).toEqual(['Weigh-ins', 'Measurements', 'Photos'])
    expect(tab('Weigh-ins').getAttribute('aria-selected')).toBe('true')
    await click(tab('Measurements'))
    expect(where()).toBe('/me/body/measurements?range=365')
    expect(host.querySelector('[data-testid="measurements"]')).not.toBeNull()
    expect(host.querySelector('.g-grow')).toBeNull()
    await click(tab('Photos'))
    expect(where()).toBe('/me/body/photos?range=365')
    expect(host.querySelector('[data-testid="photos"]')).not.toBeNull()
    expect(tab('Photos').getAttribute('aria-selected')).toBe('true')
  })

  it('opens on the tab the address names', async () => {
    await mount('/me/body/photos')
    expect(host.querySelector('[data-testid="photos"]')).not.toBeNull()
    expect(tab('Photos').getAttribute('aria-selected')).toBe('true')
  })

  it('picks the range from the address, writes a pick back to it and remembers it', async () => {
    await mount('/me/body?range=30')
    const range = label => [...host.querySelectorAll('.g-sseg button')].find(b => b.textContent === label)
    expect(range('1M').getAttribute('aria-checked')).toBe('true')
    // All three are in the last month.
    expect(host.querySelector('.g-ssec-act').textContent).toBe('3 shown')
    await click(range('All'))
    expect(where()).toBe('/me/body?range=0')
    expect(localStorage.getItem('gains.progressRange')).toBe('0')
    expect(range('All').getAttribute('aria-checked')).toBe('true')
  })

  it('opens the Edit weigh-in drawer from a row, and Log weight from the bar', async () => {
    await mount('/me/body?range=0')
    await click(host.querySelectorAll('.g-grow')[1])
    expect(useUI.getState().sheets).toHaveLength(1)
    useUI.setState({ sheets: [] })
    await click(host.querySelector('.g-snav-end button'))
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('drops the sentence about the ask before a workout when it is switched off', async () => {
    await mount('/me/body?range=0')
    expect(host.querySelector('.g-snote').textContent).toContain('Gains also asks for a weigh-in before your first workout of the week.')
    useStore.setState(s => ({ S: { ...s.S, weighIn: false } }))
    await mount('/me/body?range=0')
    expect(host.querySelector('.g-snote').textContent).toBe('Same time, before breakfast, gives the cleanest trend.')
  })

  it('shows the empty state, without a card, with Log weight', async () => {
    useStore.setState(s => ({ S: { ...s.S, bodyweight: [] } }))
    await mount('/me/body')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('Nothing logged yet')
    const empty = host.querySelector('.g-sempty')
    expect(empty.className).not.toContain('g-sempty-card')
    expect(empty.querySelector('b').textContent).toBe('No weigh-ins yet')
    expect(empty.textContent).toContain('Gains also asks before your first workout of the week.')
    await click(empty.querySelector('.g-sempty-btn'))
    expect(useUI.getState().sheets).toHaveLength(1)
  })
})
