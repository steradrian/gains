import { useMemo } from 'react'
import { t } from '../../lib/i18n.js'
import { cheerRows, cheerWhen } from '../../lib/friends/cheer-rows.js'
import { useCheers } from '../../lib/friends/use-cheers.js'
import { useGroups } from '../../lib/friends/use-friends.js'
import CheerList from '../../ds/CheerList.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'

/**
 * /me/groups/cheers (board Fr8Cheers): this week's cheers for you, newest first. Opening it tells
 * the server you looked (the digest's marker moves), it writes nothing else. "From <group>" names
 * the group only when there is exactly one; with several, each row names its own.
 */
export default function CheersScreen() {
  const { cheers, ready, stale } = useCheers({ markSeen: true })
  const { groups } = useGroups()
  const rows = useMemo(() => (cheers ? cheerRows(cheers, groups) : []), [cheers, groups])
  const now = Date.now()
  const from = groups.length === 1 ? t('From {0}', groups[0].name) : undefined

  return (
    <StagePage parent="/me/groups" largeTitle={t('Cheers for you')} sub={from}>
      {stale && (
        <div className="g-sp-card">
          <InlineBanner stage tone="muted" icon="wifiOff" title={t("Can't reach the server, showing the last update")} />
        </div>
      )}
      {ready && !rows.length && (
        <StageEmpty illustration="bell" card={false} title={t('No cheers yet this week')}
          body={t('When someone in your group cheers a workout or your week, it shows up here.')} />
      )}
      {ready && rows.length > 0 && (
        <>
          <StageSection title={t('This week')} action={String(rows.length)} />
          <CheerList label={t('Cheers this week')} rows={rows.map(r => ({ ...r, when: cheerWhen(r.at, now) }))} />
        </>
      )}
      {ready && <StageNote>{t('Cheers also arrive as a notification, once an evening at most.')}</StageNote>}
    </StagePage>
  )
}
