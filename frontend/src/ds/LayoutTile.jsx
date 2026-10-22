import { cx, oneOf } from '../lib/ui-kit.js'

const LAYOUTS = ['cards', 'list', 'compact', 'focus']

// What each workout layout looks like, drawn small (board St1Workout): not a screenshot, so it
// follows the stage's colours. Cards is one exercise with its sets, List the whole session stacked,
// Compact the same stripped to names and set marks, Focus one big set at a time.
const PREVIEW = {
  cards: (
    <>
      <rect x="7" y="4" width="42" height="30" rx="5" opacity=".28" />
      <rect x="12" y="9" width="20" height="3" rx="1.5" />
      <rect x="12" y="16" width="32" height="4" rx="2" opacity=".6" />
      <rect x="12" y="23" width="32" height="4" rx="2" opacity=".6" />
      <circle cx="23" cy="39" r="1.5" />
      <circle cx="28" cy="39" r="1.5" opacity=".4" />
      <circle cx="33" cy="39" r="1.5" opacity=".4" />
    </>
  ),
  list: (
    <>
      <rect x="7" y="4" width="42" height="11" rx="3.5" opacity=".28" />
      <rect x="7" y="18" width="42" height="11" rx="3.5" opacity=".28" />
      <rect x="7" y="32" width="42" height="9" rx="3.5" opacity=".28" />
      <rect x="11" y="8" width="16" height="3" rx="1.5" />
      <rect x="11" y="22" width="16" height="3" rx="1.5" />
      <rect x="11" y="35.5" width="16" height="3" rx="1.5" />
    </>
  ),
  compact: (
    <>
      {[5, 12, 19, 26, 33].map(y => (
        <g key={y}>
          <rect x="8" y={y} width="18" height="3" rx="1.5" />
          <rect x="32" y={y} width="4" height="3" rx="1.5" opacity=".6" />
          <rect x="38" y={y} width="4" height="3" rx="1.5" opacity=".6" />
          <rect x="44" y={y} width="4" height="3" rx="1.5" opacity=".6" />
        </g>
      ))}
    </>
  ),
  focus: (
    <>
      <rect x="20" y="5" width="16" height="3" rx="1.5" opacity=".6" />
      <rect x="14" y="14" width="28" height="14" rx="4" />
      <rect x="18" y="34" width="20" height="5" rx="2.5" opacity=".6" />
    </>
  ),
}

// A selectable picture of a layout (the Layout choice on Workout screen). One of a group the caller
// wraps in `<div role="radiogroup" aria-label={…}>`: it is a radio, announced as checked when
// `selected`, and choosing applies at once. `label` is the caller's, and is its spoken name.
// `tabIndex` lets the group make only the selected tile a tab stop.
export default function LayoutTile({ layout, label, selected = false, onClick, tabIndex }) {
  oneOf('LayoutTile', 'layout', layout, LAYOUTS)
  return (
    <button type="button" role="radio" aria-checked={selected} tabIndex={tabIndex} onClick={onClick} className={cx('g-ltile g-glass', selected && 'on')}>
      <svg viewBox="0 0 56 44" width="56" height="44" aria-hidden="true" focusable="false" fill="currentColor">{PREVIEW[layout]}</svg>
      <span>{label}</span>
    </button>
  )
}
