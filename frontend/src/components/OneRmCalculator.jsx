import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { fmtDate, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { estimate1RM, best1RM, REP_CAP, formulaOf, FORMULA_NAMES } from '../lib/onerm.js'
import Stepper from './Stepper.jsx'
import { SectionTitle } from './blocks.jsx'
import { Inline } from './layout.jsx'

// Estimated 1RM for one exercise (issue #18): what the log already implies, plus a calculator
// for a set you have not done, so the number is reachable before there is any history. It left
// the exercise drawer (T6.1) and is placed on the exercise's Progress page (T7.0, under New
// bests) by slice 4's M3. No one-rep max on an assistance machine or for cardio (issue #232):
// the caller leaves it out there.
export default function OneRmCalculator({ ex }) {
  const st = useStore(s => s.S)
  const best = best1RM(st, ex.id)
  const [w, setW] = useState(best ? best.w : (st.exWeights[ex.id] || {}).w || 20)
  const [r, setR] = useState(best ? best.r : 5)
  const est = estimate1RM(w, r, formulaOf(st))
  return <>
    <SectionTitle>{t('Estimated 1RM')}</SectionTitle>
    {best && <div className="small mb-4">
      {t('From your log:')} <b className="accent">{fmtNum(best.est)} {st.unit}</b>
      <span className="dim"> · {t('{0} × {1} on {2}', fmtNum(best.w) + ' ' + st.unit, best.r, fmtDate(best.d, true))}</span>
    </div>}
    <Inline className="cfgrow mb-5">
      <Stepper label={t('Weight ({0})', st.unit)} value={w} step={2.5} onChange={setW} />
      <Stepper label={t('Reps')} value={r} step={1} decimal={false} onChange={setR} />
    </Inline>
    <Inline justify="between" className="mb-2">
      <span className="muted small">{t('Estimate')}</span>
      <b className="accent fs-title3">{est === null ? '–' : fmtNum(est) + ' ' + st.unit}</b>
    </Inline>
    <div className="small dim">{est === null
      ? t('Enter a weight and 1–{0} reps. Beyond that it’s basically guesswork.', REP_CAP)
      : formulaOf(st) === 'weighted'
        ? t('A blend of seven formulas: calculated from one set, not a tested max.')
        : t('{0} formula: calculated from one set, not a tested max.', FORMULA_NAMES[formulaOf(st)])}</div>
  </>
}
