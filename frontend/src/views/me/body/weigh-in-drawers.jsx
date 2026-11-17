import { useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import TextField from '../../../ds/TextField.jsx'
import { dateLocale, t } from '../../../lib/i18n.js'
import { fmtDate, fmtNum } from '../../../lib/format.js'
import { deleteWeighIn, loggedAt, saveWeighIn, undoWeighIn } from '../../../lib/me/weigh-in.js'
import { recordWeighInDelete, recordWeighInEdit } from '../../../lib/me/weigh-in-changes.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { bwSheet, bwTooHeavy } from '../../../sheets.jsx'

// Board Me2LogWeight: Today's Log weight drawer (T1.7, sheets/body-weight.jsx bwSheet), opened as the
// Body page's own: titled Log weight, with the line that a weigh-in already made today is replaced.
export const logWeightSheet = () => bwSheet({ title: t('Log weight') })

const parse = text => Math.round((Number(String(text).trim().replace(',', '.')) || 0) * 10) / 10

// The toast's Undo only while the day still holds what the action left; a newer reading stays.
const undoOrSay = (day, before, left) => {
  if (!undoWeighIn(day, before, left)) useUI.getState().toast(t('Not undone, this day has a newer weigh-in'))
}

function EditWeighIn({ entry, close }) {
  const unit = useStore(s => s.S.unit)
  const [text, setText] = useState(String(entry.w))
  const logged = loggedAt(entry)
  const day = fmtDate(entry.d, true)

  const save = () => {
    const n = parse(text)
    if (!n || n <= 0) { useUI.getState().toast(t('Enter a valid weight')); return }
    if (bwTooHeavy(n, unit)) return
    close()
    // A weight left as it was is not a change: nothing to save, journal or undo.
    if (n === entry.w) return
    const before = saveWeighIn(entry.d, n)
    recordWeighInEdit(before, n, unit)
    useUI.getState().toast(t('Saved {0} to {1}', fmtNum(n) + ' ' + unit, day), { action: t('Undo'), onAction: () => undoOrSay(entry.d, before, n) })
  }

  // No second question: the toast is the way back (board Me2Deleted), for 8 s.
  const remove = () => {
    close()
    const removed = deleteWeighIn(entry.d)
    if (!removed) return
    recordWeighInDelete(removed, unit)
    useUI.getState().toast(t('Deleted {0} from {1}', fmtNum(removed.w) + ' ' + unit, day), { action: t('Undo'), onAction: () => undoOrSay(entry.d, removed, null) })
  }

  return (
    <BottomSheet title={t('Edit weigh-in')} chip={day}
      footer={<>
        <Button block onClick={save}>{t('Save weigh-in')}</Button>
        <Button block variant="danger" onClick={remove}>{t('Delete weigh-in')}</Button>
      </>}>
      <TextField label={t('Weight')} unit={unit} value={String(entry.w)} inputMode="decimal" onChange={setText}
        inputProps={{ enterKeyHint: 'done', onKeyDown: e => { if (e.key === 'Enter') e.currentTarget.blur() } }} />
      {logged && (
        <p className="bd-logged">{t('Logged {0} at {1}', day, logged.time.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }))}</p>
      )}
    </BottomSheet>
  )
}

/** Board Me2EditWeigh: edit or delete one weigh-in. `entry` is `{ d, w, t? }`. */
export const editWeighInSheet = entry =>
  useUI.getState().openSheet(close => <EditWeighIn entry={entry} close={close} />, { variant: 'ds' })
