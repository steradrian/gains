import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { t, tn } from '../../lib/i18n.js'
import { todayISO } from '../../lib/format.js'
import { previewRows } from '../../lib/friends/share-copy.js'
import { useFriendsMe } from '../../lib/friends/use-friends.js'
import { useStore } from '../../store/useStore.js'
import Button from '../../ds/Button.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import MemberAvatar, { memberTone } from '../../ds/MemberAvatar.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import SharePreview from './SharePreview.jsx'
import { GROUPS_PATH, SHARING_FIRST_PATH } from './me-rows.js'
import { useJoin } from './use-join.js'

const SHARING_PATH = GROUPS_PATH + '/sharing'
const groupPath = id => GROUPS_PATH + '/' + encodeURIComponent(id)

function ClosedInvite({ from, onBack }) {
  return (
    <StageEmpty illustration="calendar" card={false} title={t('This invite has expired')}
      body={from ? t('Ask {0} for a new one', from) : t('Ask the person who sent it for a new one')}
      actions={[{ label: t('Back to Groups'), onClick: onBack }]} />
  )
}

function ValidInvite({ preview, friendsOn, joining, onJoin, onTurnOn, onChange, onNotNow }) {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { me } = useFriendsMe()
  const { group, from } = preview
  const initials = group.initials || []
  const rows = friendsOn && me ? previewRows(me.share, S, todayISO()) : []
  const sub = t('{0}, one weekly goal. Nobody is ranked.', tn('{0} friend', '{0} friends', group.memberCount))
  return (
    <>
      <div className="g-sp-card">
        <GlassRow
          title={from?.name ? t('{0} invited you to {1}', from.name, group.name) : t('You are invited to {0}', group.name)}
          sub={sub}
          trailing={<span className="g-mavatars">{initials.slice(0, 5).map((c, i) => <MemberAvatar key={i} initial={c} tone={memberTone(i)} />)}</span>} />
      </div>
      {friendsOn ? (
        <>
          <StageSection title={t('This is all they will see')} action={t('Change')} onAction={onChange} />
          <SharePreview name={user?.name} rows={rows} />
        </>
      ) : (
        <StageNote>{t('Friends is off. Turn it on to choose what to share, then join.')}</StageNote>
      )}
      <div className="g-sp-card g-fgroups">
        {friendsOn
          ? <Button block haptic busy={joining} onClick={onJoin}>{t('Join {0}', group.name)}</Button>
          : <Button block onClick={onTurnOn}>{t('Turn on Friends')}</Button>}
        <Button block variant="ghost" onClick={onNotNow}>{t('Not now')}</Button>
      </div>
    </>
  )
}

/**
 * /me/groups/join/:code (board Fr4Join): who invited you, the group, and exactly what they will see
 * of you before you say yes. A link already used or past its week says so and who to ask; one for a
 * group you are in opens that group. With Friends off, Join is Turn on Friends, through What you
 * share, which brings you back here.
 */
export default function JoinScreen() {
  const { code } = useParams()
  const nav = useNavigate()
  const { phase, joining, join, retry } = useJoin(code)
  const { on, ready } = useFriendsMe()
  const here = GROUPS_PATH + '/join/' + encodeURIComponent(code)

  if (phase.kind === 'member') return <Navigate to={groupPath(phase.groupId)} replace />

  const onJoin = async () => {
    const done = await join()
    if (done) nav(groupPath(done.groupId), { replace: true })
  }

  let body = null
  if (phase.kind === 'valid') {
    body = (
      <ValidInvite preview={phase.preview} friendsOn={ready && on} joining={joining}
        onJoin={onJoin}
        onTurnOn={() => nav(SHARING_FIRST_PATH, { state: { returnTo: here } })}
        onChange={() => nav(SHARING_PATH)}
        onNotNow={() => nav(GROUPS_PATH)} />
    )
  } else if (phase.kind === 'closed') {
    body = <ClosedInvite from={phase.from} onBack={() => nav(GROUPS_PATH)} />
  } else if (phase.kind === 'error') {
    body = (
      <StageEmpty illustration="calendar" card={false} title={t("Couldn't open this invite")}
        body={t("Can't reach the server. Try again when you're online.")}
        actions={[{ label: t('Try again'), onClick: retry, solid: true }]} />
    )
  }

  return (
    <StagePage parent={GROUPS_PATH} largeTitle={t('Join a group')}>
      {body}
    </StagePage>
  )
}
