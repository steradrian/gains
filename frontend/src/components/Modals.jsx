import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { keyboardOpen } from '../lib/viewport-guard.js'
import { PRESETS } from '../lib/motion.js'
import { noteSheetEntries, onSheetEntry } from '../lib/nav.js'
import { backSheet, dismissSheet as dismissDrawer, sheetEntryCount } from '../lib/sheet-nav.js'
import { useSheetDialog } from '../lib/use-sheet-dialog.js'
import { EmptySurface } from './blocks.jsx'
import { Presence, leavingProps, useEnterExit, usePresence } from './presence.jsx'
import { SheetFrameContext } from './sheet-frame.js'
import SheetPanes from './sheet-panes.jsx'

// Putting the page back after a sheet closes takes up to three goes (see the un-pin below): now,
// next frame, and once the keyboard's dismiss animation is over. Anything else that wants to
// scroll in that same commit is overwritten. Rating a set closes the effort picker AND ticks the
// set in one tap, and the superset card's "bring the partner's row into view" was undone about
// 3 ms after it was asked for, every time. afterScrollRestore runs fn once the sequence is done,
// or straight away when none is running, and returns a canceller for the caller's effect cleanup.
//
// It does not get a timer of its own. Two ~350 ms timers armed a few milliseconds apart run in
// whichever order the browser likes, and on a phone the re-assert can come second and undo the
// scroll. So the last re-assert runs these itself, in its own timer callback, right after its own
// scrollTo: there is no ordering left to get wrong.
const RESTORE_MS = 350
let restoreUntil = 0
// Real closes, counted, so the last re-assert can tell whether it belongs to the latest one. That,
// not the clock, ends the sequence: with Date.now() coarsened or jittered (privacy.resistFingerprinting
// rounds it to 100 ms) a deadline read in that callback can still look a few ms away, and a waiter
// would then sit in the queue with nothing left to run it.
let closes = 0
let waiting = []
export function afterScrollRestore(fn) {
  if (!(restoreUntil - Date.now() > 0)) { fn(); return () => {} }
  waiting.push(fn)
  return () => { waiting = waiting.filter(x => x !== fn) }
}
// Whether that sequence is still running, for a scroll that would rather not happen at all than
// come after it: a page that scrolls on purpose when the sheet closes skips the scroll the restore
// would undo on the spot.
export const scrollRestorePending = () => restoreUntil - Date.now() > 0
// Called by the last re-assert of close number `close`, once it has had its say. Two reasons to
// leave the queue alone and let a later re-assert take it: a second sheet closed inside this window
// (its own last re-assert drains it), or the page is pinned again behind a newly opened sheet,
// where a scroll would be meaningless; that sheet's own un-pin comes with a fresh sequence.
const drainScrollRestore = close => {
  if (!close || close !== closes || document.body.style.position === 'fixed') return
  restoreUntil = 0
  const queue = waiting
  waiting = []
  for (const fn of queue) {
    try { fn() } catch (e) { /* one caller must not keep the others waiting */ }
  }
}

// Every way out of a sheet that is not one of its own buttons (the backdrop, a drag, Escape,
// Android back) behaves like the sheet's Cancel: a sheet that has something to undo when it is not
// gone through (confirmSheet's onCancel) says so as `onDismiss`, and it runs whichever way the
// sheet was sent off. A locked sheet stays. Looked up by id, so a handler bound on the first render
// still sees a sheet locked since. lib/sheet-nav.js has the two sizes of it: the backdrop and a
// drag send the whole drawer off, back (Escape, the browser's, Android's, the chevron) takes one
// sub-panel off, or the drawer when it has none.
const dismissSheet = id => dismissDrawer(useUI.getState(), id)
const backStep = id => backSheet(useUI.getState(), id)

// Which sheets are swapping in this commit: a tap that closes one sheet and opens the next
// (`close(); nextSheet()`) reaches the store as one batch with both a removal and an addition.
// The one going fades where it stands with its scrim gone at once, and the one coming rises over
// a scrim already there, so the backdrop never flashes (spec §2.1, Replacement).
const NO_SWAP = { out: new Set(), in: new Set() }
const SwapContext = createContext(NO_SWAP)

