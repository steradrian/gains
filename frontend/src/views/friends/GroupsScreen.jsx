import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { todayISO } from '../../lib/format.js'
import { previewRows } from '../../lib/friends/share-copy.js'
import { useFriendsMe, useGroups } from '../../lib/friends/use-friends.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { createGroupSheet } from '../../components/CreateGroupSheet.jsx'
import GlassList from '../../ds/GlassList.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import GroupCard from './GroupCard.jsx'
import SharePreview from './SharePreview.jsx'
import { joinLinkSheet } from './join-link-sheet.jsx'
import { GROUPS_PATH, SHARING_FIRST_PATH, markGroupsSeen } from './me-rows.js'

const SHARING_PATH = GROUPS_PATH + '/sharing'

// The person left a group: the page that follows says so, once. The route state is read into
// state on the first render and cleared from the history entry in an effect, so a reload or a
// Back to this page does not say it again.
function useLeftNotice() {
  const nav = useNavigate()
  const loc = useLocation()
  const [left] = useState(() => (loc.state?.left ? { name: String(loc.state.left), by: loc.state.by ? String(loc.state.by) : null } : null))
  useEffect(() => {
    if (!left) return
    nav(loc.pathname + loc.search, { replace: true, state: null })
    useUI.getState().toast(t('You left {0}', left.name), { action: t('OK'), onAction: () => {} })
  }, [])   // once: the state it reads is gone after the first run
  return left
}

/**
 * /me/groups (boards Fr6Off, Fr1Groups, Fr1Empty, Fr1Left): Friends off, your groups, on with no
 * group yet, and just after leaving one. It draws what lib/friends holds and writes nothing but
 * the "opened once" mark on the Me row; turning on goes to What you share first, because Friends
 * only turns on when that editor's button confirms.
 */
export default function GroupsScreen() {
  const nav = useNavigate()
  const { me, on, ready, stale } = useFriendsMe()
  const { groups } = useGroups()
  const S = useStore(s => s.S)
  const name = useStore(s => s.user?.name)
  const left = useLeftNotice()
  useEffect(() => { markGroupsSeen() }, [])

  const withGroups = on && groups.length > 0
  const caption = !on ? t('Friends · off') : withGroups || left ? t('Friends · on') : t('Friends is on · nothing shared until you join')
  const rows = me ? previewRows(me.share, S, todayISO()) : []
  const edit = () => nav(SHARING_PATH)

  const joinRow = { icon: 'link', title: t('Join with an invite link'), sub: t('Paste or open the link a friend sent'), onClick: joinLinkSheet }
  const createRow = { icon: 'plus', title: t('Create a group'), sub: t('Name it, then invite people'), onClick: createGroupSheet, haptic: true }
  const share = title => (
    <>
      <StageSection title={title} action={t('Edit')} onAction={edit} />
      <SharePreview name={name} rows={rows} />
    </>
  )

  let body = null
  if (ready && !on) {
    body = (
      <>
        <StageEmpty illustration="bell" card={false} title={t('Friends is off')}
          body={t('Nothing is shared and nobody sees you in a group. Turning it on asks what to share before anything goes out.')}
          actions={[{ label: t('Turn on Friends'), onClick: () => nav(SHARING_FIRST_PATH), solid: true, haptic: true }]} />
        <StageSection title={t('With Friends on')} />
        <div className="g-sp-card">
          <GlassList items={[
            { icon: 'users', title: t('Groups'), sub: t('One weekly goal you fill together') },
            { icon: 'heart', title: t('Cheers'), sub: t('One tap, no comments') },
            { icon: 'trophy', title: t('Challenges'), sub: t('Opt-in, short, never ranked') },
          ]} />
        </div>
      </>
    )
  } else if (ready && withGroups) {
    body = (
      <>
        <div className="g-fgroups">
          {groups.map(g => <GroupCard key={g.id} group={g} onOpen={() => nav(GROUPS_PATH + '/' + encodeURIComponent(g.id))} />)}
        </div>
        <StageSection title={t('Groups')} />
        <div className="g-sp-card"><GlassList items={[joinRow, createRow]} /></div>
        {share(t('What you share'))}
      </>
    )
  } else if (ready && left) {
    body = (
      <>
        <StageEmpty illustration="dumbbell" card={false} title={t('No group right now')}
          body={left.by ? t('You left {0}. Ask {1} for a new invite to go back, or start your own.', left.name, left.by) : t('You left {0}. Ask for a new invite to go back, or start your own.', left.name)} />
        <StageSection title={t('Groups')} />
        <div className="g-sp-card"><GlassList items={[joinRow, createRow]} /></div>
        {share(t('What you share'))}
      </>
    )
  } else if (ready) {
    body = (
      <>
        <StageEmpty illustration="dumbbell" card={false} title={t('Better together')}
          body={t('A group shares one goal for the week, like 20 workouts between you. Nobody is ranked; everyone just fills the same ring.')}
          actions={[
            { label: t('Create a group'), onClick: createGroupSheet, solid: true, haptic: true },
            { label: t('Join with an invite link'), onClick: joinLinkSheet },
          ]} />
        {share(t('What friends would see'))}
      </>
    )
  }

  return (
    <StagePage parent="/me" largeTitle={t('Groups')} sub={caption}>
      {stale && (
        <div className="g-sp-card">
          <InlineBanner stage tone="muted" icon="wifiOff" title={t("Can't reach the server, showing the last update")} />
        </div>
      )}
      {body}
    </StagePage>
  )
}
