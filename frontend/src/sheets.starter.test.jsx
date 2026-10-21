// @vitest-environment happy-dom
// starterPlanSheet is the opener Train's rows, the empty states and Settings' search call for the
// ready-made plans. They are a page now (views/train/plans/*.test.jsx cover the list, the preview
// and Load with Undo), so the opener only goes there: no sheet, and from a drawer that has just
// closed it takes the drawer's history entry instead of stacking on it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNav } from './lib/nav.js'
import { starterPlanSheet } from './sheets.jsx'
import { useUI } from './store/useUI.js'

const go = vi.fn()
beforeEach(() => {
  go.mockClear()
  setNav(go)
  useUI.setState({ sheets: [] })
  window.history.replaceState(null, '')
})
afterEach(() => {
  setNav(() => {})
  window.history.replaceState(null, '')
})

describe('starterPlanSheet', () => {
  it('goes to Ready-made plans and opens no sheet', () => {
    starterPlanSheet()
    expect(go).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledWith('/train/plans')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('replaces the entry of a drawer that has just closed, so back does not land on it', () => {
    window.history.replaceState({ gainsSheet: true }, '')
    starterPlanSheet()
    expect(go).toHaveBeenCalledWith('/train/plans', { replace: true })
  })
})
