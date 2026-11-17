// @vitest-environment happy-dom
// Autosave (the editors' "saves as you type"): one write per burst after the pause, never two at a
// time, a failure kept for Retry, and what is waiting sent when the page is left.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_MS, useAutosave } from './use-autosave.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host
let root
let api

function Probe({ write, options }) {
  api = useAutosave(write, options)
  return <i data-state="">{api.state}</i>
}
const mount = (write, options) => act(() => root.render(<Probe write={write} options={options} />))
const state = () => host.querySelector('[data-state]').textContent
const advance = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  try { act(() => root.unmount()) } catch { /* already unmounted */ }
  host.remove()
  vi.useRealTimers()
})

describe('useAutosave', () => {
  it('writes the newest value once, after the pause, and says saved', async () => {
    const write = vi.fn(async () => true)
    mount(write)
    act(() => { api.schedule('a'); api.schedule('ab'); api.schedule('abc') })
    await advance(AUTOSAVE_MS - 1)
    expect(write).not.toHaveBeenCalled()
    await advance(1)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith('abc')
    expect(state()).toBe('saved')
  })

  it('starts as given, and goes back to idle when the write chose not to write', async () => {
    const write = vi.fn(async () => false)
    mount(write, { initial: 'saved' })
    expect(state()).toBe('saved')
    act(() => api.schedule('x'))
    await advance(AUTOSAVE_MS)
    expect(state()).toBe('idle')
  })

  it('never has two writes out: a change during a write waits for it, then goes alone', async () => {
    let finish
    const write = vi.fn(value => new Promise(resolve => { finish = () => resolve(value) }))
    mount(write)
    act(() => api.schedule('one'))
    await advance(AUTOSAVE_MS)
    expect(write).toHaveBeenCalledTimes(1)
    expect(state()).toBe('syncing')
    act(() => api.schedule('two'))
    await advance(AUTOSAVE_MS * 2)
    expect(write).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    await advance(0)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith('two')
  })

  it('keeps a failed value, says error, tells onError, and Retry sends it again', async () => {
    const boom = new Error('offline')
    const write = vi.fn().mockRejectedValueOnce(boom).mockResolvedValue(true)
    const onError = vi.fn()
    mount(write, { onError })
    act(() => api.schedule('kept'))
    await advance(AUTOSAVE_MS)
    expect(state()).toBe('error')
    expect(onError).toHaveBeenCalledWith(boom)
    await act(async () => { api.retry() })
    await advance(0)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith('kept')
    expect(state()).toBe('saved')
  })

  it('sends what is waiting when the page is left', async () => {
    const write = vi.fn(async () => true)
    mount(write)
    act(() => api.schedule('typed'))
    act(() => root.unmount())
    await advance(0)
    expect(write).toHaveBeenCalledWith('typed')
  })

  it('flush waits for a write that is already out, and for what queued behind it', async () => {
    let release
    const write = vi.fn(value => (value === 'a' ? new Promise(r => { release = () => r(true) }) : Promise.resolve(true)))
    mount(write)
    act(() => api.schedule('a'))
    await advance(AUTOSAVE_MS)
    expect(write).toHaveBeenCalledTimes(1)
    act(() => api.schedule('ab'))
    let done = false
    act(() => { api.flush().then(() => { done = true }) })
    await advance(0)
    expect(done).toBe(false)
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(0) })
    expect(done).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith('ab')
  })

  it('cancel drops what is waiting', async () => {
    const write = vi.fn(async () => true)
    mount(write)
    act(() => { api.schedule('typed'); api.cancel() })
    await advance(AUTOSAVE_MS * 2)
    act(() => root.unmount())
    await advance(0)
    expect(write).not.toHaveBeenCalled()
  })
})
