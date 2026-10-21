import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'

// Water as glasses that fill (bundle.js `WaterGlasses`): one per `step` litres up to `target`,
// and a white + that adds one. Controlled when it has both `value` and `onAdd(litres)` (the new
// total); otherwise it keeps its own count, up to the target. Pick a step that keeps the row to
// twelve glasses or fewer: raise the step, not the count.
export default function WaterGlasses({ value, target = 2.5, step = 0.25, onAdd, href }) {
  const [own, setOwn] = useState(value ?? 0)
  const litres = onAdd && value != null ? value : own
  const glasses = Math.max(1, Math.round(target / step))
  const filled = Math.min(glasses, Math.round(litres / step))
  const add = () => {
    const next = +(litres + step).toFixed(3)
    setOwn(Math.min(target, next))
    onAdd?.(next)
  }
  return (
    <div className="g-water g-glass" role="group" aria-label={t('Water, {0} of {1} L', litres, target)}>
      <div className="g-water-g" aria-hidden="true">
        {Array.from({ length: glasses }, (_, k) => <i key={k} className={k < filled ? 'on' : undefined} />)}
      </div>
      <Act href={href} onClick={add} ariaLabel={t('Add {0} ml of water', Math.round(step * 1000))} className="g-water-add">
        <Icon name="plus" className="g-icon" />
      </Act>
    </div>
  )
}
