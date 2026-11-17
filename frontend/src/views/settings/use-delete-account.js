import { useEffect, useRef, useState } from 'react'
import { webauthnOK } from '../../lib/api.js'
import { NotConfirmedError, deletionDay, graceEnd, prepareDeletion, scheduleDeletion } from '../../lib/account-deletion.js'
import { popToRoot } from '../../lib/use-tab-nav.js'
import { SETTINGS_ROOT } from './paths.js'
import { confirmDeletion, openNotConfirmed, openPasswordDelete } from './sheets/delete-account-sheets.jsx'

/**
 * Delete my account (A3.0 to A3.2). `start` asks the server what the owner can prove it with,
 * then opens the confirm: the passkey one (A3.1), whose button opens the prompt straight from the
 * tap, or the password one for a profile whose password is the proof. Scheduled, it goes to the
 * Settings root, where the banner says when and offers Cancel deletion (A3.3). Anything else
 * opens "Not confirmed" (A3.2) and nothing is deleted. `busy` while a request is out.
 */
export function useDeleteAccount() {
  const [busy, setBusy] = useState(false)
  const live = useRef(true)
  const prompt = useRef(null)
  useEffect(() => {
    live.current = true
    // Leaving the page calls an open prompt off: what it answers afterwards is not sent.
    return () => { live.current = false; prompt.current?.abort() }
  }, [])

  const day = () => deletionDay(graceEnd())
  const scheduled = () => popToRoot('me', SETTINGS_ROOT)
  const askPassword = () => openPasswordDelete({ day: day(), onScheduled: scheduled })
  const failed = (e, retry) => {
    const reason = e instanceof NotConfirmedError ? e.reason : 'error'
    if (reason === 'scheduled') return scheduled()   // already pending: the root's banner says so
    if (reason === 'password') return askPassword()
    openNotConfirmed({ reason, onRetry: retry })
  }

  // The proof and the request. With `prepared` options the prompt opens before anything is awaited.
  const run = async prepared => {
    const ctl = new AbortController()
    prompt.current = ctl
    setBusy(true)
    try {
      await scheduleDeletion({ prepared, signal: ctl.signal })
      if (live.current) scheduled()
    } catch (e) {
      if (live.current) failed(e, () => run(null))
    } finally {
      if (prompt.current === ctl) prompt.current = null
      if (live.current) setBusy(false)
    }
  }

  const start = async () => {
    if (busy) return
    setBusy(true)
    let prepared
    try {
      prepared = await prepareDeletion()
    } catch (e) {
      if (live.current) { setBusy(false); failed(e, start) }
      return
    }
    if (!live.current) return
    setBusy(false)
    if (prepared?.options && webauthnOK()) confirmDeletion({ day: day(), onConfirm: () => run(prepared) })
    else if (prepared?.password) askPassword()
    else failed(new NotConfirmedError(prepared?.options ? 'no-webauthn' : 'no-passkey'))
  }

  return { start, busy }
}
