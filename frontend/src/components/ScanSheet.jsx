import { useEffect, useRef, useState } from 'react'
import { dsAccentFor } from '../lib/ds-accent.js'
import { t } from '../lib/i18n.js'
import { findByBarcode, normalizeBarcode } from '../lib/nutrition/barcode.js'
import { writeErrorText } from '../lib/nutrition/log-feedback.js'
import { asksQuantity, logServing } from '../lib/nutrition/log-serving.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { beep } from '../lib/sound.js'
import { useCameraScan } from '../lib/use-camera-scan.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { foodEditSheet } from './FoodEditSheet.jsx'
import { portionSheet } from './PortionSheet.jsx'
import { quickKcalSheet } from './QuickKcalSheet.jsx'
import { leaveTo, newFoodPath } from './log-food/leave-drawer.js'
import ScanDenied from './scan/ScanDenied.jsx'
import ScanFinder from './scan/ScanFinder.jsx'
import ScanFound from './scan/ScanFound.jsx'
import ScanLooking from './scan/ScanLooking.jsx'
import ScanMiss from './scan/ScanMiss.jsx'
import ScanReading from './scan/ScanReading.jsx'
import ScanTop from './scan/ScanTop.jsx'
import { typeBarcodeSheet } from './scan/ScanTypeSheet.jsx'

// What a failed lookup tells the person (not a miss: nobody said the product does not exist).
function lookupErrorText(e) {
  if (e?.code === 'offline' || e?.code === 'timeout') return t('The lookup did not go through: no connection.')
  if (e?.status === 429) return t('Too many lookups. Wait a minute and try again.')
  if (e?.status === 401) return t('The lookup did not go through: you are signed out.')
  return t('The lookup did not go through. Try again.')
}

