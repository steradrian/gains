// @vitest-environment happy-dom
// Rest timer drawer (board St1RestTimer): live, every tap writes S.restSec; 15 s steps, presets.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimerSheet } from './rest-timer-sheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: vi.fn() }) } }))

let host, root
beforeEach(() => {
  mocks.S = { restSec: 90 }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

// the mocked store does not re-render on its own: render again to read the new value
const render = close => act(() => root.render(<RestTimerSheet close={close} />))
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const time = () => host.querySelector('.set-rest-time').textContent

describe('Rest timer drawer', () => {
  it('shows the rest and steps it by 15 seconds each way, writing each tap', () => {
    render()
    expect(time()).toBe('1:30')
    act(() => { button('+15 s').click() })
    expect(mocks.S.restSec).toBe(105)
    render()
    expect(time()).toBe('1:45')
    render()
    act(() => { button('−15 s').click() })
    render()
    act(() => { button('−15 s').click() })
    expect(mocks.S.restSec).toBe(75)
  })

  it('stops at Off and at the longest rest', () => {
    mocks.S.restSec = 10
    render()
    act(() => { button('−15 s').click() })
    expect(mocks.S.restSec).toBe(0)
    render()
    expect(time()).toBe('Off')
    expect(button('−15 s').disabled).toBe(true)
    mocks.S.restSec = 15 * 60
    render()
    expect(button('+15 s').disabled).toBe(true)
  })

  it('a preset sets the value and is lit while it matches', () => {
    render()
    expect([...host.querySelectorAll('.g-cchip')].map(c => c.textContent)).toEqual(['1:00', '1:30', '2:00', '3:00'])
    expect(button('1:30').getAttribute('aria-pressed')).toBe('true')
    act(() => { button('3:00').click() })
    expect(mocks.S.restSec).toBe(180)
    render()
    expect(button('3:00').getAttribute('aria-pressed')).toBe('true')
    expect(button('1:30').getAttribute('aria-pressed')).toBe('false')
  })

  it('Done closes and nothing else is written', () => {
    const close = vi.fn()
    render(close)
    act(() => { button('Done').click() })
    expect(close).toHaveBeenCalled()
    expect(mocks.S.restSec).toBe(90)
  })
})