// One bottom sheet (or centered dialog) with swipe-to-dismiss.
function Sheet({ sheet, covered }) {
  const { closeSheet } = useUI()
  const ref = useRef(null)
  const backdrop = useRef(null)
  const swap = useContext(SwapContext)
  const { present } = usePresence()
  // The element that is the dialog, whichever kind of sheet this is: named by its header, focus
  // moved in and kept there, the page behind inert, focus back on what opened it. Escape closing
  // the top sheet that allows it is the one handler in Modals below. Focus goes back the moment the
  // sheet is closed, not when its way out has finished playing.
  const dialog = useRef(null)
  useSheetDialog(dialog, present)
  // A bottom sheet rises with its scrim and goes back down with it. The centred dialog keeps its
  // CSS entrance for now and, like the viewer, goes at once.
  useEnterExit(phase => {
    if (sheet.kind !== 'sheet') return []
    if (phase === 'enter') return swap.in.has(sheet.id) ? [[ref.current, PRESETS.sheet]] : [[backdrop.current, PRESETS.backdrop], [ref.current, PRESETS.sheet]]
    if (swap.out.has(sheet.id)) {
      if (backdrop.current) backdrop.current.hidden = true
      return [[ref.current, PRESETS.sheetSwap]]
    }
    return [[backdrop.current, PRESETS.backdrop], [ref.current, PRESETS.sheet]]
  })
  // startY null = no gesture. axis stays null until the finger has travelled far enough to
  // tell a vertical pull from a sideways scroll; 'x' hands the gesture to whatever scrolls
  // horizontally under it (chip strips, heatmap) and the sheet stays put.
  const idle = () => ({ startX: null, startY: null, axis: null, delta: 0, vy: 0, lastY: 0, lastT: 0 })
  const drag = useRef(idle())
  // While this drawer is up (a dialog over it included), the page's own background is its colour. An
  // installed iOS app can lose the bottom of its layout viewport (the status bar's height, 59px on
  // a 15 Pro Max) once a keyboard has been up: every fixed box, #modal-root included, then ends
  // that far above the screen's edge, and WebKit fills the strip below with the page's background.
  // No box can draw there, not even the scrim, so the strip takes the drawer's colour instead and
  // the drawer reads as reaching the edge (lib/sheet-keyboard.js --vp-short, index.css).
  useLayoutEffect(() => {
    const el = ref.current
    if (sheet.kind !== 'sheet' || !present || !el) return
    const colour = el.ownerDocument?.defaultView?.getComputedStyle?.(el).backgroundColor
    const root = el.ownerDocument?.documentElement
    if (!colour || !root) return
    root.style.setProperty('--under-sheet', colour)
    root.setAttribute('data-sheet-up', '')
    return () => {
      root.removeAttribute('data-sheet-up')
      root.style.removeProperty('--under-sheet')
    }
  }, [present])
  // What scrolls: the active pane of the sheet (an older sheet's content scrolls as a whole) or a
  // design-system drawer's body (ds/BottomSheet.jsx), whose head and foot stay put. A pull only
  // takes the sheet down while that is at its top.
  const body = useRef(null)
  const scrolled = () => {
    const pane = ref.current?.querySelector?.('.g-bs-pane[data-pos="active"]')
    const scroller = pane?.querySelector?.('.g-bs-body') || pane || body.current || ref.current
    return scroller.scrollTop > 0
  }

  // a gesture that begins on a slider (or opted-out control) belongs to that control, not to
  // the sheet's swipe-to-dismiss — so it keeps working while you drag. Horizontal strips are
  // opted out too: a sideways scroll must never wobble or pull down the sheet.
  const NODRAG = 'input[type=range], [data-nodrag], .chips'
  const begin = (target, x, y) => {
    if (target.closest && target.closest(NODRAG)) { drag.current = idle(); return }
    if (scrolled()) { drag.current = idle(); return }
    drag.current = { ...idle(), startX: x, startY: y, lastY: y, lastT: performance.now() }
  }
  const move = (e, x, y) => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    // synthetic events (tests) may carry no x at all: treat that as straight down
    const dx = Number.isFinite(x) ? x - d.startX : 0, dy = y - d.startY
    if (d.axis === null) {
      // axis lock after ~8px: clearly-more-vertical wins the sheet, anything else is a scroll
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      d.axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'x'
      if (d.axis === 'x') return
    }
    if (d.axis === 'x') return
    const now = performance.now()
    // velocity from the last move, so a fast short flick can still be told from a slow drag
    if (now > d.lastT) { d.vy = (y - d.lastY) / (now - d.lastT); d.lastY = y; d.lastT = now }
    if (dy > 0 && !scrolled()) {
      e.preventDefault()
      d.delta = dy
      el.style.transition = 'none'
      el.style.transform = `translateY(${dy}px)`
    } else if (d.delta > 0) {
      // the pull reversed above the start: snap back before the sheet is allowed to scroll,
      // otherwise it scrolls while still hanging below its resting place
      e.preventDefault()
      d.delta = 0
      el.style.transform = 'translateY(0px)'
    }
  }
  const onTouchStart = e => begin(e.target, e.touches[0].clientX, e.touches[0].clientY)
  const onTouchMove = e => move(e, e.touches[0].clientX, e.touches[0].clientY)
  const onTouchEnd = () => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    // a long pull, or a short but fast flick, dismisses: closed at once, and the way out carries
    // on down from where the finger let go
    const flick = d.delta > 30 && d.vy > 0.6
    if ((d.delta > 90 || flick) && !sheet.locked) { el.style.transition = 'none'; dismissSheet(sheet.id) }
    else { el.style.transition = 'transform .2s'; el.style.transform = '' }
    drag.current = idle()
  }
  // Mouse drag (desktop testing / trackpads): same swipe-to-dismiss behaviour.
  const onMouseDown = e => { if (e.button === 0) begin(e.target, e.clientX, e.clientY) }
  const onMouseMove = e => move(e, e.clientX, e.clientY)
  const onMouseUp = () => onTouchEnd()

  // non-passive touchmove so preventDefault works (bottom sheets only; centered dialogs have no ref)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // `close` is what the sheet's render is handed. A drawer's sub-panel is handed its own, which takes
  // that panel out alone; `.drawer` on either takes the whole drawer (lib/nav.js closeThenNav).
  const close = () => closeSheet(sheet.id)
  close.drawer = close
  const dismiss = () => { dismissSheet(sheet.id) }
  const back = () => { backStep(sheet.id) }
  const panes = {
    panels: sheet.panels || [],
    // A step of a flow the drawer launched (store/useUI.js drawerFlow) ends the flow when it closes.
    closeOf: panel => { if (panel.flow) return close; const own = () => closeSheet(panel.id); own.drawer = close; return own },
    back, dismiss, hostLocked: !!sheet.locked,
  }
  // One function for the life of the sheet: a new one each render would detach and reattach it.
  const setPanel = useRef(el => { ref.current = el; dialog.current = el }).current
  // A sheet under a newer one is out of reach, to the keyboard and to a screen reader, until the
  // newer one closes: `inert` on its wrapper (a stacked sheet's background is the sheet below). So
  // is one on its way out, which taps also go through to the page.
  const layer = { ...leavingProps(present), inert: covered || !present ? true : undefined }
  // Full screen, on black: a photo or video opened from a workout (WorkoutMedia.jsx). No
  // backdrop to tap, no drag to dismiss — the viewer has its own close button, and back closes
  // it like any sheet.
  if (sheet.kind === 'viewer') return <div ref={dialog} {...layer}>{sheet.render(close)}</div>
  if (sheet.kind === 'center') {
    return (
      <div {...layer}>
        <div className="mback" aria-hidden="true" onClick={dismiss} />
        <div className="center" ref={dialog}><EmptySurface value="sheet">{sheet.render(close)}</EmptySurface></div>
      </div>
    )
  }
  const panelProps = { onTouchStart, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp }
  // The design system's drawer draws its own scrim and panel (ds/BottomSheet.jsx), on these refs
  // and handlers: everything above applies to it as to any sheet.
  if (sheet.variant === 'ds') {
    const frame = { scrim: backdrop, panel: setPanel, body, panelProps, dismiss, locked: sheet.locked, panes }
    return (
      <div {...layer}>
        <SheetFrameContext.Provider value={frame}>
          <EmptySurface value="sheet">{sheet.render(close)}</EmptySurface>
        </SheetFrameContext.Provider>
      </div>
    )
  }
  // The grab bar says the sheet can be pulled away; a locked one cannot, so it has none.
  return (
    <div {...layer}>
      <div className="mback" ref={backdrop} aria-hidden="true" onClick={dismiss} />
      <div className="sheet" ref={setPanel} {...panelProps}>
        {!sheet.locked && <div className="grab" />}
        <EmptySurface value="sheet">
          <SheetPanes kind="legacy" {...panes}>{sheet.render(close)}</SheetPanes>
        </EmptySurface>
      </div>
    </div>
  )
}

