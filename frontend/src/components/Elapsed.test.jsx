// @vitest-environment happy-dom
// The running workout's clock read "14526:42" for a session ten days old: minutes with no hours.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import Elapsed from './Elapsed.jsx'

let root, host
const show = start => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  root = createRoot(host)
  act(() => root.render(<Elapsed start={start} />))
  return host.textContent
}
afterEach(() => { act(() => root.unmount()) })

describe('the session clock', () => {
  it('reads minutes and seconds under an hour, and carries the hours past one', () => {
    expect(show(Date.now() - (12 * 60 + 34) * 1000)).toBe('12:34')
    act(() => root.unmount())
    expect(show(Date.now() - (75 * 60) * 1000)).toBe('1:15:00')
    act(() => root.unmount())
    expect(show(Date.now() - (14526 * 60 + 42) * 1000)).toBe('242:06:42')
  })
})
