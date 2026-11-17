import { useCallback, useEffect, useRef, useState } from 'react'
import { askAdmin, cancelRequest, myRequests } from '../../../lib/me/invite-requests.js'
import { askFailure } from './ask-data.js'

// The view model of the member's Ask an admin page: their open asks loaded once, the note they are
// writing, and the two things they can do, ask and withdraw. No JSX.
//
//   requests    the open asks, oldest first (empty while loading or when the load failed: a row exists
//               only when there is something to withdraw)
//   note        the draft; `fieldKey` changes when it is cleared, to remount the uncontrolled field
//   sending     an ask is in flight
//   failure     null, or what the last ask met: { kind: 'daily' | 'open' | 'offline' | 'other', ... }
//   send()      resolves { id } when asked, else null (the draft stays and `failure` says why)
//   withdraw(id) resolves when the ask is gone; rejects with the API's error
//
// `backend` is { ask, mine, cancel }; the screens gallery passes an in-memory one.
export const REAL_BACKEND = { ask: askAdmin, mine: myRequests, cancel: cancelRequest }

export function useAsk(backend = REAL_BACKEND) {
  const [requests, setRequests] = useState([])
  const [note, setNote] = useState('')
  const [fieldKey, setFieldKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState(null)
  const alive = useRef(true)
  const busy = useRef(false)

  useEffect(() => {
    alive.current = true
    backend.mine().then(list => { if (alive.current) setRequests(list) }, () => {})
    return () => { alive.current = false }
  }, [backend])

  const edit = useCallback(value => { setNote(value); setFailure(null) }, [])

  const send = useCallback(async () => {
    const text = note.trim()
    if (!text || busy.current) return null
    busy.current = true
    setSending(true)
    setFailure(null)
    try {
      const id = await backend.ask(text)
      if (alive.current) {
        // The same note asked twice while open answers the same id: one row.
        setRequests(list => [...list.filter(r => r.id !== id), { id, note: text, at: Date.now() }])
        setNote('')
        setFieldKey(k => k + 1)
      }
      return { id }
    } catch (e) {
      if (alive.current) setFailure(askFailure(e))
      return null
    } finally {
      busy.current = false
      if (alive.current) setSending(false)
    }
  }, [backend, note])

  const withdraw = useCallback(async id => {
    await backend.cancel(id)
    if (alive.current) setRequests(list => list.filter(r => r.id !== id))
  }, [backend])

  return { requests, note, fieldKey, sending, failure, edit, send, withdraw }
}
