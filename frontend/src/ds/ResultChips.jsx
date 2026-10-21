import { dateLocale, t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'

// The counts per kind over the results (bundle.js `ResultChips`, boards Sh0Results, Sh0TurnOn):
// one glass chip a kind, the count in bold before its noun; tapping one scopes the search to it.
// `items` are lib/search/results.js summaryOf's { group, count, text, noun } ("1,200 workouts" and
// "workouts", already translated with its plural); `active` the group shown alone, lit white. The
// chip's name says what it does with the counted words, never a bare number.
export default function ResultChips({ items, active, onSelect }) {
  if (!items.length) return null
  return (
    <nav className="g-rchips" aria-label={t('Results by kind')}>
      {items.map(c => {
        const on = active === c.group
        return (
          <button key={c.group} type="button" className={cx('g-rchip', on ? 'on' : 'g-glass')} aria-pressed={on}
            onClick={() => onSelect?.(c.group)} aria-label={t('{0}, show only these', c.text)}>
            <b>{c.count.toLocaleString(dateLocale())}</b><span>{c.noun}</span>
          </button>
        )
      })}
    </nav>
  )
}
