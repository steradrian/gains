import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { fmtDate } from '../../../lib/format.js'
import { CHECKIN_NOTE_MAX, checkInFor, checkInWeek, saveCheckIn } from '../../../lib/coach-checkin.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import TextField from '../../../ds/TextField.jsx'
import '../coach-pages.css'
import './coach-page.css'

// The weekly check-in (T11.1, owner question 7): how the week felt, how you slept, a note. It is
// filed under this week and read by the next review; saving sends nothing. This week's check-in
// opens filled in, to be changed. Send closes the drawer first, then the toast (T11.2) offers Undo,
// which puts back what the week held before.
export default function CheckInDrawer({ close }) {
  const S = useStore(s => s.S)
  const [week] = useState(() => checkInWeek(S))
  const [was] = useState(() => checkInFor(S))
  const [feel, setFeel] = useState(was?.feel ?? null)
  const [sleep, setSleep] = useState(was?.sleep ?? null)
  const [note, setNote] = useState(was?.note || '')

  const send = () => {
    if (!feel) return
    let undo = null
    useStore.getState().update(s => { undo = saveCheckIn(s, week, { feel, sleep, note }) })
    close()
    useUI.getState().toast(t('Noted. See you next session.'), {
      action: t('Undo'),
      onAction: () => { if (undo) useStore.getState().update(s => undo(s)) },
    })
  }

  const FEEL = [
    { value: 'easy', label: t('Too easy') },
    { value: 'right', label: t('Just right') },
    { value: 'hard', label: t('Hard') },
    { value: 'much', label: t('Too much') },
  ]
  const SLEEP = [
    { value: 'poor', label: t('Poor') },
    { value: 'ok', label: t('OK') },
    { value: 'good', label: t('Good') },
  ]

  return (
    <BottomSheet title={t('Check in')} chip={t('Week of {0}', fmtDate(week))}
      footer={<Button block disabled={!feel} onClick={send}>{t('Send check-in')}</Button>}>
      <p className="tcp-dnote">{t('How did this week go? Coach reads it before planning next week.')}</p>
      <ChipGroup label={t('How the week felt')} options={FEEL} value={feel} onChange={setFeel} />
      <p className="tco-dlabel">{t('Sleep')}</p>
      <ChipGroup label={t('Sleep')} options={SLEEP} value={sleep} onChange={setSleep} />
      <TextField wide label={t('Anything else? (optional)')} value={note} onChange={setNote} inputProps={{ maxLength: CHECKIN_NOTE_MAX }} />
    </BottomSheet>
  )
}

/** Opens T11.1 over the Coach page. */
export const checkInSheet = () => useUI.getState().openSheet(close => <CheckInDrawer close={close} />, { variant: 'ds' })
