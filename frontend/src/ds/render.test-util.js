// What the design system's tests share: a root to render into (unmounted after each test) and
// typing into an input the way React hears it.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** Call at the top of a test file; `view.host` is the container, `view.render(el)` renders into it. */
export function useView() {
  const view = { host: null, root: null, render: el => act(() => view.root.render(el)) }
  beforeEach(() => {
    view.host = document.createElement('div')
    document.body.appendChild(view.host)
    view.root = createRoot(view.host)
  })
  afterEach(() => {
    act(() => view.root.unmount())
    view.host.remove()
  })
  return view
}

export const type = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

export const click = el => act(() => { el.click() })
