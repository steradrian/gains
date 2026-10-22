import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { useMember } from '../../lib/friends/use-member.js'
import { useUI } from '../../store/useUI.js'
import { memberMenuSheet } from '../../components/MemberMenuSheet.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import MemberHeader from '../../ds/MemberHeader.jsx'
import StagePage from '../../ds/StagePage.jsx'
import MemberSections from './MemberSections.jsx'
import { GROUPS_PATH } from './me-rows.js'

/**
 * /me/groups/:id/member/:uid (boards Fr2Member, Fr2Gap): one person of the group, with only what
 * they share. The menu (Mute, Cheer their week, Remove for the creator) is not on your own page,
 * which has no Cheer pill either. When the server says the person is no longer in the group (they
 * left, or were removed) the page goes back to the group and says so; when the group itself is
 * gone it goes to Groups.
 */
export default function MemberScreen() {
  const { id, uid } = useParams()
  const nav = useNavigate()
  const m = useMember(id, uid)
  const groupPath = GROUPS_PATH + '/' + encodeURIComponent(id)

  useEffect(() => {
    if (m.status !== 'gone') return
    const name = m.member?.name
    const toGroups = m.gone === 'group'
    useUI.getState().toast(toGroups
      ? t('This group is no longer available')
      : name ? t('{0} is no longer in this group', name) : t('This person is no longer in this group'))
    nav(toGroups ? GROUPS_PATH : groupPath, { replace: true })
  }, [m.status])

  const { member, group } = m
  const actions = member && group && !m.you && !m.removed
    ? [{ icon: 'more', label: t('Member options'), onClick: () => memberMenuSheet({ group, member }) }]
    : []

  return (
    <StagePage parent={groupPath} actions={actions}>
      {m.stale && (
        <div className="g-sp-card">
          <InlineBanner stage tone="muted" icon="wifiOff" title={t("Can't reach the server, showing the last update")} />
        </div>
      )}
      {member && group && (
        <>
          <MemberHeader member={member} groupName={group.name} tone={m.tone} you={m.you} onCheer={m.cheer} />
          <MemberSections member={member} />
        </>
      )}
      {!member && m.status === 'error' && (
        <StageEmpty illustration="search" card={false} title={t("Can't reach the server")}
          actions={[{ label: t('Try again'), onClick: m.refresh, solid: true }]} />
      )}
    </StagePage>
  )
}
