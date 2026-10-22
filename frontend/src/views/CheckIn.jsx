import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { canRenderFmt } from '../lib/qr.js'
import { scanCode, importCodeFromImage } from '../lib/scan.js'
import { MOBILE } from '../lib/mobile.js'
import QrCanvas from '../components/QrCanvas.jsx'
import CameraScan from '../components/CameraScan.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import TextField from '../ds/TextField.jsx'

// The gym card's logic: the reorder helper and the add/edit drawer. The page is
// views/settings/pages/GymPassPage.jsx. We only ever store the code's value and symbology; the QR
// is regenerated from it every time (see lib/qr.js), so nothing sensitive is kept as an image.

// Move the card at `from` to sit at index `to`, returning a new array (the input is left alone).
// Backs the on-card ◀ ▶ reorder buttons. Out-of-range or no-op moves return an unchanged copy
// rather than throwing, so a button at either end is simply inert.
export function moveGymCard(cards, from, to) {
  const next = [...cards]
  if (from < 0 || from >= next.length) return next
  const target = Math.max(0, Math.min(to, next.length - 1))
  if (target === from) return next
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

/* ------------------------------------------------------------- add/edit sheet -- */

// Opens the add-card drawer. Co-located with the card logic (not sheets.jsx) because it pulls in
// the scanner paths — keeping it here keeps them out of the shared sheets module.
// `typing` shows the field for the number; `scan` starts the camera as soon as it opens.
export function openAddCard({ typing = false, scan = false } = {}) {
  useUI.getState().openSheet(close => <CardSheet close={close} typing={typing} autoScan={scan} />, { variant: 'ds' })
}

// Opens the same drawer on an existing card to rename it, re-scan it or retype its number.
export function openEditCard(card) {
  useUI.getState().openSheet(close => <CardSheet close={close} card={card} />, { variant: 'ds' })
}

// Shared drawer for adding and editing a card. Without `card` it creates a new one; with `card` it
// updates that entry in place. The code comes from a scan, a photo or the number typed in; an edit
// that only renames keeps the existing code untouched. The QR drawn under the fields is the check
// that a typed number is the one meant.
function CardSheet({ close, card, typing = false, autoScan = false }) {
  const editing = !!card
  const [label, setLabel] = useState(card?.label || '')
  const [value, setValue] = useState(card?.value || '')
  // A scan fills the number field from outside; a new key re-reads the value into the input.
  const [fieldKey, setFieldKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const toast = useUI(s => s.toast)

  const capture = code => {
    setValue(code.value)
    setFieldKey(k => k + 1)
  }

  const commit = () => {
    const trimmed = value.trim()
    if (!trimmed) { toast(t('Scan or import a code first')); return }
    const update = useStore.getState().update
    if (editing) {
      // The card can be removed on another device while this sheet is open. Checking inside the
      // mutator returned from the MUTATOR, not from here, so the sheet still said "Card updated",
      // closed, and pushed a write that changed nothing. Look first, and say what happened.
      if (!(useStore.getState().S.gymCards || []).some(x => x.id === card.id)) {
        toast(t('That card was removed on another device'))
        close()
        return
      }
      update(s => {
        const c = (s.gymCards || []).find(x => x.id === card.id)
        if (!c) return
        c.label = label.trim() || t('Gym card')
        c.value = trimmed
      })
      toast(t('Card updated'))
    } else {
      update(s => {
        if (!Array.isArray(s.gymCards)) s.gymCards = []
        const id = uid()
        s.gymCards.push({ id, label: label.trim() || t('Gym card'), value: trimmed, fmt: 'qrcode' })
        s.lastGymCardId = id
      })
      toast(t('Card added'))
    }
    close()
  }

  // Camera scan: in the app, hands off to the native scanner; in a browser, opens our own camera
  // panel (a sub-panel of this drawer, via openSheet). Either way the value drops straight into
  // the form so the user can still name it before saving.
  const doScan = async () => {
    if (!MOBILE) {
      useUI.getState().openSheet(closeCam => <CameraScan
        onCancel={closeCam}
        onFound={code => {
          closeCam()
          if (!canRenderFmt(code.fmt)) { toast(t("That's not a QR code. Only QR cards can be shown here")); return }
          capture(code)
        }} />)
      return
    }
    setBusy(true)
    try {
      const code = await scanCode()
      if (!code) return                       // user backed out
      if (!canRenderFmt(code.fmt)) { toast(t("That's not a QR code. Only QR cards can be shown here")); return }
      capture(code)
    } catch (e) {
      toast(scanErrorMessage(e))
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (autoScan) doScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the drawer opens
  }, [])

  const onFile = async ev => {
    const file = ev.target.files && ev.target.files[0]
    ev.target.value = ''                       // let the same file be picked again later
    if (!file) return
    setBusy(true)
    try {
      const code = await importCodeFromImage(file)
      if (!code) { toast(t('No QR code found in that image')); return }
      if (!canRenderFmt(code.fmt)) { toast(t("That's not a QR code. Only QR cards can be shown here")); return }
      capture(code)
    } catch (e) {
      toast(t('Could not read that image'))
    } finally { setBusy(false) }
  }

  return (
    <BottomSheet title={editing ? t('Edit card') : t('Add a card')} type="auto"
      footer={<Button block onClick={commit} disabled={busy || !value.trim()}>{t('Save card')}</Button>}>
      <div className="ci-sheet">
        <p className="g-bs-note">{t('Scan it with the camera or import a photo.')}</p>
        <div className="ci-sheet-acts">
          <Button variant="secondary" icon="camera" onClick={doScan} disabled={busy}>{editing ? t('Re-scan') : t('Scan')}</Button>
          <Button variant="secondary" icon="image" onClick={() => fileRef.current?.click()} disabled={busy}>{t('Import photo')}</Button>
        </div>
        <TextField label={t('Label')} value={label} onChange={setLabel} placeholder={t('e.g. FitZone downtown')} wide />
        {(typing || editing) && <TextField key={fieldKey} label={t('Card number')} value={value} onChange={setValue} wide />}
        {value.trim() && <div className="ci-qr-plate ci-sheet-qr"><QrCanvas value={value.trim()} size={150} /></div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </BottomSheet>
  )
}

// Map the thrown reasons from lib/scan.js to something a person can act on.
function scanErrorMessage(e) {
  const m = String(e && e.message)
  if (m === 'permission-denied') return t('Camera permission is needed to scan. Enable it in Settings.')
  if (m === 'unsupported') return t('Scanning is not available on this device.')
  return t('Could not start the scanner')
}
