import GlassValueRow from '../../ds/GlassValueRow.jsx'

/**
 * A group of Settings rows in one glass card (GlassValueRow rows): `rows` is
 * `[{ key, icon, title, sub, value, onClick }]`. A row with no `onClick` is just said. The root's
 * groups, a search's hits and the slots other boards fill all draw through it.
 */
export default function SettingsRows({ rows }) {
  return (
    <div className="g-glist g-glass">
      {rows.map(r => <GlassValueRow key={r.key} icon={r.icon} title={r.title} sub={r.sub} value={r.value} onClick={r.onClick} />)}
    </div>
  )
}
