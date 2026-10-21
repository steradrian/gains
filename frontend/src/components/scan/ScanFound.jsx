import Button from '../../ds/Button.jsx'
import Tag from '../../ds/Tag.jsx'
import { t } from '../../lib/i18n.js'
import { foodKcal } from '../../lib/nutrition/diary.js'
import { fmtAmount } from '../../lib/nutrition/foods.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import Icon from '../Icon.jsx'

// A product Open Food Facts knows (board Ea9Found): its energy and macros per serving, Log to the
// meal the opener names (or Use, for a picker that wants the food itself), and Save food to keep it
// in My foods. One of your own foods never lands here: it goes straight to Amount.
export default function ScanFound({ food, mealName, picking, saved, busy, error, onLog, onSave, onAgain }) {
  const units = useUnits()
  const n = food.nutrition || {}
  const macro = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? '–' : fmtAmount(Math.round(Number(v))))
  const stats = [
    { key: 'kcal', value: units.energyValue(foodKcal(food)), label: units.energyUnit },
    { key: 'p', value: macro(n.proteins), label: `${t('Protein')} g` },
    { key: 'c', value: macro(n.carbohydrates), label: `${t('Carbs')} g` },
    { key: 'f', value: macro(n.fat), label: `${t('Fat')} g` },
  ]
  return (
    <div className="g-scan-card" role="group" aria-labelledby="g-scan-found-name">
      <div className="g-scan-prod">
        <span className="g-scan-prod-ic" aria-hidden="true"><Icon name="apple" className="g-icon" /></span>
        <span className="g-scan-prod-t">
          <b id="g-scan-found-name" data-step-heading>{food.name}</b>
          <span>{[food.brand, `${food.portion || 100} ${food.unit || 'g'}`, units.energy(foodKcal(food))].filter(Boolean).join(' · ')}</span>
        </span>
        <Tag tone="muted">{t('Online')}</Tag>
      </div>
      <div className="g-scan-stats">
        {stats.map(s => (
          <div key={s.key} className="g-scan-stat">
            <b>{s.value}</b>
            <span><i className={'g-scan-dot g-scan-dot-' + s.key} />{s.label}</span>
          </div>
        ))}
      </div>
      {error && <p className="g-lf-note g-lf-err" role="alert">{error}</p>}
      <div className="g-scan-acts">
        {!picking && <Button variant="secondary" busy={busy} disabled={saved} onClick={onSave}>{saved ? t('Saved') : t('Save food')}</Button>}
        <Button variant="primary" onClick={onLog}>{picking ? t('Use') : mealName ? t('Log to {0}', mealName) : t('Log')}</Button>
      </div>
      <Button variant="ghost" onClick={onAgain}>{t('Scan another')}</Button>
    </div>
  )
}
