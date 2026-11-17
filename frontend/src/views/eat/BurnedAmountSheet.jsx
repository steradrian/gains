import { useState } from 'react'
import { useUI } from '../../store/useUI.js'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import TextField from '../../ds/TextField.jsx'
import { t } from '../../lib/i18n.js'
import { parseAmount, setActivityKcal } from '../../lib/nutrition/activity.js'
import { energyOf } from '../../lib/nutrition/diary.js'
import { energyFromUnit } from '../../lib/nutrition/goals.js'
import { writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { rowLine } from './burned-data.js'
import './burned.css'

// Adds the Burned number to an activity that has none (board Ea7Burned: "Tap it to add one"): the
// Burned field of Log activity on its own, in a half drawer. The row keeps its name, day and
// minutes; only kcal is written.
export default function BurnedAmountSheet({ row, today, close }) {
  const settings = useNutrition(s => s.settings.data)
  const [text, setText] = useState('')
  const [save, setSave] = useState({ state: 'idle', error: null })
  const amount = parseAmount(text)

  const submit = async () => {
    if (amount == null || save.state === 'saving') return
    setSave({ state: 'saving', error: null })
    try {
      await setActivityKcal(row, energyFromUnit(amount, settings))
      close()
    } catch (error) {
      setSave({ state: 'error', error })
    }
  }

  return (
    <BottomSheet
      title={row.name}
      type="half"
      footer={<>
        {save.state === 'error' && <p className="g-bs-note" role="alert">{writeErrorText(save.error)}</p>}
        <Button variant="primary" block haptic disabled={amount == null} busy={save.state === 'saving'} onClick={submit}>{t('Save Burned')}</Button>
      </>}
    >
      <div className="g-act">
        <TextField label={t('Burned')} unit={energyOf(0, settings).unit} inputMode="decimal" hint={rowLine(row, today)} onChange={setText} />
      </div>
    </BottomSheet>
  )
}

/** Opens the Burned number editor for `row` (a burned-data.js row). */
export function burnedAmountSheet(row, today) {
  useUI.getState().openSheet(close => <BurnedAmountSheet row={row} today={today} close={close} />, { variant: 'ds' })
}
