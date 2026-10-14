// The shell's side of lib/mode-history.js: mirrors every location into the per-mode stacks and
// carries out a mode switch. A switch is several router steps — walk back to the first entry,
// replace it, push the rest of the arriving mode's stack — taken one per location change, with
// the screen held on the page the switch started from (`shown`) until the last step has landed,
// so none of the pages in between mounts or paints.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { deadSteps, emptyNav, planSwitch, record, settle } from './mode-history.js'
import { modeOf } from './mode-route.js'
import { onSheetEntry } from './nav.js'

const NAV_KEY = 'gym_mode_nav'    // this tab's mirror: survives a reload, as its history does
const LAST_KEY = 'gym_last_mode'  // this device's last mode, for the next launch
// A walk back that never lands (history.go past the start does nothing, and says nothing) must
// not hold the screen: after this long the switch carries on from wherever history is.
const UNWIND_MS = 400

export function lastMode() {
  try { return localStorage.getItem(LAST_KEY) } catch { return null }
}

function loadNav() {
  try {
    const v = JSON.parse(sessionStorage.getItem(NAV_KEY))
    return v && Array.isArray(v.entries) && typeof v.idx === 'number' && typeof v.top === 'number' ? v : emptyNav(lastMode())
  } catch { return emptyNav(lastMode()) }
}

function saveNav(nav) {
  try { sessionStorage.setItem(NAV_KEY, JSON.stringify(nav)) } catch { /* private mode: in memory only */ }
}

// The router's position in the history (react-router writes it into history.state).
const historyIdx = () => globalThis.history?.state?.idx

// For code outside the shell (the + sheet's Start/Resume row), like lib/nav.js's nav(). Called
// as a sheet closes, it waits for the sheet's history entry to be walked off first (Modals.jsx):
// two walks queued in the same moment are not reliably both carried out.
let _switch = () => {}
let _switching = false
export function switchMode(target, path) {
  if (onSheetEntry()) window.addEventListener('popstate', () => _switch(target, path), { once: true })
  else _switch(target, path)
}
// While a switch rebuilds the history, nothing else may walk it (Android back, a tab tap).
export const isSwitching = () => _switching

export const MODE_SWITCH = { modeSwitch: true }

export function useModeNav({ navigate, location, navType }) {
  const navRef = useRef(null)
  if (!navRef.current) navRef.current = loadNav()
  const pending = useRef(null)
  const [frozen, setFrozen] = useState(null)

  const build = useCallback(stack => {
    clearTimeout(pending.current?.timer)
    pending.current = { phase: 'build', queue: stack.slice(1) }
    navigate(stack[0], { replace: true, state: MODE_SWITCH })
  }, [navigate])

  useLayoutEffect(() => {
    const p = pending.current
    let next = record(navRef.current, { idx: historyIdx(), path: location.pathname + location.search, navType })
    // Walking back (unwind, below) is driven by popstate, not by these location changes.
    if (p?.phase === 'unwind') { navRef.current = next; return }
    if (p?.phase === 'build') {
      if (p.queue.length) { navRef.current = next; navigate(p.queue.shift(), { state: MODE_SWITCH }); return }
      next = settle(next)
      pending.current = null
      _switching = false
      setFrozen(null)
    }
    navRef.current = next
    saveNav(next)
    const m = modeOf(location.pathname)
    if (m) { try { localStorage.setItem(LAST_KEY, m) } catch { /* nothing to remember it in */ } }
    // Forward onto a page of the mode that was left: step straight back off it.
    const dead = deadSteps(next)
    if (!p && dead) navigate(-dead)
    // The location object, not its key: a sheet's entry carries the key of the page under it, so
    // stepping from one onto the other is a location change with the same key.
  }, [location])

  const doSwitch = useCallback((target, path) => {
    if (pending.current) return
    const plan = planSwitch(navRef.current, target, path)
    if (!plan) { if (path) navigate(path); return }
    setFrozen({ location, mode: navRef.current.mode })
    _switching = true
    navRef.current = plan.nav
    saveNav(plan.nav)
    // Walk back to the first entry, one popstate at a time: the position the router reports
    // where it lands says how far is left. A sheet's entry left under a page (Modals.jsx) can
    // make a walk land short, and stepping off one onto its page is not even a location change.
    const step = () => {
      if (pending.current?.phase !== 'unwind') return
      const idx = historyIdx()
      const by = idx > 0 ? idx : onSheetEntry() ? 1 : 0
      if (!by) { build(plan.stack); return }
      window.addEventListener('popstate', step, { once: true })
      navigate(-by)
    }
    if (plan.back > 0 || onSheetEntry()) {
      const timer = setTimeout(() => {
        if (pending.current?.phase !== 'unwind') return
        window.removeEventListener('popstate', step)
        build(plan.stack)
      }, UNWIND_MS)
      pending.current = { phase: 'unwind', timer }
      step()
    } else {
      build(plan.stack)
    }
  }, [navigate, location, build])
  useLayoutEffect(() => {
    _switch = doSwitch
    return () => { if (_switch === doSwitch) _switch = () => {} }
  }, [doSwitch])
  useLayoutEffect(() => () => { _switching = false; clearTimeout(pending.current?.timer) }, [])

  if (frozen) return { mode: frozen.mode, shown: frozen.location, switching: true, switchMode: doSwitch }
  return { mode: modeOf(location.pathname) || navRef.current.mode, shown: location, switching: false, switchMode: doSwitch }
}
