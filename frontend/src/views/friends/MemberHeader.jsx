import { t } from '../../lib/i18n.js'
import { sinceLine } from '../../lib/friends/member-view.js'
import Button from '../../ds/Button.jsx'
import MemberAvatar from '../../ds/MemberAvatar.jsx'

/**
 * The top of the Member page (board Fr2Member): the person's initial, name and "In Iron Sunday
 * since August", and the Cheer pill that cheers their whole week. On your own page there is no
 * pill (you do not cheer yourself). A cheered week shows "Cheered", already pressed: the toast's
 * Undo is the way back, so the pill does nothing a second time.
 */
export default function MemberHeader({ member, groupName, tone, you, onCheer }) {
  const cheered = member.cheered === true
  return (
    <header className="g-spage-head g-mhead">
      <MemberAvatar initial={member.name} size="lg" tone={tone} />
      <div className="g-mhead-text">
        <h1 className="g-spage-title">{member.name}</h1>
        <p className="g-spage-sub">{sinceLine(groupName, member.since)}</p>
      </div>
      {!you && (
        <Button variant="glass" size="sm" icon={cheered ? 'check' : 'heart'} haptic={!cheered} aria-pressed={cheered}
          aria-label={cheered ? t("Cheered {0}'s week", member.name) : t("Cheer {0}'s week", member.name)}
          onClick={cheered ? undefined : onCheer}>
          {cheered ? t('Cheered') : t('Cheer')}
        </Button>
      )}
    </header>
  )
}
