// More than one passkey on a profile, and the one-time code that adds one on another device
// (#95). Settings → Account lists the passkeys and offers both ways to add one; the sign-in screen
// — or the link in the code's QR, opened on the other device — redeems a code (views/AddDevice.jsx).
// The rules are the server's (api/passkeys-store.js, api/device-link.js and the passkeys block in
// api/server.js): what needs proof, the last way in, how long a code lives. This only words them.
import { useEffect, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { dateLocale } from '../lib/i18n-core.js'
import { api, webauthnOK, createPasskey } from '../lib/api.js'
import { copyText } from '../lib/clipboard.js'
import { deviceLinkUrl } from '../lib/device-link.js'
import { passwordError, notReached, useAgainOnceReached, ProveOwner } from './PasswordAuth.jsx'
import QrCanvas from './QrCanvas.jsx'
import { Row, Button } from './ui.jsx'
import { Spacer } from './layout.jsx'
import { Card } from './blocks.jsx'
import { SheetHeader } from './sheet-layout.jsx'

const ui = () => useUI.getState()
const toast = m => ui().toast(m)
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
// A passkey prompt the person closed is their answer, not an error worth a line in red.
const dismissed = e => e?.name === 'NotAllowedError' || e?.name === 'AbortError'
// How long a code lives (api/device-link.js DEVICE_LINK_TTL_MS), for the sentence that says so.
export const LINK_MINUTES = 10

// The year only when it is not this one, so "Added … · Last used …" fits on one line.
const when = iso => {
  const d = new Date(iso)
  const year = d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}
  try { return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', ...year }) }
  catch { return '' }
}
const label = (p, i) => p.name || t('Passkey {0}', i + 1)
// "Added 3 Sep 2026 · Last used 22 Sep 2026" — a passkey from before either was recorded has none.
const meta = p => [p.created && t('Added {0}', when(p.created)), p.lastUsed && t('Last used {0}', when(p.lastUsed))].filter(Boolean).join(' · ')

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
const listOf = r => (Array.isArray(r?.passkeys) ? r : null)
export function usePasskeys(on) {
  const [st, setSt] = useState(null)
  const [unreached, setUnreached] = useState(false)
  const load = () => api('/api/account/passkeys').then(r => { setSt(listOf(r)); setUnreached(false) }).catch(e => setUnreached(notReached(e)))
  useEffect(() => { if (on) load() }, [on])
  useAgainOnceReached(on && unreached, load)
  return { st, load, set: setSt }
}

/* ------------------------------------------------------------------- Settings -------------
   Settings → Account: the passkeys, and a code for another device. `changed` tells Settings to
   read the list again, and the password row with it — whether a password may be removed depends
   on how many passkeys there are. */
export function PasskeysRow({ state, changed }) {
  if (!state) return null
  const n = state.passkeys.length
  return <Row icon="fingerprint" iconTint="var(--acc)" title={t('Passkeys')} accessory="chevron"
    subtitle={n === 0 ? t('None yet. Add one and sign in without your password.') : tn('1 passkey', '{0} passkeys', n)}
    onClick={() => ui().openSheet(close => <PasskeysSheet close={close} changed={changed} />)} />
}

export function DeviceLinkRow({ state }) {
  if (!state) return null
  return <Row icon="qr" iconTint="var(--blue)" title={t('Add another device')} accessory="chevron"
    subtitle={t('A one-time code lets your phone or another computer sign in with a passkey of its own.')}
    onClick={() => ui().openSheet(close => <DeviceLinkSheet close={close} />)} />
}

export function PasskeysSheet({ close, changed }) {
  const { st, set } = usePasskeys(true)
  const done = r => { set(listOf(r) || st); changed?.() }
  if (!st) return <><SheetHeader title={t('Passkeys')} /><div className="muted small">…</div></>
  const edit = (p, i) => ui().openSheet(c => <PasskeySheet passkey={p} title={label(p, i)} state={st} close={c} done={done} />)
  const add = () => ui().openSheet(c => <AddPasskeySheet state={st} close={c} done={done} />)
  return <>
    <SheetHeader title={t('Passkeys')} />
    <div className="muted small mb-7">
      {t('Each one signs in to this profile from the device or password manager that keeps it. Tap one to rename or remove it.')}
    </div>
    {st.passkeys.length > 0 && <div className="sect-b">
      {st.passkeys.map((p, i) => <Row key={p.id} icon="fingerprint" iconTint="var(--grey)" title={label(p, i)} subtitle={meta(p) || null}
        accessory="chevron" onClick={() => edit(p, i)} />)}
    </div>}
    {st.passkeys.length === 1 && st.lastWayIn && <div className="dim small mt-4">
      {t('It is your only way in, so it cannot be removed until there is another.')}</div>}
    <Spacer size={7} />
    {webauthnOK() && <><Button variant="primary" icon="plus" onClick={add}>{t('Add a passkey')}</Button><Spacer size={4} /></>}
    <Button onClick={close}>{t('Done')}</Button>
  </>
}

// One passkey: its name, and removing it (RemovePasskeySheet).
function PasskeySheet({ passkey, title, state, close, done }) {
  const [name, setName] = useState(passkey.name || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const save = async ev => {
    ev.preventDefault()
    if (busy) return
    setBusy(true); setErr(null)
    try { done(await post('/api/account/passkeys/rename', { id: passkey.id, name })); close() }
    catch (e) { setErr(passkeyError(e)) }
    finally { setBusy(false) }
  }
  const remove = () => ui().openSheet(c => <RemovePasskeySheet passkey={passkey} title={title} state={state} close={c} done={r => { done(r); close() }} />)
  const info = meta(passkey)
  return <>
    <SheetHeader title={title} />
    {info && <div className="muted small mb-7">{info}</div>}
    <form onSubmit={save} noValidate>
      <input className="input" placeholder={t('Name, e.g. Work laptop')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      {err && <div className="small ink-danger mt-5" role="alert">{err}</div>}
      <Spacer size={6} />
      <Button type="submit" variant="primary" disabled={busy}>{t('Save')}</Button>
    </form>
    <Spacer size={4} />
    {state.lastWayIn
      ? <div className="dim small">{t('It is your only way in, so it cannot be removed until there is another.')}</div>
      : <button type="button" className="btn danger" disabled={busy} onClick={remove}>{t('Remove passkey')}</button>}
  </>
}

/* Removing one asks for the proof adding one does (proveOwner in api/server.js): a copied
   session must not choose which of the owner's passkeys is left. The proof is the confirmation,
   so it is asked on the sheet that says what removing means; any passkey of the profile may give
   it, this one included. Removing does not end a session the passkey opened — sessions are not
   tied to one (api/server.js) — which the sheet says, with the way to do that. */
function RemovePasskeySheet({ passkey, title, state, close, done }) {
  const remove = async proof => {
    const r = await api('/api/account/passkeys?id=' + encodeURIComponent(passkey.id), { method: 'DELETE', body: JSON.stringify(proof) })
    close(); done(r)
    toast(t('Passkey removed'))
  }
  return <>
    <SheetHeader title={t('Remove this passkey?')} />
    <div className="small fw-semibold mb-3">{title}</div>
    <div className="muted small mb-3">
      {t('It can no longer sign in to this profile. A device already signed in with it stays signed in. If it was lost, use Sign out everywhere.')}
    </div>
    <div className="dim small mb-7">{t('First confirm that it is you.')}</div>
    <ProveOwner passkey password={state.password} explain={passkeyError} danger submitText={t('Remove')} onProof={remove} />
    <Spacer size={4} />
    <Button type="button" variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* Adding one from Settings: the proof first, then the passkey prompt — two taps rather than one,
   because each prompt wants a tap of its own (Safari refuses a second prompt opened from the same
   one), and a password, where that is the proof, is typed before either. What it is for: a
   security key, a password manager, a phone through the browser's own QR prompt. Another device
   that can open Gains itself is easier with a code (DeviceLinkSheet). */
function AddPasskeySheet({ state, close, done }) {
  // Blank to start with: what gets added here is rarely this browser (a key, a phone, a manager).
  const [name, setName] = useState('')
  const [ready, setReady] = useState(null)   // { cid, options } once the proof went through
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const create = async () => {
    if (busy) return
    setBusy(true); setErr(null)
    try {
      const credential = await createPasskey(ready.options)
      done(await post('/api/account/passkeys/verify', { cid: ready.cid, credential, name }))
      close()
      toast(t('Passkey added'))
    } catch (e) {
      if (dismissed(e)) return
      setErr(passkeyError(e))
      // The server spent the challenge on that answer: a retry starts from the proof again.
      if (e?.status) setReady(null)
    } finally { setBusy(false) }
  }
  return <>
    <SheetHeader title={t('Add a passkey')} />
    <div className="muted small mb-7">{ready
      ? t('Confirmed. Now create the new passkey; your browser will ask where to keep it.')
      : t('For this device, a security key, a password manager, or your phone through the browser’s own QR code. First confirm that it is you.')}</div>
    <input className="input" placeholder={t('Name, e.g. Work laptop')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    <Spacer size={6} />
    {ready ? <Button variant="primary" icon="plus" disabled={busy} onClick={create}>{t('Create passkey')}</Button>
      : <ProveOwner passkey={state.passkeys.length > 0} password={state.password} explain={passkeyError}
        onProof={async proof => setReady(await post('/api/account/passkeys/options', proof))} />}
    {err && <div className="small ink-danger mt-5" role="alert">{err}</div>}
  </>
}

/* A code for another device: after the same proof, the code itself, a QR code of the link that
   carries it, and a way to copy that link. The other device either scans it or types the code on
   its sign-in screen. When it expires the sheet says so and offers a new one. */
export function DeviceLinkSheet({ close }) {
  const { st } = usePasskeys(true)
  const [link, setLink] = useState(null)   // { code, expires }
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    if (!link) return
    setExpired(false)
    const timer = setTimeout(() => setExpired(true), Math.max(0, link.expires - Date.now()))
    return () => clearTimeout(timer)
  }, [link])
  const url = link ? deviceLinkUrl(link.code) : ''
  const copy = async () => { if (await copyText(url)) toast(t('Copied')) }
  return <>
    <SheetHeader title={t('Add another device')} />
    {!st ? <div className="muted small">…</div> : !link ? <>
      <div className="muted small mb-7">
        {t('You get a code that lets your phone or another computer create a passkey for this profile. First confirm that it is you.')}
      </div>
      <ProveOwner passkey={st.passkeys.length > 0} password={st.password} explain={passkeyError}
        onProof={async proof => setLink(await post('/api/account/device-link', proof))} />
    </> : expired ? <>
      <div className="muted small mb-7">{t('This code has expired.')}</div>
      <Button variant="primary" onClick={() => setLink(null)}>{t('Make a new code')}</Button>
    </> : <>
      <div className="muted small mb-7">
        {t('Scan this with the other device, or open Gains there and enter the code on the sign-in screen. It works once, for {0} minutes.', LINK_MINUTES)}
      </div>
      <div className="ci-qr-plate gate-qr"><QrCanvas value={url} size={200} /></div>
      {/* Read out or typed character by character: left to right in every language. */}
      <Card dir="ltr" className="ta-center fw-bold ls-12" style={{ fontSize: 24, padding: '14px 0' }}>{link.code}</Card>
      <Spacer size={6} />
      <Button icon="copy" onClick={copy}>{t('Copy link')}</Button>
    </>}
    <Spacer size={4} />
    <Button variant="ghost" onClick={close}>{t('Done')}</Button>
  </>
}

// Redeeming a code on the other device is views/AddDevice.jsx.
