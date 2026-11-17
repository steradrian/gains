// @vitest-environment happy-dom
// The Hevy key drawer (board St1ImportHevy): the key goes to the caller once, is wiped, and is
// never stored anywhere.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HevyKeySheet } from './hevy-key-sheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const type = (el, value) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const button = text => [...host.querySelectorAll('button, a')].find(b => b.textContent.includes(text))

describe('HevyKeySheet', () => {
  it('cannot import without a key', () => {
    act(() => root.render(<HevyKeySheet close={vi.fn()} onSubmit={vi.fn()} />))
    expect(button('Import from Hevy').disabled).toBe(true)
  })

  it('hands the key over once, closes first, wipes the field, and stores nothing', () => {
    const order = []
    const close = vi.fn(() => order.push('close'))
    const onSubmit = vi.fn(() => order.push('submit'))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => root.render(<HevyKeySheet close={close} onSubmit={onSubmit} />))
    const input = host.querySelector('input')
    expect(input.type).toBe('password')
    type(input, '  abc-123  ')
    act(() => { button('Import from Hevy').click() })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('abc-123')
    expect(order).toEqual(['close', 'submit'])
    expect(input.value).toBe('')
    act(() => { button('Import from Hevy').click() })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })
})
