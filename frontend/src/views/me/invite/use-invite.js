import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BRAND } from '../../../brand.js'
import { copyText } from '../../../lib/clipboard.js'
import { inviteLink, shareLink } from '../../../lib/invite-link.js'
import { createInvite, groupInvites, loadInvites, revokeInvite } from '../../../lib/me/invites.js'

// The view model of the Invite page: the admin's list loaded once (and again on Try again), kept in
// step with what the page itself does (a new invite goes on top of Waiting, a revoked one leaves,
// an answered ask leaves Asked), and the create flow. No JSX.
//
//   status   'loading' | 'ready' | 'error'
//   groups   { waiting, joined, expired }, requests, inviteOnly
//   fresh    code -> 'copied' | 'shared' | 'none': invites made in this visit, for "created now"
//   create({ name, requestId, share })  resolves { invite, how }; how is 'copied', 'shared' or
//            null (the copy failed, or the share sheet was closed). Rejects with the API's error.
//   revoke(code)  resolves when it is gone; rejects with the API's error
//
// `backend` is { load, create, revoke, deliver }; the screens gallery passes an in-memory one.
// deliver(url, share) puts the link on the clipboard, or opens the system share sheet when `share`;
// it resolves 'copied', 'shared' or null (the copy failed, or the share sheet was closed).
async function deliver(url, share) {
  try {
    if (share) return (await shareLink(url, BRAND.name)) ? 'shared' : null
    return (await copyText(url)) ? 'copied' : null
  } catch {
    return null
  }
}
export const REAL_BACKEND = { load: loadInvites, create: createInvite, revoke: revokeInvite, deliver }

export function useInvite(backend = REAL_BACKEND) {
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState({ invites: [], requests: [], inviteOnly: true })
  const [fresh, setFresh] = useState({})
  const alive = useRef(true)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const next = await backend.load()
      if (!alive.current) return
      setData(next)
      setStatus('ready')
    } catch {
      if (alive.current) setStatus('error')
    }
  }, [backend])

  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [load])

  const create = useCallback(async ({ name, requestId, share }) => {
    const made = await backend.create({ name, requestId })
    const invite = { ...made, status: 'valid' }
    setData(d => ({
      ...d,
      invites: [invite, ...d.invites],
      requests: requestId ? d.requests.filter(r => r.id !== requestId) : d.requests,
    }))
    const how = await backend.deliver(inviteLink(invite.code), share)
    setFresh(f => ({ ...f, [invite.code]: how || 'none' }))
    return { invite, how }
  }, [backend])

  const revoke = useCallback(async code => {
    await backend.revoke(code)
    setData(d => ({ ...d, invites: d.invites.filter(i => i.code !== code) }))
    setFresh(f => {
      const { [code]: _gone, ...rest } = f
      return rest
    })
  }, [backend])

  const groups = useMemo(() => groupInvites(data.invites, Date.now()), [data.invites])

  return { status, groups, requests: data.requests, inviteOnly: data.inviteOnly, fresh, reload: load, create, revoke }
}
