// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { hasUnsaved, useUnsavedGuard } from './unsaved-guard.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Page({ dirty }) {
  useUnsavedGuard(dirty)
  return null
}

describe('the unsaved-input guard', () => {
  it('holds while a page is dirty, lets go when it is saved or gone', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<Page dirty={false} />))
    expect(hasUnsaved()).toBe(false)
    act(() => root.render(<Page dirty />))
    expect(hasUnsaved()).toBe(true)
    act(() => root.render(<Page dirty={false} />))
    expect(hasUnsaved()).toBe(false)
    act(() => root.render(<Page dirty />))
    act(() => root.unmount())
    expect(hasUnsaved()).toBe(false)
  })

  it('counts every dirty page', () => {
    const a = createRoot(document.createElement('div'))
    const b = createRoot(document.createElement('div'))
    act(() => { a.render(<Page dirty />); b.render(<Page dirty />) })
    act(() => a.unmount())
    expect(hasUnsaved()).toBe(true)
    act(() => b.unmount())
    expect(hasUnsaved()).toBe(false)
  })
})
