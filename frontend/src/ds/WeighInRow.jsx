import GlassRow from './GlassRow.jsx'
import Tag from './Tag.jsx'

// One weigh-in in the Body page's list (board Me2Body): the weight, the day under it, and as the
// row's trailing control a tag with the change from the weigh-in before ("−0.3 kg") and, for a
// weigh-in made offline, a second one ("Waiting to sync"). A GlassRow, so the whole row is the
// button that opens the Edit weigh-in drawer. All text comes from the caller; without `onClick`
// it is a plain row.
export default function WeighInRow({ weight, date, change, waiting, onClick }) {
  const trailing = (change || waiting) && (
    <span className="g-wir-tags">
      {change && <Tag tone="glass">{change}</Tag>}
      {waiting && <Tag tone="glass" icon="cloudSlash">{waiting}</Tag>}
    </span>
  )
  return <GlassRow title={weight} sub={date} trailing={trailing || undefined} onClick={onClick} />
}
