import { useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { PRESETS, play } from '../lib/motion.js'
import UndoToast from '../ds/UndoToast.jsx'
import { Presence, leavingProps, useEnterExit, usePresence } from './presence.jsx'
import { useSwipeDismiss } from './use-swipe-dismiss.js'

// The one toast, drawn as the design system's UndoToast. Mostly text; with an action (the Undo
// after a set is removed) it carries a glyph, a button at its end and a draining bar, stays longer
// and holds still, bar and all, while a finger or the mouse rests on it.
//
// #toast is the live region and is always in the page; the toast inside it comes and goes through
// the kit, and keeps the message it was showing until its way out is over. (The store clears the
// message on the render that hides the toast, and it used to fade out empty and shrinking.)
export default function Toast() {
  const msg = useUI(s => s.toastMsg)
  const action = useUI(s => s.toastAction)
  const paused = useUI(s => s.toastPaused)
  return <div id="toast" className="g-root" role="status">
    <Presence>{msg ? <ToastPill key="toast" msg={msg} action={action} paused={paused} /> : null}</Presence>
  </div>
}

function ToastPill({ msg, action, paused }) {
  const ref = useRef(null)
  const { present } = usePresence()
  const { pauseToast, resumeToast, runToastAction, dismissToast } = useUI.getState()
  useEnterExit(() => [[ref.current, PRESETS.toast]])
  // The last thing focused outside the pill while it is up, for the focus to go back to when its
  // action is run from the keyboard: the pill goes out of reach at once, and the focus with it.
  const before = useRef(null)
  useLayoutEffect(() => {
    const note = el => { if (el && el !== document.body && !ref.current?.contains(el)) before.current = el }
    note(document.activeElement)
    const onFocus = e => note(e.target)
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])
  // (An action that put the focus somewhere itself is left to it.) A tap or a click is not the
  // keyboard: a finger focuses the button too (Android), and sending the focus back to the field
  // typed in before would open its soft keyboard again. Only a click with no pointer behind it
  // (`detail` 0: Enter, Space, a screen reader) takes the focus back; a pointer's just lets go.
  const run = e => {
    runToastAction()
    if (!ref.current?.contains(document.activeElement)) return
    const back = before.current
    if (e.detail === 0 && back?.isConnected && !back.closest('[inert]')) back.focus?.({ preventScroll: true })
    else document.activeElement.blur?.()
  }
  // A new message over one still showing: the pill stays where it is and takes the new text with
  // a small nudge, rather than leaving and coming back. One that arrives while the pill is leaving
  // brings it back with its full way in instead, and a nudge on top would fight that.
  const said = useRef(msg)
  const shown = useRef(present)
  useLayoutEffect(() => {
    const showing = shown.current
    shown.current = present
    if (said.current === msg) return
    said.current = msg
    if (present && showing) play(ref.current, PRESETS.nudge, 'enter')
  }, [msg, present])
  const live = !!(present && action)
  // Swiped, tapped or Escaped away: the toast the person was looking at goes, and not a newer one
  // that replaced it meanwhile. The timer's end and this one share the store's single ending, so
  // whichever comes second finds nothing to end.
  const seen = useRef(null)
  const gesture = useSwipeDismiss({ ref, onDismiss: () => dismissToast(seen.current ?? undefined), enabled: present })
  // The slide a swipe left on the element is not wanted when the same toast comes back.
  useLayoutEffect(() => { if (present && ref.current) ref.current.style.transform = '' }, [present])
  // The finger on an Undo toast holds its timer; letting go, other than by a mouse still over it, lets it run.
  const down = e => { seen.current = useUI.getState().toastId; if (live) pauseToast(); gesture.onPointerDown?.(e) }
  const up = e => { if (live && e.pointerType !== 'mouse') resumeToast(); gesture.onPointerUp?.(e) }
  const cancel = e => { if (live) resumeToast(); gesture.onPointerCancel?.(e) }
  return <UndoToast ref={ref} role={null} dismissLabel={t('Dismiss')} {...leavingProps(present)}
    message={msg} body={action?.body} icon={action?.icon ?? null}
    onUndo={action ? run : false} actionLabel={action?.label} duration={action ? action.ms / 1000 : false}
    paused={paused} restartKey={action?.id}
    onPointerEnter={live ? pauseToast : undefined} onPointerLeave={live ? resumeToast : undefined}
    onPointerDown={present ? down : undefined} onPointerUp={present ? up : undefined} onPointerCancel={present ? cancel : undefined}
    onPointerMove={gesture.onPointerMove} onClick={gesture.onClick} onKeyDown={e => { seen.current = null; gesture.onKeyDown?.(e) }} />
}
