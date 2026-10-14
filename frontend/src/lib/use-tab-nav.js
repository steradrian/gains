// The shell's side of lib/tab-history.js: mirrors every location into the per-tab stacks and
// carries out a tab switch. A switch is several router steps — walk back to the first entry,
// replace it, push the rest of the arriving tab's stack — with the screen held on one page
// (`shown`) until the last step has landed, so none of the pages in between mounts or paints.
//
// What starts a switch: a bar button (switchTab, popToRoot for the tab on screen), and any
// navigation that lands in another tab's pages, from whatever code made it (a Profile row opening
// Routines, "Nice!" going Home): the push is turned into a switch, so a tab's stack never holds
// another tab's page.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { emptyNav, deadSteps, planSwitch, record, settle } from './tab-history.js'
import { parentOf, tabOf } from './tab-route.js'

const NAV_KEY = 'gym_tab_nav'   // this tab's mirror: survives a reload, as its history does
// A walk back that never lands (history.go past the start does nothing, and says nothing) must not
// hold the screen: after this long the switch carries on from wherever history is. A pop that
// still arrives later is a walk mid-build, and restarts the switch from where it lands.
const UNWIND_MS = 400
// A switch knocked off course by somebody else's walk (an iOS swipe, the browser's back) is
// planned again from where it landed — this many times, then the screen is let go as it is.
const RETRIES = 2

function loadNav() {
  try {
    const v = JSON.parse(sessionStorage.getItem(NAV_KEY))
    return v && Array.isArray(v.entries) && typeof v.idx === 'number' && typeof v.top === 'number' ? v : emptyNav()
  } catch { return emptyNav() }
}

function saveNav(nav) {
  try { sessionStorage.setItem(NAV_KEY, JSON.stringify(nav)) } catch { /* private mode: in memory only */ }
}

// The router's position in the history (react-router writes it into history.state).
const historyIdx = () => globalThis.history?.state?.idx
const onSheetEntry = () => { try { return !!globalThis.history?.state?.openGymSheet } catch { return false } }

export const TAB_SWITCH = { tabSwitch: true }

// For code outside the shell (the bar, the + sheet, a page's back button), like lib/nav.js's nav().
let api = { switchTab: () => {}, popToRoot: () => {}, back: () => {} }
let switching = false
// While a switch rebuilds the history, nothing else may walk it: the bar, the +, Android back.
export const isSwitching = () => switching

// Called as a sheet closes, it waits for the sheet's history entry to be walked off first
// (Modals.jsx): two walks queued in the same moment are not reliably both carried out.
const afterSheet = fn => {
  if (onSheetEntry()) window.addEventListener('popstate', fn, { once: true })
  else fn()
}
export const switchTab = (tab, path) => afterSheet(() => api.switchTab(tab, path))
export const popToRoot = tab => afterSheet(() => api.popToRoot(tab))
// A sub-page's back: one step down this tab's stack, or with nothing under it in the tab (a deep
// link, a reload) to the page's parent in its place.
export const back = () => { if (!switching) api.back() }

