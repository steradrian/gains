// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from './useUI.js'

beforeEach(() => { vi.useFakeTimers(); useUI.setState({ toastMsg: '', toastAction: null }) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('toast with an action', () => {
  it('a plain toast is text only and goes after 2.2 s', () => {
    useUI.getState().toast('Saved')
    expect(useUI.getState().toastMsg).toBe('Saved')
    expect(useUI.getState().toastAction).toBeNull()
    vi.advanceTimersByTime(2199)
    expect(useUI.getState().toastMsg).toBe('Saved')
    vi.advanceTimersByTime(2)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('stays 8 s with an action, and the action fires once', () => {
    const onAction = vi.fn()
    useUI.getState().toast('Set 2 gone.', { action: 'Undo', onAction })
    expect(useUI.getState().toastAction).toMatchObject({ label: 'Undo', icon: 'check', ms: 8000 })
    vi.advanceTimersByTime(7900)
    expect(useUI.getState().toastMsg).toBe('Set 2 gone.')
    useUI.getState().runToastAction()
    useUI.getState().runToastAction()
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('times out after 8 s without running the action', () => {
    const onAction = vi.fn()
    useUI.getState().toast('Set 2 gone.', { action: 'Undo', onAction })
    vi.advanceTimersByTime(7999)
    expect(useUI.getState().toastMsg).toBe('Set 2 gone.')
    vi.advanceTimersByTime(2)
    expect(useUI.getState().toastMsg).toBe('')
    expect(useUI.getState().toastAction).toBeNull()
    useUI.getState().runToastAction()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('names its own glyph and length when asked', () => {
    useUI.getState().toast('A new version is ready', { action: 'Reload', onAction: () => {}, ms: 30000, icon: 'reset' })
    expect(useUI.getState().toastAction).toMatchObject({ icon: 'reset', ms: 30000 })
  })

  it('a new toast replaces the old one and its action', () => {
    const first = vi.fn()
    useUI.getState().toast('Set 2 gone.', { action: 'Undo', onAction: first })
    useUI.getState().toast('Copied')
    expect(useUI.getState().toastAction).toBeNull()
    useUI.getState().runToastAction()
    expect(first).not.toHaveBeenCalled()
  })

  it('holds still while touched, says so for its drain bar, and carries on afterwards', () => {
    useUI.getState().toast('Set 2 gone.', { action: 'Undo', onAction: () => {} })
    vi.advanceTimersByTime(6000)
    useUI.getState().pauseToast()
    expect(useUI.getState().toastPaused).toBe(true)
    vi.advanceTimersByTime(20000)
    expect(useUI.getState().toastMsg).toBe('Set 2 gone.')
    useUI.getState().resumeToast()
    expect(useUI.getState().toastPaused).toBe(false)
    vi.advanceTimersByTime(1900)
    expect(useUI.getState().toastMsg).toBe('Set 2 gone.')
    vi.advanceTimersByTime(200)
    expect(useUI.getState().toastMsg).toBe('')
  })
})
