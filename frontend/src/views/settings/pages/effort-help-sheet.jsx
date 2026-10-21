import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'

// The two scales are one judgement counted from opposite ends, and a paragraph is a bad way to say
// that: the conversion table shows it in one look. Reading down a column is the answer to "what do
// I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left, went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy, warm-up territory'],
]
// RIR 2 / RPE 8: the row a working set usually lands on, the anchor the others are read against.
const EFFORT_TYPICAL = 2

export function EffortHelpSheet() {
  return (
    <BottomSheet title={t('Effort per set')}>
      <div className="set-eff">
        <p>{t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}</p>
        <table>
          <thead>
            <tr><th scope="col">{t('RIR')}</th><th scope="col">{t('RPE')}</th><th scope="col">{t('How it felt')}</th></tr>
          </thead>
          <tbody>
            {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
              <tr key={rir} className={i === EFFORT_TYPICAL ? 'on' : undefined}><td>{rir}</td><td>{rpe}</td><td>{t(feel)}</td></tr>
            ))}
          </tbody>
        </table>
        <p>{t('RIR counts the reps you left in the tank; RPE reads the same effort off a 10-point scale, so RPE ≈ 10 − RIR. Pick whichever you already think in.')}</p>
        <p>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value, so progression and estimated 1RM are unaffected.')}</p>
      </div>
    </BottomSheet>
  )
}

export const openEffortHelpSheet = () => useUI.getState().openSheet(() => <EffortHelpSheet />, { variant: 'ds' })
