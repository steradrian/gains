import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'

// The top of an onboarding step: glass back, the progress segments filled up to `step`, and Skip
// when the step is optional. Back and Skip are links with an href, buttons with a callback, and
// hold their place when there is neither, so the segments stay centred.
export default function OnboardingNav({ backHref, onBack, step, total = 8, skipHref, onSkip, skipLabel }) {
  return (
    <div className="g-onav">
      {backHref || onBack
        ? <Act href={backHref} onClick={onBack} ariaLabel={t('Back')} className="g-onav-back g-glass"><Icon name="chevronLeft" className="g-icon" /></Act>
        : <span className="g-onav-sp" />}
      {step
        ? (
          <div className="g-onav-prog" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={t('Step {0} of {1}', step, total)}>
            {Array.from({ length: total }, (_, k) => <i key={k} className={k < step ? 'on' : undefined} />)}
          </div>
        )
        : <span className="g-onav-gap" />}
      {skipHref || onSkip
        ? <Act href={skipHref} onClick={onSkip} className="g-onav-skip">{skipLabel || t('Skip')}</Act>
        : <span className="g-onav-sp" />}
    </div>
  )
}
