// More than one passkey on a profile, and the one-time code that adds one on another device
// (#95). Settings → Account lists the passkeys and offers both ways to add one (the drawers are in
// views/settings/sheets/); the sign-in screen — or the link in the code's QR, opened on the other
// device — redeems a code (views/AddDevice.jsx).
// The rules are the server's (api/passkeys-store.js, api/device-link.js and the passkeys block in
// api/server.js): what needs proof, the last way in, how long a code lives. This only words them.
import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import { passwordError, notReached, useAgainOnceReached } from './PasswordAuth.jsx'

// How long a code lives (api/device-link.js DEVICE_LINK_TTL_MS), for the sentence that says so.
export const LINK_MINUTES = 10

// The server's refusal in the UI language. The proof codes are the password sheet's; the rest
// are this feature's own (api/openapi.yaml, tag passkeys).
export function passkeyError(e) {
  // The authenticator already holds one of this profile's passkeys (excludeCredentials).
  if (e?.name === 'InvalidStateError') return t('This device already has a passkey for this profile.')
  switch (e?.data?.code) {
    case 'last-way-in': return t('It is your only way in, so it cannot be removed until there is another.')
    case 'passkey-limit': return t('This profile already has as many passkeys as it can hold.')
    case 'credential-exists': return t('This passkey already belongs to a profile.')
  }
  return passwordError(e)
}

// GET /api/account/passkeys: { passkeys, password, lastWayIn }, or null until it answers — and
// for as long as the answer is not a list, which is what a server from before #95 gives, so
// Settings on such a server simply has no passkey rows.
export const listOf = r => (Array.isArray(r?.passkeys) ? r : null)
export function usePasskeys(on) {
  const [st, setSt] = useState(null)
  const [unreached, setUnreached] = useState(false)
  const load = () => api('/api/account/passkeys').then(r => { setSt(listOf(r)); setUnreached(false) }).catch(e => setUnreached(notReached(e)))
  useEffect(() => { if (on) load() }, [on])
  useAgainOnceReached(on && unreached, load)
  return { st, load, set: setSt }
}

// Redeeming a code on the other device is views/AddDevice.jsx.
