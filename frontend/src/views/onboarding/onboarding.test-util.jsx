// What the onboarding's tests share: the flow mounted at a path in a memory router, the address
// on screen, and a way to start from saved answers. Not shipped (only *.test.jsx import it).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { isFlowPath } from '../../lib/onboarding/flow.js'
import Onboarding from './Onboarding.jsx'

// As the shell does (App.jsx): the flow only on its own paths; Home and the sign-in screen are
// somewhere else, and only the address says the flow went there.
function Where({ children }) {
  const { pathname } = useLocation()
  return <>
    {isFlowPath(pathname) && children}
    <output data-testid="where">{pathname}</output>
  </>
}

const mounted = []
export function mount(path, el = <Onboarding />) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Where>{el}</Where></MemoryRouter>))
  return host
}
export function unmountAll() {
  act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) })
}

export const where = host => host.querySelector('[data-testid="where"]').textContent
export const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
export const radio = (host, text) => [...host.querySelectorAll('[role="radio"]')].find(b => b.textContent.includes(text))
export const flush = () => act(async () => { await Promise.resolve() })

/** Saved answers for this tab, as a reload finds them (lib/onboarding/state.js). */
export function saved(patch) {
  const answers = {
    goal: null, body: { sex: null, birthYear: null, heightCm: null, weightKg: null },
    activity: { value: 'sitting', source: 'default' }, units: { weight: 'kg', height: 'cm', source: 'locale' }, plan: null,
    ...patch.answers,
  }
  sessionStorage.setItem('gains_onboarding', JSON.stringify({ ...patch, answers }))
}
