import { useRef } from 'react'
import { PRESETS, collapse } from '../lib/motion.js'
import { leavingProps, useEnterExit, usePresence } from './presence.jsx'

// Something in a column that is put away in place (Today's welcome back, the saved pill): taken out
// through a <Presence>, its content fades and settles while its row closes, so what is under it
// moves up instead of jumping. It comes in as it always did, at once. Outside a Presence it is a
// plain wrapper.
export default function Collapse({ children }) {
  const row = useRef(null)
  const { present } = usePresence()
  useEnterExit(phase => {
    const el = row.current
    if (phase !== 'exit' || !el) return []
    return [[el.firstElementChild, PRESETS.foldAway], [el, collapse(el.offsetHeight)]]
  })
  return <div ref={row} className="collapse" {...leavingProps(present)}>{children}</div>
}