// Scan a product (boards Ea9*): the dark full-screen camera over whatever opened it, then log the
// product the way a food from the picker is logged (Amount, or one serving), or keep it as one of
// your foods. It opens as a viewer (store/useUI.js), over a page or a drawer, and the × closes it
// back to where it opened: nothing navigates. `step` is one of
//   scan     the camera reading, and a way to type the code (Type the barcode is a drawer over this)
//   looking  asking your foods, then Open Food Facts
//   found    a product from Open Food Facts: Log, or Save food
//   miss     no product for the code, or no energy value to log it with: Create food, Scan again
//   error    the lookup itself failed: Try again
// One of your own foods ends the flow at once: it opens Amount like any result. The camera being
// blocked or missing is a screen of its own over `scan`.
// `onSearch` runs after the overlay closes when the person chooses Search foods.
// With `onPick` (a picker that wants the food, not a log: a recipe's ingredient) the found product
// is handed to it after the overlay closes, and nothing is logged or saved from here.
// `preview` (the screens gallery): start on this step without a camera, `{ step, camera }`.
export default function ScanSheet({ date, meal, mealName, onLogged, onSearch, onPick, close, preview }) {
  const lang = useNutrition(s => s.settings.data?.offSearchLanguage)
  const beepOn = useNutrition(s => settingOf(s.settings.data, 'barcodeBeep'))
  const offOn = useNutrition(s => settingOf(s.settings.data, 'offEnabled'))
  const accent = useStore(s => dsAccentFor(s.S))
  const [step, setStep] = useState(preview?.step ?? { id: 'scan' })
  const [notice, setNotice] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const alive = useRef(true)
  const video = useRef(null)
  const rootRef = useRef(null)
  const first = useRef(true)
  const scanning = step.id === 'scan'

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const camera = useCameraScan({
    video, enabled: scanning && !preview, product: true,
    onFound: hit => { beep(beepOn, 1040, 0.12); submit(hit.value) },
  })
  const cameraError = preview ? preview.camera ?? null : camera.error

  // A found product is logged as picked: asking how much first, unless Profile says not to.
  const log = food => {
    close()
    if (onPick) onPick(food)
    else if (asksQuantity(useNutrition.getState().settings.data)) portionSheet({ food, date, meal, mealName, onLogged })
    else logServing(food, { date, meal, mealName, onLogged })
  }

  async function lookUp(code) {
    setStep({ id: 'looking', code })
    try {
      const found = await findByBarcode(code, { lang: typeof lang === 'string' ? lang : 'en' })
      if (!alive.current) return
      if (found.kind === 'own') log(found.food)
      else if (found.kind === 'online') setStep({ id: 'found', code, food: found.food })
      else setStep({ id: 'miss', code, noNutrition: found.kind === 'no-nutrition' })
    } catch (e) {
      if (alive.current) setStep({ id: 'error', code, text: lookupErrorText(e) })
    }
  }

  function submit(raw) {
    const code = normalizeBarcode(raw)
    if (!code) {
      // The reader let go of the camera with the code; ask for it again.
      setNotice(t('That is not a product barcode.'))
      camera.retry()
      return
    }
    setNotice(null)
    setSaved(false)
    setSaveError(null)
    lookUp(code)
  }

  const again = () => { setNotice(null); setStep({ id: 'scan' }) }
  const typeCode = () => typeBarcodeSheet({ onLookUp: submit })
  const search = () => { close(); if (onSearch) onSearch() }
  const quick = () => { close(); quickKcalSheet({ date, meal, mealName, onLogged }) }
  // The food editor with the scanned code in its Barcode field, so the next scan opens the food. A
  // picker that wants the food (`onPick`) keeps its sheet instead of a page. The page takes the
  // overlay's, and any drawer's, history entries (leaveTo).
  const create = code => {
    if (onPick) { close(); foodEditSheet({ food: { barcode: code }, settings: useNutrition.getState().settings.data, onSaved: onPick }); return }
    leaveTo(() => useUI.getState().closeAll(), newFoodPath, { prefill: { barcode: code } })
  }
  async function save() {
    if (busy || step.id !== 'found') return
    setBusy(true)
    setSaveError(null)
    try {
      const keep = await useNutrition.getState().saveFood(step.food)
      if (!alive.current) return
      setSaved(true)
      // What is logged next is the saved copy, not a second record of the same product.
      if (keep) setStep(s => (s.id === 'found' ? { ...s, food: keep } : s))
      useUI.getState().toast(t('Saved to your foods'))
    } catch (e) {
      if (alive.current) setSaveError(writeErrorText(e))
    }
    if (alive.current) setBusy(false)
  }

  // Each step has one heading line (marked data-step-heading). It takes focus when the step
  // changes, so a screen reader hears the new step, not silence.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const el = rootRef.current?.querySelector('[data-step-heading]')
    if (!el) return
    el.tabIndex = -1
    el.focus({ preventScroll: true })
  }, [step.id])

  return (
    <div className="g-root g-scan" data-accent={accent} role="dialog" aria-modal="true" aria-label={t('Scan a barcode')} tabIndex={-1} ref={rootRef}>
      <div className="g-scan-cam" aria-hidden="true">
        {scanning && !preview && <video ref={video} playsInline muted autoPlay />}
        {preview && <span className="g-scan-still"><span /><span /></span>}
      </div>
      {scanning && cameraError
        ? <>
            <ScanDenied reason={cameraError} onType={typeCode} onRetry={camera.retry} />
            <ScanTop bare onClose={close} />
          </>
        : <>
            {step.id !== 'looking' && step.id !== 'error' && <ScanFinder line={scanning} />}
            <ScanTop onClose={close} torch={scanning ? camera.torch : null} />
            {scanning && <ScanReading notice={notice} onType={typeCode} />}
            {step.id === 'looking' && <ScanLooking code={step.code} />}
            {step.id === 'error' && <ScanLooking code={step.code} error={step.text} onRetry={() => lookUp(step.code)} onAgain={again} />}
            {step.id === 'found' && <ScanFound food={step.food} mealName={mealName} picking={!!onPick} saved={saved} busy={busy} error={saveError}
              onLog={() => log(step.food)} onSave={save} onAgain={again} />}
            {step.id === 'miss' && <ScanMiss code={step.code} noNutrition={step.noNutrition} offOn={offOn} picking={!!onPick}
              onCreate={() => create(step.code)} onAgain={again} onSearch={onSearch ? search : undefined} onQuick={quick} />}
          </>}
    </div>
  )
}

export function scanSheet(props) {
  useUI.getState().openSheet(close => <ScanSheet {...props} close={close} />, { kind: 'viewer' })
}
