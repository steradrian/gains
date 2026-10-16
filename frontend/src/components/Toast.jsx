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
  // A new message over one still showing: the pill stays where it is and takes the new text with
  // a small nudge, rather than leaving and coming back.
  const said = useRef(msg)
  useLayoutEffect(() => {
    if (said.current === msg) return
    said.current = msg
    if (present) play(ref.current, PRESETS.nudge, 'enter')
  }, [msg])
  const live = !!(present && action)
  return <div ref={ref} className={'toast-pill' + (action ? ' has-action' : '')} {...leavingProps(present)}
    onPointerEnter={live ? pauseToast : undefined} onPointerDown={live ? pauseToast : undefined}
    onPointerLeave={live ? resumeToast : undefined} onPointerCancel={live ? resumeToast : undefined}
    onPointerUp={live ? (e => { if (e.pointerType !== 'mouse') resumeToast() }) : undefined}>
    <span className="toast-msg">{msg}</span>
    {action && <button type="button" className="toast-act" key={action.id} onClick={runToastAction}>
      <Icon name={action.icon} />{action.label}
    </button>}
  </div>
}