export function useTabNav({ navigate, location, navType }) {
  const navRef = useRef(null)
  if (!navRef.current) navRef.current = loadNav()
  const pending = useRef(null)
  const [frozen, setFrozen] = useState(null)

  const finish = useCallback(() => {
    clearTimeout(pending.current?.timer)
    pending.current = null
    switching = false
    setFrozen(null)
  }, [])

  const build = useCallback(p => {
    clearTimeout(p.timer)
    pending.current = { ...p, phase: 'build', queue: p.stack.slice(1) }
    navigate(p.stack[0], { replace: true, state: TAB_SWITCH })
  }, [navigate])

  // Walk back to the first entry one popstate at a time: the position the router reports where it
  // lands says how far is left. Stepping from a sheet's entry onto its page is not a location
  // change at all, so the walk listens to popstate itself rather than to locations.
  const unwind = useCallback(p => {
    const step = () => {
      if (pending.current !== p) return
      const idx = historyIdx()
      if (!(idx > 0)) { build(p); return }
      window.addEventListener('popstate', step, { once: true })
      navigate(-idx)
    }
    p.timer = setTimeout(() => {
      if (pending.current !== p) return
      window.removeEventListener('popstate', step)
      build(p)
    }, UNWIND_MS)
    step()
  }, [navigate, build])

  const run = useCallback((plan, { shownLocation, shownTab, target, path, retries = 0 }) => {
    if (!plan) { finish(); return }
    if (!switching) setFrozen({ location: shownLocation, tab: shownTab })
    switching = true
    navRef.current = plan.nav
    saveNav(plan.nav)
    const p = { phase: 'unwind', stack: plan.stack, target, path, retries }
    pending.current = p
    if (plan.back > 0) unwind(p)
    else build(p)
  }, [build, unwind, finish])

  useLayoutEffect(() => {
    const p = pending.current
    const path = location.pathname + location.search
    const idx = historyIdx()
    if (p?.phase === 'unwind') {
      if (navType === 'POP') navRef.current = record(navRef.current, { idx, path, navType })
      return
    }
    if (p?.phase === 'build') {
      if (navType === 'POP') {
        // Somebody walked the history mid-build: plan the same switch again from where it landed.
        navRef.current = record(navRef.current, { idx, path, navType })
        if (p.retries >= RETRIES) { navRef.current = settle(navRef.current); saveNav(navRef.current); finish(); return }
        const again = p.target === navRef.current.tab ? null : planSwitch(navRef.current, p.target, { path: p.path })
        if (!again) { navRef.current = settle(navRef.current); saveNav(navRef.current); finish(); return }
        run(again, { target: p.target, path: p.path, retries: p.retries + 1 })
        return
      }
      navRef.current = record(navRef.current, { idx, path, navType })
      if (p.queue.length) { navigate(p.queue.shift(), { state: TAB_SWITCH }); return }
      navRef.current = settle(navRef.current)
      saveNav(navRef.current)
      finish()
      return
    }
    // A page of another tab, pushed or replaced in from wherever: a switch to that tab with the
    // page on top, the entry it landed on handed back to the tab it came from.
    const target = tabOf(location.pathname)
    const nav = navRef.current
    if (navType !== 'POP' && target && target !== nav.tab && nav.idx >= 0) {
      const here = Number.isInteger(idx) ? idx : nav.idx + 1
      const plan = planSwitch({ ...nav, idx: here }, target, { path, leaving: nav.entries.slice(0, here) })
      run(plan, { shownLocation: location, shownTab: target, target, path })
      return
    }
    const next = record(nav, { idx, path, navType })
    navRef.current = next
    saveNav(next)
    // Forward onto a page of a tab that was left: step straight back off it.
    const dead = deadSteps(next)
    if (dead) navigate(-dead)
    // The location object, not its key: a sheet's entry carries the key of the page under it.
  }, [location])

  const doSwitch = useCallback((target, path) => {
    if (pending.current) return
    const nav = navRef.current
    if (target === nav.tab) { if (path) navigate(path); return }
    run(planSwitch(nav, target, { path }), { shownLocation: location, shownTab: nav.tab, target, path })
  }, [navigate, location, run])

  const doPopToRoot = useCallback(target => {
    if (pending.current) return
    const plan = planSwitch(navRef.current, target, { toRoot: true })
    if (!plan) { window.scrollTo(0, 0); return }
    run(plan, { shownLocation: location, shownTab: target, target })
  }, [location, run])

  const doBack = useCallback(() => {
    if (pending.current) return
    if (navRef.current.idx > 0) navigate(-1)
    else navigate(parentOf(location.pathname), { replace: true })
  }, [navigate, location])

  useLayoutEffect(() => {
    api = { switchTab: doSwitch, popToRoot: doPopToRoot, back: doBack }
  }, [doSwitch, doPopToRoot, doBack])
  useLayoutEffect(() => () => { switching = false; clearTimeout(pending.current?.timer) }, [])

  if (frozen) return { tab: frozen.tab, shown: frozen.location, switching: true }
  return { tab: tabOf(location.pathname) || navRef.current.tab, shown: location, switching: false }
}
