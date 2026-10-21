// @vitest-environment happy-dom
// The weekly check-in drawer (T11.1) and its toast (T11.2): Send waits for a feel, saves this
// week's check-in, closes before the toast, and Undo puts back what the week held; this week's
// check-in opens filled in.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkInFor, checkInWeek } from '../../../lib/coach-checkin.js'
import { click, type, useView } from '../../../ds/render.test-util.js'
import CheckInDrawer from './CheckInDrawer.jsx'

const mocks = vi.hoisted(() => {
  const state = { S: null, toast: vi.fn(), order: [] }
  state.storeSnapshot = () => ({ S: state.S, update: mut => { const next = structuredClone(state.S); mut(next); state.S = next } })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const ui = () => ({ toast: (...a) => { mocks.order.push('toast'); mocks.toast(...a) }, openSheet: vi.fn() })
  const useUI = selector => (selector ? selector(ui()) : ui())
  useUI.getState = ui
  return { useUI, TOAST_ACTION_MS: 8000 }
})

const view = useView()
const close = vi.fn(() => mocks.order.push('close'))
const chip = label => [...view.host.querySelectorAll('.g-cchip')].find(b => b.textContent === label)
const send = () => [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Send check-in')
const week = () => checkInWeek(mocks.S)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.order = []
  mocks.S = { weekStart: 1, coachCheckIns: {} }
})
afterEach(() => { vi.useRealTimers() })

describe('the check-in drawer', () => {
  it('asks how the week went, then sleep and a note, for this week', () => {
    view.render(<CheckInDrawer close={close} />)
    expect(view.host.querySelector('h2').textContent).toBe('Check in')
    expect(view.host.querySelector('.g-bs-chip').textContent).toContain('Week of')
    expect(view.host.textContent).toContain('How did this week go? Coach reads it before planning next week.')
    expect([...view.host.querySelectorAll('.g-cchip')].map(b => b.textContent)).toEqual(['Too easy', 'Just right', 'Hard', 'Too much', 'Poor', 'OK', 'Good'])
    expect(view.host.textContent).toContain('Anything else? (optional)')
  })

  it('Send waits for a feel', () => {
    view.render(<CheckInDrawer close={close} />)
    expect(send().disabled).toBe(true)
    click(send())
    expect(close).not.toHaveBeenCalled()
    click(chip('Hard'))
    expect(send().disabled).toBe(false)
  })

  it('saves this week’s check-in, closes, then toasts with Undo', () => {
    view.render(<CheckInDrawer close={close} />)
    click(chip('Hard'))
    click(chip('Poor'))
    type(view.host.querySelector('input'), 'Shoulder a bit tight')
    click(send())
    expect(checkInFor(mocks.S)).toEqual({ feel: 'hard', sleep: 'poor', note: 'Shoulder a bit tight' })
    expect(mocks.order).toEqual(['close', 'toast'])
    expect(mocks.toast).toHaveBeenCalledWith('Noted. See you next session.', expect.objectContaining({ action: 'Undo' }))
  })

  it('Undo clears a first check-in with a stamped entry, so another device does not bring it back', () => {
    view.render(<CheckInDrawer close={close} />)
    click(chip('Just right'))
    click(send())
    act(() => { mocks.toast.mock.calls[0][1].onAction() })
    expect(checkInFor(mocks.S)).toBeNull()
    expect(mocks.S.coachCheckIns[week()]._ts).toBeGreaterThan(0)
  })

  it('opens this week’s check-in filled in, and Undo after an edit puts the earlier one back', () => {
    mocks.S.coachCheckIns = { [week()]: { feel: 'right', sleep: 'good', note: 'Fine', _ts: 5 } }
    view.render(<CheckInDrawer close={close} />)
    expect(chip('Just right').getAttribute('aria-pressed')).toBe('true')
    expect(chip('Good').getAttribute('aria-pressed')).toBe('true')
    expect(view.host.querySelector('input').value).toBe('Fine')
    expect(send().disabled).toBe(false)
    click(chip('Too much'))
    click(send())
    expect(checkInFor(mocks.S).feel).toBe('much')
    act(() => { mocks.toast.mock.calls[0][1].onAction() })
    expect(checkInFor(mocks.S)).toEqual({ feel: 'right', sleep: 'good', note: 'Fine' })
  })
})
