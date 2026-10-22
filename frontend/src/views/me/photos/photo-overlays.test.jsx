// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtDate } from '../../../lib/format.js'
import { useUI } from '../../../store/useUI.js'
import { openCompare, openViewer } from './photo-overlays.jsx'

vi.mock('../../../components/CustomMedia.jsx', () => ({ MediaView: ({ m }) => <i data-hash={m.hash} /> }))

const photo = (d, c) => ({ key: 'own:' + c, d, ref: { hash: c.repeat(64) } })
const mounted = []
const renderTop = () => {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = ''
  useUI.setState({ sheets: [] })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

// The seams photos-M3 replaces: the names and arguments stay.
describe('photo overlays (temporary bodies)', () => {
  it('openViewer shows the photo and its day, and Close leaves', () => {
    openViewer(photo('2026-10-18', 'a'))
    const host = renderTop()
    expect(useUI.getState().sheets[0].kind).toBe('viewer')
    expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Photo')
    expect(host.querySelector('.mviewer-count').textContent).toBe(fmtDate('2026-10-18', true, true))
    expect(host.querySelector('i').dataset.hash).toBe('a'.repeat(64))
    act(() => host.querySelector('button[aria-label="Close"]').click())
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('openCompare shows the earliest and the latest of the photos given', () => {
    openCompare([photo('2026-10-18', 'a'), photo('2026-10-04', 'b'), photo('2026-08-02', 'c')])
    const host = renderTop()
    expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Compare photos')
    expect([...host.querySelectorAll('i')].map(i => i.dataset.hash)).toEqual(['c'.repeat(64), 'a'.repeat(64)])
  })

  it('openCompare needs two photos', () => {
    openCompare([photo('2026-10-18', 'a')])
    openCompare(undefined)
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})
