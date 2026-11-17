import { useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'
import { ACTIVITY_OPTIONS } from '../../lib/onboarding/labels.js'
import { useRadioGroup } from '../../lib/onboarding/use-radio-group.js'
import { useSheetClosed } from '../presence.jsx'
import { SheetHeader } from '../sheet-layout.jsx'

// The Summary's activity chip (board O2.12d, in the app's own sheet until the light drawer comes
// app-wide): what a day is mostly, one answer the hub takes and the target is worked out from
// again. A tap picks and closes; arrow keys choose without closing. The choice shows in the
// Summary at once (`onPick`); the hub is told once, when the sheet goes (`onDone`, and only if
// something was picked).
export default function DaySheet({ value: start, onPick, onDone, close }) {
  const [value, setValue] = useState(start)
  const picked = useRef(false)
  // The Summary's `onDone` only calls the flow's stable save, so the first one is the one to keep.
  const done = useRef(onDone)
  useSheetClosed(() => { if (picked.current) done.current() })
  const options = ACTIVITY_OPTIONS()
  const pick = (v, { viaKey }) => {
    picked.current = true
    setValue(v)
    onPick(v)
    if (!viaKey) close()
  }
  const { tabIndexOf, onKeyDown } = useRadioGroup(options.map(o => o.value), value, pick)
  return <>
    <SheetHeader title={t('Your day is mostly')} onClose={close} />
    <p className="ob-sheet-text">{t('It sets what you burn outside training.')}</p>
    <div className="ob-radios" role="radiogroup" aria-label={t('Your day is mostly')} onKeyDown={onKeyDown}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" className="ob-radio" aria-checked={value === o.value}
          tabIndex={tabIndexOf(o.value)} onClick={() => pick(o.value, { viaKey: false })}>
          <span className="ob-radio-t"><b>{o.title}</b><span>{o.sub}</span></span>
          <span className="ob-radio-dot" aria-hidden="true" />
        </button>
      ))}
    </div>
  </>
}
