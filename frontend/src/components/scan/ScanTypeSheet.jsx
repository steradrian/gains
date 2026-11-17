import { useState } from 'react'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import TextField from '../../ds/TextField.jsx'
import { t } from '../../lib/i18n.js'
import { barcodeProblem } from '../../lib/nutrition/barcode.js'
import { useUI } from '../../store/useUI.js'

// Type the barcode (board Ea9Type): the number under the bars, for a code the camera will not read
// or no camera. Look up stays off until the digits are a barcode, and the line under the field
// says what is wrong with them (the last digit is the check digit the others add up to).
// `onLookUp(raw)` runs after the drawer closes.
export default function ScanTypeSheet({ onLookUp, close }) {
  const [raw, setRaw] = useState('')
  const typed = raw.trim() !== ''
  const problem = barcodeProblem(raw)
  const hint = typed && problem === 'length' ? t('Barcodes are 8 to 14 digits, numbers only.')
    : typed && problem === 'check' ? t('The last digit does not match the others. Check for a typo.')
      : t('The 8 or 13 digits under the bars.')
  const submit = () => {
    if (problem) return
    close()
    onLookUp(raw)
  }
  return (
    <BottomSheet type="auto" title={t('Type the barcode')}
      footer={<Button variant="primary" disabled={!!problem} onClick={submit}>{t('Look up')}</Button>}>
      <TextField label={t('Barcode')} hint={hint} inputMode="numeric" onChange={setRaw}
        inputProps={{ autoComplete: 'off', autoFocus: true, enterKeyHint: 'go', onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); submit() } } }} />
    </BottomSheet>
  )
}

/** The Type the barcode drawer over the Scan overlay. */
export function typeBarcodeSheet({ onLookUp }) {
  useUI.getState().openSheet(close => <ScanTypeSheet onLookUp={onLookUp} close={close} />, { variant: 'ds' })
}