export default function Modals() {
  const sheets = useUI(s => s.sheets)
  // History entries the open sheets hold: one for a drawer and one for each of its sub-panels, so
  // the hardware Back takes a panel off before it takes the drawer.
  const entries = sheetEntryCount(sheets)
  const prevLen = useRef(0)
  const suppressPop = useRef(false)
  const pushedEntries = useRef(0)
  const sheetEntries = useRef([])

  // Every opened sheet gets a history entry so Android back dismisses it instead of
  // leaving the page (issue #63). Keep the pushed-entry count and each active sheet's
  // live-entry status explicit: sheet count cannot tell whether popstate already spent
  // an entry (especially for a locked sheet) or whether several sheets opened at once.
  useEffect(() => {
    const prev = prevLen.current
    prevLen.current = entries
    if (entries > prev) {
      for (let i = prev; i < entries; i++) {
        sheetEntries.current.push({ openedAt: location.href, live: true })
        // The page's own router state rides along (its key: the entry is the same page with a
        // sheet over it), with the position this entry really has, one past the page's. A page
        // the router pushes or replaces from here (closeThenNav) counts on from it, so the
        // router's `idx` stays the true distance to the first entry (lib/tab-history.js).
        const state = history.state || {}
        const at = Number.isInteger(state.idx) ? state.idx + 1 : 1
        history.pushState({ ...state, idx: at, gainsSheet: true }, '')
        pushedEntries.current++
      }
    } else if (entries < prev) {
      const closedEntries = sheetEntries.current.splice(entries, prev - entries)
      const rewind = closedEntries.filter(entry =>
        entry.live && !(typeof entry.openedAt === 'string' && location.href !== entry.openedAt)).length
      if (rewind > 0) {
        pushedEntries.current = Math.max(0, pushedEntries.current - rewind)
        suppressPop.current = true
        history.go(-rewind)
      }
      // Entries skipped because the app moved on remain in pushedEntries as deliberate
      // leaks until a later popstate consumes them with no corresponding active sheet.
    }
    noteSheetEntries(sheetEntries.current.filter(e => e.live).length)
  }, [entries])

  // A page loaded on a sheet's entry with no sheet open (a reload, a restored tab): nothing will
  // ever walk that entry off, and back from it would land on the same page. Step off it once.
  const staleChecked = useRef(false)
  useEffect(() => {
    if (staleChecked.current) return
    staleChecked.current = true
    if (onSheetEntry() && !useUI.getState().sheets.length) history.back()
  }, [])

  useEffect(() => {
    const onPop = () => {
      if (suppressPop.current) { suppressPop.current = false; return }
      if (pushedEntries.current <= 0) return
      pushedEntries.current--
      // The browser has already spent one pushed entry. Mark the latest live active
      // sheet entry spent even when the sheet is locked; with no active entry this is a
      // moved-on leak, which is still accounted for by the counter decrement above.
      for (let i = sheetEntries.current.length - 1; i >= 0; i--) {
        if (sheetEntries.current[i].live) {
          sheetEntries.current[i].live = false
          break
        }
      }
      noteSheetEntries(sheetEntries.current.filter(e => e.live).length)
      const top = sheets[sheets.length - 1]
      if (top) backStep(top.id)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [sheets])

  // lock the page behind any open sheet (iOS-safe)
  useEffect(() => {
    if (!sheets.length) return
    const onKey = e => { if (e.key === 'Escape') { const top = useUI.getState().sheets.at(-1); if (top) backStep(top.id) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheets.length])
  // A layout effect, not a passive one: the pin and, above all, the un-pin plus the scroll
  // restore have to land in the same frame as the sheet's own mount/unmount. Run after paint,
  // iOS showed a frame with the body un-pinned at scroll 0 — the page "jumped down and back" on
  // every RIR pick, which closes the sheet and starts a rest in one tap (2026-09-18).
  useLayoutEffect(() => {
    if (!sheets.length) return
    // A text field on the page behind (a set's weight, the Library search) keeps focus when a
    // button opens a sheet — WebKit does not blur on button taps — and its keyboard then
    // stays up under the sheet, or leaves the viewport displaced when it finally goes. The
    // sheet owns the screen now; a field inside the sheet (the picker search) is left alone.
    const a = document.activeElement
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable) && !a.closest?.('#modal-root')) a.blur?.()
    const y = window.scrollY || 0
    const b = document.body.style
    b.position = 'fixed'; b.top = -y + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'
    return () => {
      // A workout layout change can move the anchor while this sheet is open.
      const restoreY = -(parseFloat(b.top) || 0)
      b.position = b.top = b.left = b.right = b.width = ''
      // Tell anything that scrolls for its own reasons how long this will go on (afterScrollRestore),
      // but only when a sheet really did close. React StrictMode runs this cleanup immediately after
      // the effect when Modals mounts with a sheet already up, and arming the window there would make
      // anything waiting on the restore wait RESTORE_MS for a page nobody is putting back: late in
      // dev, on time in production. In production this cleanup runs on the close path alone.
      const close = useUI.getState().sheets.length ? 0 : ++closes
      if (close) restoreUntil = Date.now() + RESTORE_MS
      window.scrollTo(0, restoreY)
      // iOS scrolls asynchronously; a restore issued in the same task as the un-pin can be applied
      // a frame late or against the still-short layout. Say it once more on the next frame.
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => { if (document.body.style.position !== 'fixed') window.scrollTo(0, restoreY) })
      // If the sheet closed with the keyboard still up (tap "+" in the picker, then finish),
      // iOS scrolls the page again while the keyboard dismisses — after the line above ran.
      // Ask once more when that animation is over. The window-level guard in
      // lib/viewport-guard.js covers the keyboard closing while a sheet stays open.
      // This last one also hands the page over to anything that has been waiting for the sequence
      // to finish (afterScrollRestore), in this same callback, right after its own scrollTo, so a
      // scroll of someone else's cannot be undone by a re-assert still to come.
      //
      // The re-assert itself is for the keyboard case only: without one there is nothing to undo,
      // and a late restore would overwrite a scroll the page behind made on purpose because the
      // sheet closed — the workout list going to the current exercise after ⋯ → Layout → List
      // (issue #224). At this point the sheet's field is already out of the DOM but the keyboard
      // has not started to go, so the visual viewport still tells the truth. The timer is armed
      // either way, because the hand-over is the only thing that drains the queue.
      const hadKeyboard = keyboardOpen()
      window.setTimeout(() => {
        if (hadKeyboard && document.body.style.position !== 'fixed') window.scrollTo(0, restoreY)
        drainScrollRestore(close)
      }, RESTORE_MS)
    }
  }, [sheets.length > 0])

  // The store says which sheets are open; a sheet it has let go of stays on screen for its way
  // out. #modal-root is up while anything is drawn, and `live` only while a sheet is open: a sheet
  // still leaving lets the page under it take taps again.
  const [drawn, setDrawn] = useState(false)
  if (sheets.length && !drawn) setDrawn(true)
  const shownIds = useRef([])
  const swap = useMemo(() => {
    const was = shownIds.current
    const gone = was.filter(id => !sheets.some(s => s.id === id))
    const added = sheets.filter(s => !was.includes(s.id)).map(s => s.id)
    return gone.length && added.length ? { out: new Set(gone), in: new Set(added) } : NO_SWAP
  }, [sheets])
  useLayoutEffect(() => { shownIds.current = sheets.map(s => s.id) }, [sheets])

  if (!sheets.length && !drawn) return null
  return (
    <div id="modal-root" className={sheets.length ? 'open live' : 'open'}>
      <SwapContext.Provider value={swap}>
        <Presence onExitComplete={() => { if (!useUI.getState().sheets.length) setDrawn(false) }}>
          {sheets.map((s, i) => <Sheet key={s.id} sheet={s} covered={i < sheets.length - 1} />)}
        </Presence>
      </SwapContext.Provider>
    </div>
  )
}
