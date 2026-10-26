// Test helpers for the exercise picker's Filters sub-panel. The panel is a sheet-stack entry under
// the picker's own (store/useUI.js openSheet), so a test that renders the picker with
// `sheet.render(...)` renders the panel by hand the same way: after tapping the Filters button.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useUI } from './store/useUI.js'

const roots = []

export const filtersButton = host => host.querySelector('.g-pk-filter')

/** Taps Filters in `host` (the picker) and returns the host the open panel is rendered into. */
export function openFilters(host) {
  act(() => filtersButton(host).click())
  const sheet = useUI.getState().sheets.at(-1)
  const panel = sheet.panels.at(-1)
  const panelHost = document.createElement('div')
  document.body.appendChild(panelHost)
  const root = createRoot(panelHost)
  roots.push(root)
  act(() => root.render(panel.render(() => useUI.getState().closeSheet(panel.id))))
  return panelHost
}

export const unmountPanels = () => act(() => { roots.splice(0).forEach(root => root.unmount()) })

/** A chip in a Filters panel (or any chip group) by its visible label. */
export const chipByText = (host, text) =>
  [...host.querySelectorAll('.g-cgroup .g-cchip')].find(b => b.textContent.trim() === text)
