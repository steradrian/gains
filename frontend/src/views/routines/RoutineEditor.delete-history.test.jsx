// @vitest-environment happy-dom
// T5.8's Delete routine from the editor's ⋯, on the real router, the real tab history
// (lib/use-tab-nav.js) and the real sheet host (docs/audits/gains-train-review.md #2). Deleted under
// the open editor, the editor's missing-routine redirect wrote the address in the same commit as
// the menu's close, Modals skipped walking the menu's entry off, and Back landed on the deleted
// routine, whose redirect sent it to the list again, every time. The menu now closes, waits for its
// entry to go and deletes then; the editor steps back off its page, so the list it was opened from
// is the page on screen and one Back leaves it.
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals from '../../components/Modals.jsx'
import { nav, setNav } from '../../lib/nav.js'
import { useTabNav } from '../../lib/use-tab-nav.js'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import RoutineEditor from './RoutineEditor.jsx'

vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
const seen = []

// The app shell's part (App.jsx): the router's navigate for lib/nav.js, and the tab history.
function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const navType = useNavigationType()
  setNav(navigate)
  useTabNav({ navigate, location, navType })
  return null
}
function Where() {
  const { pathname } = useLocation()
  useEffect(() => { seen.push(pathname) }, [pathname])
  return <span data-testid="where">{pathname}</span>
}
const where = () => host.querySelector('[data-testid="where"]').textContent
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 30)) }) }
const go = async (to, opts) => { await act(async () => { nav(to, opts) }); await settle() }
const back = async () => { await act(async () => { history.back() }); await settle() }
const click = async el => { await act(async () => { el.click() }); await settle() }
const lift = id => ({ id, mode: 'reps', sets: 3, reps: 8, weight: 60 })
const deleteFromMenu = async () => {
  await click(host.querySelector('[aria-label="Routine options"]'))
  await click([...document.querySelectorAll('.g-bs .g-menuitem')].find(b => b.textContent.includes('Delete routine')))
}

beforeEach(async () => {
  seen.length = 0
  sessionStorage.clear()
  const S = structuredClone(DEF)
  Object.assign(S, { unit: 'kg', active: null, workouts: [], routines: [{ id: 'push', name: 'Push A', emoji: 'dumbbell', ex: [lift('0025')] }] })
  useStore.setState({ S, user: null })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  history.replaceState(null, '', '#/train')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<HashRouter>
      <Shell />
      <Where />
      <Routes>
        <Route path="/train/routines/:id" element={<RoutineEditor />} />
        <Route path="*" element={null} />
      </Routes>
      <Modals />
    </HashRouter>)
  })
  await settle()
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

describe('Delete routine from the editor', () => {
  it('opened from the list: lands on the list, and one Back leaves it, never returning to the routine', async () => {
    await go('/train/routines')
    await go('/train/routines/push')
    expect(where()).toBe('/train/routines/push')

    await deleteFromMenu()

    expect(where()).toBe('/train/routines')
    expect(useStore.getState().S.routines).toEqual([])
    expect(useUI.getState().toastMsg).toMatch(/^Deleted Push A/)
    const after = seen.length

    await back()
    expect(where()).toBe('/train')
    expect(seen.slice(after)).not.toContain('/train/routines/push')
  })

  it('opened by a link with nothing under it: the list takes its place', async () => {
    await go('/train/routines/push', { replace: true })
    expect(where()).toBe('/train/routines/push')

    await deleteFromMenu()

    expect(where()).toBe('/train/routines')
    expect(useStore.getState().S.routines).toEqual([])
  })
})
