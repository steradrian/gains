// @vitest-environment happy-dom
// A select sheet whose choice rewrites the address (Progress › an exercise's picker puts `?ex=` in
// it, by replace): the choice used to run in the same commit as the sheet's close, so Modals skipped
// walking the sheet's entry off and the replace overwrote that entry instead. The page with the old
// choice stayed under it, and Back went there rather than leaving the page
// (docs/audits/gains-train-review.md #8). Real router, real history, the real sheet host.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nav, setNav } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import Modals from './Modals.jsx'
import { bindUI, selectSheet } from './ui.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root

function Wire() {
  const navigate = useNavigate()
  setNav(navigate)
  return null
}
function Where() {
  const { pathname, search } = useLocation()
  return <span data-testid="where">{pathname + search}</span>
}
const where = () => host.querySelector('[data-testid="where"]').textContent
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 30)) }) }
const go = async to => { await act(async () => { history.pushState(null, '', '#' + to); window.dispatchEvent(new PopStateEvent('popstate')) }); await settle() }
const back = async () => { await act(async () => { history.back() }); await settle() }

beforeEach(async () => {
  bindUI(useUI)
  useUI.setState({ sheets: [] })
  history.replaceState(null, '', '#/progress')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<HashRouter>
      <Wire />
      <Where />
      <Routes><Route path="*" element={null} /></Routes>
      <Modals />
    </HashRouter>)
  })
  await settle()
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

describe('a select sheet whose choice replaces the address', () => {
  it('leaves no entry with the old choice: one Back leaves the page', async () => {
    await go('/progress/strength?ex=bench')
    await act(async () => {
      selectSheet({
        title: 'Exercise', value: 'bench',
        options: [{ value: 'bench', label: 'Bench press' }, { value: 'squat', label: 'Squat' }],
        onChange: v => nav('/progress/strength?ex=' + v, { replace: true }),
      })
    })
    await settle()
    const squat = [...document.querySelectorAll('#modal-root .lrow')].find(b => b.textContent.includes('Squat'))
    await act(async () => { squat.click() })
    await settle()

    expect(useUI.getState().sheets).toHaveLength(0)
    expect(where()).toBe('/progress/strength?ex=squat')
    await back()
    expect(where()).toBe('/progress')
  })
})
