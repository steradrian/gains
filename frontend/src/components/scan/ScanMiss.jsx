import Button from '../../ds/Button.jsx'
import { t } from '../../lib/i18n.js'
import { formatBarcode } from '../../lib/nutrition/barcode.js'

// A code nobody knows (board Ea9NotFound): add it once and the next scan opens it straight away.
// Three honest variants of the same card: Open Food Facts does not have it, Open Food Facts is off
// in Profile so only your foods were asked, or it has the product but no energy value to log.
// Search foods and Quick kcal are the ways on the old scanner offered; they stay when the opener
// can take them.
export default function ScanMiss({ code, noNutrition, offOn, picking, onCreate, onAgain, onSearch, onQuick }) {
  const title = noNutrition ? t('No energy value for {0}', code)
    : offOn ? t('Not in Open Food Facts yet') : t('Not in your foods yet')
  const body = noNutrition ? t('Open Food Facts lists it without calories, so it cannot be logged from here.')
    : offOn ? t('Add it once with the label in front of you. Next time this barcode opens it straight away.')
      : t('Open Food Facts is off in Profile, so only your foods were checked. Add it once with the label in front of you.')
  return (
    <div className="g-scan-card" role="group" aria-labelledby="g-scan-miss-title">
      <span className="g-scan-card-code" dir="ltr">{formatBarcode(code)}</span>
      <h2 id="g-scan-miss-title" data-step-heading>{title}</h2>
      <p>{body}</p>
      <div className="g-scan-acts-col">
        <Button variant="primary" onClick={onCreate}>{t('Create food with this barcode')}</Button>
        <Button variant="secondary" onClick={onAgain}>{t('Scan again')}</Button>
        {onSearch && <Button variant="ghost" onClick={onSearch}>{t('Search foods')}</Button>}
        {!picking && onQuick && <Button variant="ghost" onClick={onQuick}>{t('Quick kcal')}</Button>}
      </div>
    </div>
  )
}
