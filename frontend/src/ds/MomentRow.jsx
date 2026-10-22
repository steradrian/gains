import { t } from '../lib/i18n.js'
import Button from './Button.jsx'
import IconButton from './IconButton.jsx'
import MemberAvatar from './MemberAvatar.jsx'
import Tag from './Tag.jsx'

// One moment in a group (board Fr2Group): who it is about as initials, an optional kind tag (NEW
// BEST, Target reached), the title, a detail line with when it happened, and the one thing to do
// with it: a Cheer pill. After a cheer the pill reads Cheered, white and still; taking it back is
// the toast's Undo, not this row. The person's own moments (`mine`) have no pill, because nobody
// cheers themselves. `onMore` adds a ⋯ for the rows someone may remove (Trained together).
// Rows live in a `<ul className="g-mlist g-glass">`. Nothing here counts or ranks: no tallies, no
// comments. Every string comes from the caller except the two pill words, which `cheerText` and
// `cheeredText` can replace; `cheerLabel` is the pill's spoken name ("Cheer Mara finished Legs").
//
// people: [{ uid, initial, tone }] (as MemberAvatar). Several avatars stack, as Trained together.
export default function MomentRow({
  people = [], kind, title, detail, time, cheered = false, mine = false, onCheer, cheerText, cheeredText, cheerLabel, onMore, moreLabel,
}) {
  const sub = [detail, time].filter(Boolean).join(' · ')
  return (
    <li className="g-mrow">
      <span className="g-mavatars">
        {people.map(p => <MemberAvatar key={p.uid} initial={p.initial} tone={p.tone} />)}
      </span>
      <div className="g-mrow-body">
        {kind && <Tag tone="glass">{kind}</Tag>}
        <b>{title}</b>
        {sub && <span className="g-mrow-sub">{sub}</span>}
      </div>
      <div className="g-mrow-end">
        {onMore && <IconButton icon="more" label={moreLabel} tone="glass" onClick={onMore} />}
        {!mine && (cheered
          ? <span className="g-btn g-btn-primary g-btn-sm g-mrow-on">{cheeredText || t('Cheered')}</span>
          : <Button variant="glass" size="sm" haptic aria-label={cheerLabel} onClick={onCheer}>{cheerText || t('Cheer')}</Button>)}
      </div>
    </li>
  )
}
