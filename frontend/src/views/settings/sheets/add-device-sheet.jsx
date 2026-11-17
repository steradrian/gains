import { useEffect, useState } from 'react'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { api } from '../../../lib/api.js'
import { copyText } from '../../../lib/clipboard.js'
import { deviceLinkUrl } from '../../../lib/device-link.js'
import { passkeyError, LINK_MINUTES } from '../../../components/Passkeys.jsx'
import { ProveOwner } from '../../../components/PasswordAuth.jsx'
import QrCanvas from '../../../components/QrCanvas.jsx'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'

const ui = () => useUI.getState()
const toast = m => ui().toast(m)
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
const open = render => ui().openSheet(render, { variant: 'ds' })

export const openAddDeviceSheet = ({ state }) => open(close => <AddDeviceSheet state={state} close={close} />)
export const openPairSheet = () => open(close => <PairSheet close={close} />)

const clock = ms => {
  const s = Math.ceil(ms / 1000)
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/* A2.4: a code for another device. After the same proof adding a passkey asks, the code itself, a
   QR code of the link that carries it, and a way to copy that link. The other device either scans
   it or types the code on its sign-in screen. The code is the server's (twelve characters, once,
   LINK_MINUTES minutes); when it runs out the drawer says so and starts again from the proof. */
export function AddDeviceSheet({ state, close }) {
  const [link, setLink] = useState(null)   // { code, expires }
  const [left, setLeft] = useState(0)
  const grant = l => { setLink(l); setLeft(Math.max(0, l.expires - Date.now())) }
  useEffect(() => {
    if (!link) return
    const iv = setInterval(() => setLeft(Math.max(0, link.expires - Date.now())), 1000)
    return () => clearInterval(iv)
  }, [link])
  const expired = !!link && left <= 0
  const url = link ? deviceLinkUrl(link.code) : ''
  const copy = async () => { if (await copyText(url)) toast(t('Copied')) }
  return (
    <BottomSheet title={t('Add another device')} onClose={close}>
      <div className="g-acct-sheet">
        {!link && <>
          <p className="g-acct-p">{t('You get a code that lets your phone or another computer create a passkey for this profile. First confirm that it is you.')}</p>
          <ProveOwner passkey={state.passkeys.length > 0} password={state.password} explain={passkeyError}
            onProof={async proof => grant(await post('/api/account/device-link', proof))} />
        </>}
        {expired && <>
          <p className="g-acct-p">{t('This code has expired.')}</p>
          <Button onClick={() => setLink(null)}>{t('Make a new code')}</Button>
        </>}
        {link && !expired && <>
          <div className="g-acct-qr"><QrCanvas value={url} size={200} /></div>
          {/* Read out or typed character by character: left to right in every language. */}
          <div className="g-acct-code" dir="ltr">{link.code}</div>
          <p className="g-acct-p">{t('Scan this with the other device, or open Gains there and enter the code on the sign-in screen. It works once, for {0} minutes.', LINK_MINUTES)}</p>
          <p className="g-acct-p g-acct-quiet">{t('Expires in {0}', clock(left))}</p>
          <Button variant="secondary" icon="copy" onClick={copy}>{t('Copy link')}</Button>
        </>}
      </div>
    </BottomSheet>
  )
}

// Lets the mobile app's "connect to my server" mode (lib/remote.js) authenticate without a
// WebAuthn ceremony of its own: the code is minted here, from an already signed-in session,
// and redeemed by the app for a bearer token. See /api/pair/create in api/server.js.
export function PairSheet({ close }) {
  const [code, setCode] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { api('/api/pair/create', { method: 'POST', body: '{}' }).then(r => setCode(r.code)).catch(e => setErr(e.message || t('Could not generate a code'))) }, [])
  return (
    <BottomSheet title={t('Pair the mobile app')} onClose={close}>
      <div className="g-acct-sheet">
        <p className="g-acct-p">{t('On the Gains app, choose “Connect to my server”, then enter this address and the code below. It expires in 5 minutes.')}</p>
        {err ? <p className="g-acct-err" role="alert">{err}</p> : <div className="g-acct-code" dir="ltr">{code || '········'}</div>}
        <Button variant="secondary" block onClick={close}>{t('Done')}</Button>
      </div>
    </BottomSheet>
  )
}
