import { useRadioGroup } from '../lib/onboarding/use-radio-group.js'
import { cx } from '../lib/ui-kit.js'

// How many days a week, on the stage (board O2.8): glass number keys four to a row, the chosen one
// white. One radio group with a roving focus; arrows choose without committing (onPick's viaKey),
// a tap or Enter commits. `labelOf(n)`: a key's spoken name where the digit is not enough.
export default function StageDayCount({ values, value, onPick, labelledBy, labelOf }) {
  const { tabIndexOf, onKeyDown } = useRadioGroup(values, value, onPick)
  return (
    <div className="g-daycount" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {values.map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} tabIndex={tabIndexOf(n)}
          aria-label={labelOf?.(n)} className={cx('g-daycount-k', value === n ? 'on' : 'g-glass')}
          onClick={() => onPick(n, { viaKey: false })}>{n}</button>
      ))}
    </div>
  )
}
