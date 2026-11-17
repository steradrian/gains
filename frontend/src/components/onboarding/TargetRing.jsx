import { t } from '../../lib/i18n.js'
import { useCount } from '../../lib/onboarding/use-count.js'
import { kcalText } from '../../lib/onboarding/use-target.js'

// The live target on About you (§3b; boards O2.4–O2.7): the glass status row, its small ring
// filling a quarter per body answer, the range narrowing, and with all four in it firms up to the
// hub's number. The row is not read out while it counts; `say` is what a screen reader hears
// instead, once per settled answer (a polite live region beside it).
const R = 15
const C = 2 * Math.PI * R

export default function TargetRing({ target, say = '' }) {
  const firm = target.exact != null
  const lo = useCount(firm ? target.exact : target.lo, firm ? 640 : 320)
  const hi = useCount(firm ? target.exact : target.hi, firm ? 640 : 320)
  const number = firm ? kcalText(lo)
    : Math.round(lo) === Math.round(hi) ? t('≈ {0}', kcalText(lo))
      : t('≈ {0}–{1}', kcalText(lo), kcalText(hi))
  const unit = firm ? t('kcal a day, your starting target')
    : target.answered === 0 ? t('kcal a day, a typical range')
      : target.answered === 4 ? t('kcal a day, an estimate')
        : t('kcal a day · sharpens with each answer')
  return (
    <div className="ob-tgt-wrap">
      <div className="ob-tgt g-glass" aria-hidden="true">
        <svg className="ob-tgt-ring" viewBox="0 0 40 40" width="40" height="40" focusable="false">
          <circle className="ob-ring-bg" cx="20" cy="20" r={R} />
          <circle className="ob-ring-fg" cx="20" cy="20" r={R} strokeDasharray={C.toFixed(1)}
            strokeDashoffset={(C * (1 - target.answered / 4)).toFixed(1)} transform="rotate(-90 20 20)" />
        </svg>
        <span className="ob-tgt-t">
          <span className="ob-tgt-n">{number}</span>
          <span className="ob-tgt-u">{unit}</span>
        </span>
      </div>
      <p className="sr-only" aria-live="polite">{say}</p>
    </div>
  )
}
