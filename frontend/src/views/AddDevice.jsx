import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { api, webauthnOK, createPasskey } from '../lib/api.js'
import { deviceLabel } from '../lib/device-link.js'
import { nav, onSheetEntry } from '../lib/nav.js'
import { askAddDeviceData } from '../sheets.jsx'
import { passkeyError, LINK_MINUTES } from '../components/Passkeys.jsx'
import Button from '../ds/Button.jsx'
import CodeCells, { cleanCode } from '../ds/CodeCells.jsx'
import GlassList from '../ds/GlassList.jsx'
import InlineBanner from '../ds/InlineBanner.jsx'
import OnboardingNav from '../ds/OnboardingNav.jsx'
import StageFooter from '../ds/StageFooter.jsx'
import StageScreen from '../ds/StageScreen.jsx'
import SuccessCheck from '../ds/SuccessCheck.jsx'
import '../signin.css'

/* Add this device (S0.4–S0.6): the device being added creates a passkey of its own with a one-time
   code from a signed-in one, and that passkey signs it in. A full stage screen on a route of its
   own, so it is the same screen whether it is reached from the sign-in screen, from its "Having
   trouble?" drawer, from Settings, or by the link in the code's QR (App.jsx opens that one by
   itself). It stays up after the sign-in it causes, which is why it is not part of Login: the
   session exists before "Passkey added" is on screen.

   The code comes from the link's ?link= (the store holds it, see boot()) or is typed or pasted.
   A code from a link is checked as the screen opens, so it can say whose profile this device is
   joining and the passkey prompt then opens straight from the tap. The passkey is named after this
   browser (deviceLabel), which the list in Settings can change. Signed in afterwards like a
   passkey sign-in: the same account coming back merges what this device kept for it
   (adoptProfile), and another account's copy is kept aside for that one (setUser).

   A link opens this screen by itself, and anyone can send one: a code for their own profile would
   sign this browser in to it with a single tap and the passkey prompt, and whatever is logged
   here afterwards would be theirs to read (login CSRF). So unless the code is for the profile
   this browser is already signed in as — told apart by id, since names are not unique and the
   sender chooses theirs — the screen says which profile this device ends up in and to go on only
   with a code from a device of one's own, and a guest's workouts go into that profile only when
   the guest says so, even into one that has nothing yet (adoptProfile's alwaysAsk). */
export const ADD_DEVICE_PATH = '/add-device'

// The server's codes are twelve letters and digits, written four by four (api/device-link.js).
const CODE_LENGTH = 12
// The server keeps a creation challenge five minutes; one older than four is asked for again
// rather than risked on a prompt that then fails.
const CHALLENGE_FRESH_MS = 4 * 60000

