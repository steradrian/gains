import { useState } from 'react'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { dateLocale } from '../../../lib/i18n-core.js'
import { api, webauthnOK, createPasskey } from '../../../lib/api.js'
import { passkeyError } from '../../../components/Passkeys.jsx'
import { ProveOwner } from '../../../components/PasswordAuth.jsx'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import TextField from '../../../ds/TextField.jsx'

/* The passkey drawers of Account and data (boards St2Passkey, St2RemovePasskey, St2OnlyPasskey):
   one passkey with its name, removing it, and adding another. Removing and adding both ask for the
   proof the server asks for (proveOwner in api/server.js): a copied session must not choose which
   of the owner's passkeys is left. Removing does not end a session the passkey opened, which the
   panel says, with the way to do that. Panels open through openSheet, so from inside a drawer they
   slide in as sub-panels instead of stacking a second drawer. `done(list)` hands the page the
   list the server answered with. */

const ui = () => useUI.getState()
const toast = m => ui().toast(m)
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
// A passkey prompt the person closed is their answer, not an error worth a line in red.
const dismissed = e => e?.name === 'NotAllowedError' || e?.name === 'AbortError'

// The year only when it is not this one, so "Added … · Last used …" fits on one line.
const when = iso => {
  const d = new Date(iso)
  const year = d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}
  try { return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', ...year }) }
  catch { return '' }
}
export const passkeyLabel = (p, i) => p.name || t('Passkey {0}', i + 1)
// "Added 3 Sep 2026 · Last used 22 Sep 2026": a passkey from before either was recorded has none.
export const passkeyMeta = p => [p.created && t('Added {0}', when(p.created)), p.lastUsed && t('Last used {0}', when(p.lastUsed))].filter(Boolean).join(' · ')

const open = render => ui().openSheet(render, { variant: 'ds' })

export const openPasskeySheet = ({ passkey, title, state, done }) => open(close => <PasskeySheet passkey={passkey} title={title} state={state} close={close} done={done} />)
export const openAddPasskey = ({ state, done }) => open(close => <AddPasskeySheet state={state} close={close} done={done} />)

// A2.1: one passkey. Rename saves and closes; Remove opens A2.2, or A2.3 when it is the only one.
export function PasskeySheet({ passkey, title, state, close, done }) {
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
  // The only passkey is refused here before any proof is asked, whatever else the profile has
  // (a password included); the server holds the same line for the case it knows better (last-way-in).
  const remove = () => open(panelClose => state.passkeys.length <= 1
    ? <OnlyPasskeyPanel state={state} close={panelClose} done={r => { done(r); close() }} />
    : <RemovePasskeyPanel passkey={passkey} title={title} state={state} close={panelClose} done={r => { done(r); close() }} />)
  return (
    <BottomSheet title={t('Passkey')} onClose={close}>
      <div className="g-acct-sheet">
        <form className="g-acct-sheet" onSubmit={save} noValidate>
          <TextField label={t('Name')} value={passkey.name || ''} placeholder={t('Name, e.g. Work laptop')} onChange={setName} inputProps={{ maxLength: 40 }} />
          {(passkey.created || passkey.lastUsed) && (
            <div>
              {passkey.created && <DetailRow title={t('Created')} value={when(passkey.created)} />}
              {passkey.lastUsed && <DetailRow title={t('Last used')} value={when(passkey.lastUsed)} />}
            </div>
          )}
          {err && <p className="g-acct-err" role="alert">{err}</p>}
          <Button type="submit" busy={busy}>{t('Rename')}</Button>
        </form>
        <Button variant="danger" block onClick={remove}>{t('Remove passkey')}</Button>
      </div>
    </BottomSheet>
  )
}

// A2.2: the confirmation is the proof, asked on the panel that says what removing means.
function RemovePasskeyPanel({ passkey, title, state, close, done }) {
  const remove = async proof => {
    const r = await api('/api/account/passkeys?id=' + encodeURIComponent(passkey.id), { method: 'DELETE', body: JSON.stringify(proof) })
    close(); done(r)
    toast(t('Passkey removed'))
  }
  return (
    <BottomSheet title={t('Remove this passkey?')} onClose={close}>
      <div className="g-acct-sheet">
        <p className="g-acct-p"><b>{title}</b></p>
        <p className="g-acct-p">{t('It can no longer sign in to this profile. A device already signed in with it stays signed in. If it was lost, use Sign out everywhere.')}</p>
        <p className="g-acct-p">{t('First confirm that it is you.')}</p>
        <ProveOwner passkey password={state.password} explain={passkeyError} danger submitText={t('Remove passkey')} onProof={remove} />
        <Button variant="secondary" block onClick={close}>{t('Cancel')}</Button>
      </div>
    </BottomSheet>
  )
}

// A2.3: refused. Nothing is sent; the way forward is another passkey.
function OnlyPasskeyPanel({ state, close, done }) {
  const addFirst = () => open(panelClose => <AddPasskeySheet state={state} close={panelClose} done={r => { done(r) }} />)
  return (
    <BottomSheet title={t('Your only passkey')} onClose={close}>
      <div className="g-acct-sheet">
        <p className="g-acct-p">{t('It is your only way in, so it cannot be removed until there is another.')}</p>
        {webauthnOK() && <Button onClick={addFirst}>{t('Add a passkey first')}</Button>}
        <Button variant="secondary" block onClick={close}>{t('Keep it')}</Button>
      </div>
    </BottomSheet>
  )
}

/* Adding one: the proof first, then the passkey prompt: two taps rather than one, because each
   prompt wants a tap of its own (Safari refuses a second prompt opened from the same one), and a
   password, where that is the proof, is typed before either. What it is for: a security key, a
   password manager, a phone through the browser's own QR prompt. Another device that can open
   Gains itself is easier with a code (add-device-sheet.jsx). */
export function AddPasskeySheet({ state, close, done }) {
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
  return (
    <BottomSheet title={t('Add a passkey')} onClose={close}>
      <div className="g-acct-sheet">
        <p className="g-acct-p">{ready
          ? t('Confirmed. Now create the new passkey; your browser will ask where to keep it.')
          : t('For this device, a security key, a password manager, or your phone through the browser’s own QR code. First confirm that it is you.')}</p>
        <TextField label={t('Name')} placeholder={t('Name, e.g. Work laptop')} onChange={setName} inputProps={{ maxLength: 40 }} />
        {ready
          ? <Button icon="plus" busy={busy} onClick={create}>{t('Create passkey')}</Button>
          : <ProveOwner passkey={state.passkeys.length > 0} password={state.password} explain={passkeyError}
            onProof={async proof => setReady(await post('/api/account/passkeys/options', proof))} />}
        {err && <p className="g-acct-err" role="alert">{err}</p>}
      </div>
    </BottomSheet>
  )
}
