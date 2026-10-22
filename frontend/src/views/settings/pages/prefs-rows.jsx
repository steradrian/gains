import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'

// Rows of a Settings card with their control at the end. The row is a plain div (nothing opens);
// the control is the only thing to tap, and the caller names it for a screen reader.

/** A card of rows: `.g-glist.g-glass` in the page's 16px gutter. */
export function Card({ children }) {
  return <div className="g-sp-card"><div className="g-glist g-glass">{children}</div></div>
}

/** `{ icon, title, sub, checked, onChange, disabled }` with a StageSwitch named by the title. */
export function SwitchRow({ icon, title, sub, checked, onChange, disabled }) {
  return <GlassValueRow static icon={icon} title={title} sub={sub}
    trailing={<StageSwitch label={title} checked={checked} onChange={onChange} disabled={disabled} />} />
}

/** `{ icon, title, sub, options, value, onChange }` with a StageSegmented named by the title. */
export function SegmentedRow({ icon, title, sub, options, value, onChange }) {
  return <GlassValueRow static icon={icon} title={title} sub={sub}
    trailing={<div className="g-sp-seg"><StageSegmented label={title} options={options} value={value} onChange={onChange} /></div>} />
}
