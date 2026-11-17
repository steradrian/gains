import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { THEMES } from '../lib/themes.js'
import { useRadioGroup } from '../lib/onboarding/use-radio-group.js'
import { haptic as buzz } from '../lib/use-haptic.js'

// The accent colours as a radio group (design system `AccentPicker`, bundle.js): a round swatch
// filled from the theme's --X-fill to --X-fill-end, its name under it, a check on the lit one,
// five to a row. `value` is a lib/themes.js id (the resolved accent, so an accent nobody picked
// shows the mode's default as lit) and `onChange(id)` hears every pick, by tap or by arrow key.
// The lit swatch is the only tab stop; the arrow keys move the choice and the focus. A pick ticks
// (`haptic={false}` for a preview). `label` names the group for a screen reader and comes from the
// caller through t().
const IDS = THEMES.map(p => p.id)

export default function AccentPicker({ value, onChange, label, haptic = true }) {
  const pick = id => {
    if (haptic) buzz('selection')
    onChange?.(id)
  }
  const { tabIndexOf, onKeyDown } = useRadioGroup(IDS, value, pick)
  return (
    <div className="g-apick" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {THEMES.map(p => {
        const on = p.id === value
        return (
          <button key={p.id} type="button" role="radio" aria-checked={on} tabIndex={tabIndexOf(p.id)}
            className="g-apick-item" onClick={() => pick(p.id)}>
            <span className="g-apick-sw" aria-hidden="true"
              style={{ '--sw': `linear-gradient(135deg, var(--${p.id}-fill), var(--${p.id}-fill-end))`, '--sw-on': `var(--${p.id}-on)` }}>
              {on && <Icon name="check" className="g-icon" />}
            </span>
            <span className="g-apick-name">{t(p.name)}</span>
          </button>
        )
      })}
    </div>
  )
}