const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
// A passkey prompt the person closed is their answer, not an error worth a line.
const dismissed = e => e?.name === 'NotAllowedError' || e?.name === 'AbortError'
// A code copied as the link that carries it (…?link=K7WQ-2MZP-4HXA) is as good as the code.
const codeFrom = text => cleanCode(/[?&]link=([^&#\s]+)/.exec(text)?.[1] ?? text, CODE_LENGTH)

/** Opens the screen. From a sheet, pass its `close`: the screen takes the sheet's history entry. */
export function openAddDevice(close) {
  const replace = onSheetEntry()
  close?.()
  nav(ADD_DEVICE_PATH, replace ? { replace } : undefined)
}

export default function AddDevice() {
  const navigate = useNavigate()
  const loc = useLocation()
  const user = useStore(s => s.user)
  const pending = useStore(s => s.linkCode)
  const [code, setCode] = useState(() => cleanCode(pending, CODE_LENGTH))
  const [info, setInfo] = useState(null)   // { code, cid, options, id, name, at } from checking the code
  const [busy, setBusy] = useState(false)
  // n counts the failures, so each one is a new element: it is announced, and takes focus, again.
  const [fail, setFail] = useState(null)   // { n, kind: 'code' } | { n, kind: 'other', message }
  const [added, setAdded] = useState(null) // { name } once the passkey is made and this device is in
  const inputRef = useRef(null)
  const failWith = e => setFail(f => ({
    n: (f?.n || 0) + 1,
    ...(e?.data?.code === 'link-invalid' ? { kind: 'code' } : { kind: 'other', message: typeof e === 'string' ? e : passkeyError(e) }),
  }))
  // Back to where it was opened from; the router's first entry ('default') has nothing behind it
  // in the app (a reload, a bookmark).
  const back = () => (loc.key !== 'default' ? navigate(-1) : navigate('/', { replace: true }))
  const check = async c => {
    const r = await post('/api/device-link/options', { code: c })
    const i = { ...r, code: c, at: Date.now() }
    setInfo(i)
    return i
  }
  useEffect(() => {
    if (!webauthnOK()) return
    if (pending) { check(cleanCode(pending, CODE_LENGTH)).catch(failWith); return }
    const timer = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [])
  const submit = async ev => {
    ev.preventDefault()
    if (busy) return
    if (!code) { failWith(t('Enter the code from your other device.')); return }
    setBusy(true); setFail(null)
    let spent = false
    try {
      const i = info && info.code === code && Date.now() - info.at < CHALLENGE_FRESH_MS ? info : await check(code)
      const credential = await createPasskey(i.options)
      spent = true
      const r = await post('/api/device-link/verify', { code, cid: i.cid, credential, name: deviceLabel() })
      const st = useStore.getState()
      useStore.setState({ linkCode: null })
      const same = st.user?.id === r.user.id
      // Another profile: its question decides what becomes of this copy, and nothing syncs
      // before it is answered (adoptProfile).
      st.setUser(r.user, same ? undefined : { adopt: { alwaysAsk: true } })
      // Signed in by now whatever happens next: a pull that fails is the sync banner's to say
      // (adoptProfile records it), not a reason to hide that this device got in.
      if (!same) await st.adoptProfile(askAddDeviceData, { alwaysAsk: true }).catch(() => {})
      setAdded({ name: r.user.name })
    } catch (e) {
      if (!dismissed(e)) failWith(e)
      // Answered by the server, the challenge is gone; the next try asks for a new one.
      if (spent || e?.status) setInfo(null)
    } finally { setBusy(false) }
  }
  const again = () => { setCode(''); setInfo(null); setFail(null); inputRef.current?.focus() }
  // Where the clipboard cannot be read (plain http, a refusal) the field takes a long-press paste.
  const paste = async () => {
    try { setCode(codeFrom(await navigator.clipboard.readText())) } catch { inputRef.current?.focus() }
  }

  if (added) return (
    <StageScreen>
      <div className="si-col">
        <div className="si-done">
          <SuccessCheck />
          <h1>{t('Passkey added')}</h1>
          <p>{t('This phone now signs in to {0}’s profile on its own. Your other device stays signed in.', added.name)}</p>
        </div>
        <div className="si-foot">
          <StageFooter sticky={false}>
            <Button block onClick={() => navigate('/', { replace: true })}>{t('Go to Today')}</Button>
          </StageFooter>
        </div>
      </div>
    </StageScreen>
  )

  if (!webauthnOK()) return (
    <StageScreen>
      <div className="si-col">
        <OnboardingNav onBack={back} />
        <div className="si-head">
          <h1>{t('Add this device')}</h1>
          <p>{t('This browser cannot create passkeys, so it cannot be added with a code. Open the link in a browser that can.')}</p>
        </div>
        <div className="si-foot">
          <StageFooter sticky={false}><Button block onClick={back}>{t('Done')}</Button></StageFooter>
        </div>
      </div>
    </StageScreen>
  )

  const joining = info && info.code === code ? info : null
  const elsewhere = joining && joining.id !== user?.id
  const badCode = fail?.kind === 'code'
  const row = [{ icon: 'smartphone', title: t('Where is the code?'), sub: t('On your other device: Settings › Account') }]
  return (
    <StageScreen>
      <form className="si-col" onSubmit={submit} noValidate>
        <OnboardingNav onBack={back} />
        <div className="si-head">
          <h1>{t('Add this device')}</h1>
          <p>{joining
            ? t('Create a passkey on this device for the profile “{0}”. It signs you in here from now on.', joining.name)
            : t('Enter the code your other device shows under Settings › Account › Add another device. This device then gets a passkey of its own.')}</p>
        </div>
        <div className="si-code">
          <CodeCells length={CODE_LENGTH} label={t('Code from your other device')} value={code} onChange={v => { setCode(v); if (badCode) setFail(null) }} invalid={badCode} inputRef={inputRef} />
        </div>
        {!fail && <p className="si-code-note" aria-live="polite">{t('Codes work once and last {0} minutes.', LINK_MINUTES)}</p>}
        {fail && (
          <div className="si-block si-block-tight" key={fail.n}>
            {badCode
              ? <InlineBanner stage role="alert" title={t('That code didn’t work')} body={t('It is wrong, already used or expired. Make a new one on your other device.')} />
              : <InlineBanner stage role="alert" title={fail.message} />}
          </div>
        )}
        {elsewhere && (
          <div className="si-block si-block-tight">
            <InlineBanner stage icon="warning"
              title={user
                ? (user.name === joining.name
                  ? t('This code is for a different profile that is also called “{0}”, not the one this browser is signed in as. Adding it there signs yours out here.', joining.name)
                  : t('This browser is signed in as “{0}”. Adding it to “{1}” signs “{0}” out here.', user.name, joining.name))
                : t('Only continue if this code comes from a device of your own. This browser is then signed in to “{0}”, and what you log here goes to that profile.', joining.name)}
              body={user ? t('Only continue if this code comes from a device of your own. This browser is then signed in to “{0}”, and what you log here goes to that profile.', joining.name) : undefined} />
          </div>
        )}
        <div className="si-block"><GlassList items={row} /></div>
        <div className="si-foot">
          <StageFooter sticky={false}>
            {badCode
              ? <Button block onClick={again}>{t('Enter the code again')}</Button>
              : <>
                <Button block type="submit" icon="keyRound" busy={busy}>{t('Create passkey')}</Button>
                <Button block variant="ghost" onClick={paste}>{t('Paste code')}</Button>
              </>}
          </StageFooter>
        </div>
      </form>
    </StageScreen>
  )
}
