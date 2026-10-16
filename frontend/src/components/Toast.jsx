import { useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI.js'
import { PRESETS, play } from '../lib/motion.js'
import Icon from './Icon.jsx'
import { Presence, leavingProps, useEnterExit, usePresence } from './presence.jsx'

// The one toast. Mostly text; with an action (the Undo after a set is removed) it carries a button
// at its end, stays longer and holds still while a finger or the mouse rests on it.
//
// #toast is the live region and is always in the page; the pill inside it comes and goes through
// the kit, and keeps the message it was showing until its way out is over. (The store clears the
// message on the render that hides the toast, and the pill used to fade out empty and shrinking.)
export default function Toast() {
  const msg = useUI(s => s.toastMsg)
  const action = useUI(s => s.toastAction)
  return <div id="toast" role="status">
    <Presence>{msg ? <ToastPill key="toast" msg={msg} action={action} /> : null}</Presence>
  </div>
}

function ToastPill({ msg, action }) {
  const ref = useRef(null)
  const { present } = usePresence()
  const { pauseToast, resumeToast, runToastAction } = useUI.getState()
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
  // (An action that put the focus somewhere itself is left to it.)
  const run = () => {
    runToastAction()
    if (!ref.current?.contains(document.activeElement)) return
    const back = before.current
    if (back?.isConnected && !back.closest('[inert]')) back.focus?.({ preventScroll: true })
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
  return <div ref={ref} className={'toast-pill' + (action ? ' has-action' : '')} {...leavingProps(present)}
    onPointerEnter={live ? pauseToast : undefined} onPointerDown={live ? pauseToast : undefined}
    onPointerLeave={live ? resumeToast : undefined} onPointerCancel={live ? resumeToast : undefined}
    onPointerUp={live ? (e => { if (e.pointerType !== 'mouse') resumeToast() }) : undefined}>
    <span className="toast-msg">{msg}</span>
    {action && <button type="button" className="toast-act" key={action.id} onClick={run}>
      <Icon name={action.icon} />{action.label}
    </button>}
  </div>
}
