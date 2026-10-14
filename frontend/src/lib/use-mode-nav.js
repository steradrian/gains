// The shell's side of lib/mode-history.js: mirrors every location into the per-mode stacks and
// carries out a mode switch. A switch is several router steps — walk back to the first entry,
// replace it, push the rest of the arriving mode's stack — taken one per location change, with
// the screen held on the page the switch started from (`shown`) until the last step has landed,
// so none of the pages in between mounts or paints.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { emptyNav, planSwitch, record } from './mode-history.js'
import { modeOf } from './mode-route.js'
import { onSheetEntry } from './nav.js'

const NAV_KEY = 'gym_mode_nav'    // this tab's mirror: survives a reload, as its history does
const LAST_KEY = 'gym_last_mode'  // this device's last mode, for the next launch

export function lastMode() {
  try { return localStorage.getItem(LAST_KEY) } catch { return null }
}

function loadNav() {
  try {
    const v = JSON.parse(sessionStorage.getItem(NAV_KEY))
    return v && Array.isArray(v.entries) && typeof v.idx === 'number' ? v : emptyNav(lastMode())
  } catch { return emptyNav(lastMode()) }
}

function saveNav(nav) {
  try { sessionStorage.setItem(NAV_KEY, JSON.stringify(nav)) } catch { /* private mode: in memory only */ }
}

// For code outside the shell (the + sheet's Start/Resume row), like lib/nav.js's nav(). Called
// as a sheet closes, it waits for the sheet's history entry to be walked off first (Modals.jsx):
// two walks queued in the same moment are not reliably both carried out.
let _switch = () => {}
export function switchMode(target, path) {
  if (onSheetEntry()) window.addEventListener('popstate', () => _switch(target, path), { once: true })
  else _switch(target, path)
}

export const MODE_SWITCH = { modeSwitch: true }

export function useModeNav({ navigate, location, navType }) {
  const navRef = useRef(null)
  if (!navRef.current) navRef.current = loadNav()
  const pending = useRef(null)
  const [frozen, setFrozen] = useState(null)

  useLayoutEffect(() => {
    const next = record(navRef.current, { key: location.key, path: location.pathname + location.search, navType })
    navRef.current = next
    saveNav(next)
    const m = modeOf(location.pathname)
    if (m) { try { localStorage.setItem(LAST_KEY, m) } catch { /* nothing to remember it in */ } }

    const p = pending.current
    if (!p) return
    // The walk back has landed (on the first entry, or wherever a history we mirror wrongly let
    // it): that entry becomes the bottom of the arriving stack.
    if (p.phase === 'unwind') {
      if (navType !== 'POP') return
      pending.current = { phase: 'build', queue: p.stack.slice(1) }
      navigate(p.stack[0], { replace: true, state: MODE_SWITCH })
      return
    }
    if (p.queue.length) { navigate(p.queue.shift(), { state: MODE_SWITCH }); return }
    pending.current = null
    setFrozen(null)
  }, [location.key])

  const doSwitch = useCallback((target, path) => {
    if (pending.current) return
    const plan = planSwitch(navRef.current, target, path)
    if (!plan) { if (path) navigate(path); return }
    setFrozen({ location, mode: navRef.current.mode })
    navRef.current = plan.nav
    saveNav(plan.nav)
    if (plan.back > 0) {
      pending.current = { phase: 'unwind', stack: plan.stack }
      navigate(-plan.back)
    } else {
      pending.current = { phase: 'build', queue: plan.stack.slice(1) }
      navigate(plan.stack[0], { replace: true, state: MODE_SWITCH })
    }
  }, [navigate, location])
  useLayoutEffect(() => {
    _switch = doSwitch
    return () => { if (_switch === doSwitch) _switch = () => {} }
  }, [doSwitch])

  if (frozen) return { mode: frozen.mode, shown: frozen.location, switching: true, switchMode: doSwitch }
  return { mode: modeOf(location.pathname) || navRef.current.mode, shown: location, switching: false, switchMode: doSwitch }
}
