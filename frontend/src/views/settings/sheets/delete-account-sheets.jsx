import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { passwordError } from '../../../components/PasswordAuth.jsx'
import { NotConfirmedError, scheduleDeletion } from '../../../lib/account-deletion.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import TextField from '../../../ds/TextField.jsx'
import { confirmDrawer } from '../confirm-drawer.js'

/* The drawers of Delete account (boards St3Confirm, St3PasskeyFailed). Each opens through
   openSheet, so from inside a drawer it is a sub-panel, never a second drawer. None of them
   deletes anything by itself: lib/account-deletion.js asks the server only with a proof made on
   the tap, and the server schedules the deletion with seven days to cancel it. */

// What a failed attempt says (A3.2). Every one of them deleted nothing, and says so.
export function notConfirmedLine(reason) {
  switch (reason) {
    case 'offline': return t('Couldn’t reach your server, so nothing was deleted. Try again when you’re online.')
    case 'locked': return t('Too many tries, so nothing was deleted. Wait a minute, then try again.')
    case 'last-admin': return t('You’re the last admin, so this account can’t be deleted. Make someone else an admin first.')
    case 'no-passkey': return t('This profile has no passkey, and this server does not take passwords, so nothing here can confirm that it is you. Ask your admin.')
    case 'no-webauthn': return t('This browser cannot confirm with your passkey. Do this on a device that holds one.')
    case 'signed-out': case 'error': return t('Something went wrong, so nothing was deleted. Try again.')
    default: return t('Couldn’t confirm it’s you, so nothing was deleted. Try again, or use the passkey on your other device.')
  }
}
// The failures a second try can fix. The others need something else first (an admin, a passkey).
const RETRY = new Set(['cancelled', 'passkey', 'refused', 'offline', 'locked', 'signed-out', 'error'])
export const canRetry = reason => RETRY.has(reason)

// A3.1: the R5 confirm. Confirm closes it and runs `onConfirm`, which opens the passkey prompt.
export const confirmDeletion = ({ day, onConfirm }) => confirmDrawer({
  title: t('Delete your account?'),
  body: t('Gains will ask for your passkey. Your account is then scheduled for deletion on {0}; until then, signing in lets you cancel.', day),
  icon: 'fingerprint',
  confirmLabel: t('Delete with passkey'),
  onConfirm,
})

// A3.2: nothing was deleted. Try again (when a second try can work) or Cancel.
export function NotConfirmedSheet({ reason, onRetry, close }) {
  return (
    <BottomSheet title={t('Not confirmed')} type="auto" onClose={close}>
      <div className="g-acct-sheet">
        <p className="g-acct-p">{notConfirmedLine(reason)}</p>
        {onRetry && <Button icon="fingerprint" onClick={() => { close(); onRetry() }}>{t('Try again')}</Button>}
        <Button variant="secondary" block onClick={close}>{onRetry ? t('Cancel') : t('OK')}</Button>
      </div>
    </BottomSheet>
  )
}
export const openNotConfirmed = ({ reason, onRetry = null }) => useUI.getState().openSheet(
  close => <NotConfirmedSheet reason={reason} onRetry={canRetry(reason) ? onRetry : null} close={close} />, { variant: 'ds' })

/* A3.1 for a profile whose password is the proof (no passkey, or none this browser can use, on an
   instance that takes passwords). The password goes with the one request and is not kept; a
   wrong one deletes nothing and is said under the field. */
export function PasswordDeleteSheet({ day, close, onScheduled }) {
  const name = useStore(s => s.user?.name) || ''
  const pw = useRef('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const submit = async ev => {
    ev.preventDefault()
    if (busy) return
    if (!pw.current) { setErr(t('Enter your password.')); return }
    setBusy(true); setErr(null)
    try {
      await scheduleDeletion({ current: pw.current })
      if (!live.current) return
      close()
      onScheduled()
    } catch (e) {
      if (!live.current) return
      const reason = e instanceof NotConfirmedError ? e.reason : 'error'
      setErr(reason === 'refused' || reason === 'locked' ? passwordError(e.cause) + ' ' + t('Nothing was deleted.') : notConfirmedLine(reason))
      setBusy(false)
    }
  }
  return (
    <BottomSheet title={t('Delete your account?')} type="auto" onClose={close}>
      <form className="g-acct-sheet" onSubmit={submit} noValidate>
        <p className="g-acct-p">{t('Enter your password to confirm it’s you. Your account is then scheduled for deletion on {0}; until then, signing in lets you cancel.', day)}</p>
        {/* Tells a password manager which account the password belongs to. */}
        <input type="text" name="username" autoComplete="username" value={name} readOnly hidden />
        <TextField label={t('Current password')} placeholder={t('Current password')} onChange={v => { pw.current = v }}
          inputProps={{ type: 'password', name: 'current-password', autoComplete: 'current-password' }} />
        {err && <p className="g-acct-err" role="alert">{err}</p>}
        <Button variant="danger" block type="submit" busy={busy}>{t('Delete my account')}</Button>
        <Button variant="secondary" block onClick={close}>{t('Cancel')}</Button>
      </form>
    </BottomSheet>
  )
}
export const openPasswordDelete = ({ day, onScheduled }) => useUI.getState().openSheet(
  close => <PasswordDeleteSheet day={day} close={close} onScheduled={onScheduled} />, { variant: 'ds' })
