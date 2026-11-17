import { useNavigate } from 'react-router-dom'
import { cheersForMeText, momentKind, momentPeople, momentTime } from '../../lib/friends/group-copy.js'
import { t } from '../../lib/i18n.js'
import { inviteSheet } from '../../components/InviteSheet.jsx'
import { momentMenuSheet } from '../../components/MomentMenuSheet.jsx'
import MomentRow from '../../ds/MomentRow.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StageSection from '../../ds/StageSection.jsx'

// The part of the group page below the week where moments go (boards Fr2Group, Fr2NoActivity): the
// moments of the last 7 days with a Cheer on each other person's, or, in their place, Quiet so far
// (a new week with nothing logged) or an Invite when the group is just you. Muted members' moments
// are already absent from the payload. `onCheer(moment)` and `onRemove(moment)` are the page's.
export default function GroupMoments({ group, onCheer, onRemove }) {
  const nav = useNavigate()

  if (group.members.length === 1) {
    return (
      <StageEmpty illustration="dumbbell" card={false} title={t('Just you so far')}
        body={t('Invite a friend and their workouts show up here, in the same ring as yours.')}
        actions={[{ label: t('Invite'), onClick: () => inviteSheet(group.id), solid: true }]} />
    )
  }
  if (group.quiet) {
    return (
      <StageEmpty illustration="calendar" card={false} title={t('Quiet so far')}
        body={t('A new week started this morning. The first workout anyone logs shows up here, and the ring starts to fill.')} />
    )
  }
  return (
    <>
      <StageSection title={t('Moments')} action={group.cheersForMe > 0 ? cheersForMeText(group.cheersForMe) : undefined}
        onAction={() => nav('/me/groups/cheers')} />
      {group.moments.length > 0 && (
        <ul className="g-mlist g-glass">
          {group.moments.map(m => (
            <MomentRow key={m.id}
              people={momentPeople(group, m)}
              kind={momentKind(m.kind)}
              title={m.title}
              detail={m.detail}
              time={momentTime(m.at)}
              cheered={!!m.cheered}
              mine={!!m.mine}
              cheerLabel={t('Cheer {0}', m.title)}
              onCheer={() => onCheer(m)}
              onMore={m.kind === 'together' ? () => momentMenuSheet(m.title, () => onRemove(m)) : undefined}
              moreLabel={t('Options for {0}', m.title)} />
          ))}
        </ul>
      )}
      <StageNote>{t('One tap cheers. No comments, no counts of likes. Moments go after 7 days.')}</StageNote>
    </>
  )
}
