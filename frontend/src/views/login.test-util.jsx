// What the sign-in screen's tests share: mounting (several roots at once: the page and the sheets
// it opens), and reading buttons by their text. The mocks themselves stay in each test file, where
// vi.mock is hoisted.
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted = []
export function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
export const cleanup = () => act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) })
export const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
export const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent).filter(Boolean)
export const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
export const click = async (host, text) => { act(() => button(host, text).click()); await settle() }
export const alertText = host => host.querySelector('[role="alert"]')?.textContent || null
