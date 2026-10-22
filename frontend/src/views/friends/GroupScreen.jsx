import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { friendsErrorText } from '../../lib/friends/api.js'
import { challengeRow, cheerToastText, headerLine, weekCells } from '../../lib/friends/group-copy.js'
import { refreshFriends } from '../../lib/friends/store.js'
import { useGroup } from '../../lib/friends/use-group.js'
import { t, tn } from '../../lib/i18n.js'
import { useUI } from '../../store/useUI.js'
import { groupMenuSheet } from '../../components/GroupMenuSheet.jsx'
import { newChallengeSheet } from '../../components/NewChallengeSheet.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import MemberAvatar from '../../ds/MemberAvatar.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageWeekCells from '../../ds/StageWeekCells.jsx'
import GroupMoments from './GroupMoments.jsx'
import GroupWeek from './GroupWeek.jsx'
import { GROUPS_PATH } from './me-rows.js'

const toast = (msg, opts) => useUI.getState().toast(msg, opts)

/**
 * /me/groups/:id (boards Fr2Group, Fr2Cheered, Fr2NoActivity, Fr2Muted): the group's week as one
 * ring, the week together, challenges and moments, with Cheer on each other person's moment and a
 * ⋯ for the Group menu. It draws lib/friends/use-group (refetched on mount, focus and every 60 s)
 * and writes through it. A 404 means the person is no longer in the group: the page leaves for
 * Groups with a toast, it never stays up stale.
 */
export default function GroupScreen() {
  const { id } = useParams()
  const nav = useNavigate()
  const { group, status, stale, cheer, uncheer, mute, removeMoment } = useGroup(id)

  useEffect(() => {
    if (status !== 'gone') return
    toast(t("You're no longer in this group"))
    refreshFriends()
    nav(GROUPS_PATH, { replace: true })
  }, [status, nav])

  const fail = () => toast(friendsErrorText())

  const takeBack = async moment => {
    try { await uncheer(moment.id) } catch { fail() }
  }
  // The pill turns at once (cheer() changes the group before it awaits), the toast offers Undo for
  // 8 s, and a refused request puts the pill back and says so in place of the toast.
  const onCheer = async moment => {
    const sent = cheer(moment.id)
    toast(cheerToastText(group, moment), { action: t('Undo'), onAction: () => takeBack(moment) })
    try { await sent } catch { fail() }
  }
  const onRemove = async moment => {
    try { await removeMoment(moment.id) } catch { fail() }
  }
  const unmute = async member => {
    try { await mute(member.uid, false) } catch { fail() }
  }

  if (!group) {
    return (
      <StagePage parent={GROUPS_PATH}>
        {status === 'error' && (
          <StageEmpty illustration="search" card={false} title={t("Can't load this group")} body={t('Check your connection, then open it again.')} />
        )}
      </StagePage>
    )
  }

  const muted = group.members.filter(m => m.muted)
  const cells = weekCells(group)
  const actions = [{ icon: 'more', label: t('Group options'), onClick: () => groupMenuSheet(group) }]

  return (
    <StagePage parent={GROUPS_PATH} largeTitle={group.name} sub={headerLine(group)} actions={actions}>
      {stale && (
        <div className="g-sp-card">
          <InlineBanner stage tone="muted" icon="wifiOff" title={t("Can't reach the server, showing the last update")} />
        </div>
      )}

      <GroupWeek group={group} />

      {muted.map(m => (
        <div key={m.uid} className="g-sp-card">
          <InlineBanner stage tone="muted" icon="bellSlash"
            title={t('You muted {0}. Their moments are hidden; they still count toward the goal.', m.name)}
            actions={[{ label: t('Unmute'), onClick: () => unmute(m) }]} />
        </div>
      ))}

      {!group.quiet && cells.length > 0 && (
        <>
          <StageSection title={t('This week together')} action={group.streak > 0 ? tn('{0} week hit', '{0} weeks hit', group.streak) : undefined} />
          <div className="g-sp-card">
            <StageWeekCells days={cells} food={false} legend={false} label={t('This week together')} />
          </div>
          <StageNote>
            {group.members.length > 1 ? t('Dots are workouts logged that day by anyone in the group.') : t('Dots are workouts you logged that day.')}
          </StageNote>
        </>
      )}

      <StageSection title={t('Challenges')} action={t('New')} onAction={() => newChallengeSheet(group.id)} />
      {group.challenges.length > 0 && (
        <div className="g-fgroups g-sp-card">
          {group.challenges.map(ch => {
            const row = challengeRow(group, ch)
            return (
              <GlassRow key={row.id} eyebrow={row.dates} title={row.title} sub={row.progress}
                trailing={<span className="g-mavatars">{row.people.map(p => <MemberAvatar key={p.uid} initial={p.initial} tone={p.tone} />)}</span>}
                onClick={() => nav(GROUPS_PATH + '/' + encodeURIComponent(group.id) + '/challenge/' + encodeURIComponent(row.id))} />
            )
          })}
        </div>
      )}

      <GroupMoments group={group} onCheer={onCheer} onRemove={onRemove} />
    </StagePage>
  )
}
