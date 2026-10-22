import { t } from '../../lib/i18n.js'
import Act from '../../ds/Act.jsx'
import Button from '../../ds/Button.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import IconButton from '../../ds/IconButton.jsx'
import MemberAvatar from '../../ds/MemberAvatar.jsx'
import StageSection from '../../ds/StageSection.jsx'
import Tag from '../../ds/Tag.jsx'

// T1.16, the Friends card on Today: a section with a New tag, then one glass row (who did what,
// the group and its week) with a Cheer pill and the options button. The body opens the group; the
// two controls sit over it as siblings, not inside its button. It draws what useTodayCard() gives
// it and is only mounted when there is something new (never an empty card).
export default function FriendsCard({ avatars, line, groupLine, cheered, labels, onCheer, onOpen, onMenu }) {
  return (
    <>
      <StageSection title={<>{t('Friends')} <Tag tone="glass">{t('New')}</Tag></>} />
      <div className="today-friends">
        <GlassRow
          eyebrow={<span className="g-mavatars">{avatars.map(a => <MemberAvatar key={a.initial} initial={a.initial} tone={a.tone} />)}</span>}
          title={<Act onClick={onOpen} className="today-friends-open">{line}</Act>}
          sub={groupLine}
          trailing={<span className="today-friends-acts">
            {cheered
              ? <Tag tone="glass" icon="check">{labels.cheered}</Tag>
              : <Button size="sm" variant="glass" icon="heart" haptic onClick={onCheer}>{labels.cheer}</Button>}
            <IconButton icon="more" tone="glass" label={labels.menu} onClick={onMenu} />
          </span>}
        />
      </div>
    </>
  )
}
