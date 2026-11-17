import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { todayISO } from '../../lib/format.js'
import { previewRows } from '../../lib/friends/share-copy.js'
import { useGroups } from '../../lib/friends/use-friends.js'
import { useStore } from '../../store/useStore.js'
import Button from '../../ds/Button.jsx'
import GlassList from '../../ds/GlassList.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import { Card, SwitchRow } from '../settings/pages/prefs-rows.jsx'
import SharePreview from './SharePreview.jsx'
import { GROUPS_PATH } from './me-rows.js'
import { useSharing } from './use-sharing.js'

// The name the preview is "as … sees you" for: the first other person in any of the groups.
function viewerName(groups, myId) {
  for (const g of groups) {
    const other = (g.members || []).find(m => m.uid !== myId)
    if (other?.name) return other.name
  }
  return null
}

/**
 * /me/groups/sharing (board Fr5Sharing): one switch for each thing a friend can see, what is never
 * shared, and a preview of exactly what a friend sees. While Friends is off this is also the way
 * to turn it on: the button is the only thing that does, and leaving without it stores nothing.
 */
export default function SharingScreen() {
  const nav = useNavigate()
  const loc = useLocation()
  const { ready, confirming, stale, share, setSwitch, confirm, turning } = useSharing()
  const { groups } = useGroups()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const other = viewerName(groups, user?.id)
  const rows = previewRows(share, S, todayISO())

  // Turned on from an invite (the join page sends its own address): go back to it, not to Groups.
  const returnTo = loc.state?.returnTo
  const back = typeof returnTo === 'string' && returnTo.startsWith(GROUPS_PATH + '/join/') ? returnTo : GROUPS_PATH
  const turnOnNow = async () => { if (await confirm()) nav(back, { replace: true }) }

  return (
    <StagePage parent={GROUPS_PATH} largeTitle={t('What you share')} sub={t("The same for every group you're in")}>
      {stale && (
        <div className="g-sp-card">
          <InlineBanner stage tone="muted" icon="wifiOff" title={t("Can't reach the server, showing the last update")} />
        </div>
      )}
      {ready && (
        <>
          <StageSection title={t('Friends see')} />
          <Card>
            <SwitchRow icon="dumbbell" title={t('Training done')} sub={t('Which workout, when, how long')}
              checked={share.training} onChange={v => setSwitch('training', v)} />
            <SwitchRow icon="calendar" title={t('Weekly consistency')} sub={t('Planned workouts done, week by week')}
              checked={share.consistency} onChange={v => setSwitch('consistency', v)} />
            <SwitchRow icon="target" title={t('Food targets reached')} sub={t('Yes or no per day. Never foods or amounts')}
              checked={share.targets} onChange={v => setSwitch('targets', v)} />
            <SwitchRow icon="trophy" title={t('New bests')}
              sub={share.bests ? t('On: only the exercise, never the weight') : t('Off: you can still share one from a workout summary')}
              checked={share.bests} onChange={v => setSwitch('bests', v)} />
          </Card>

          <StageSection title={t('Never shared')} />
          <div className="g-sp-card">
            <GlassList items={[
              { icon: 'scale', title: t('Weight and body'), sub: t('Weigh-ins, measurements, photos') },
              { icon: 'utensils', title: t('What you eat'), sub: t('Foods, meals, kcal and macros') },
            ]} />
          </div>

          <StageSection title={t('Preview')} action={other ? t('as {0} sees you', other) : t('as a friend sees you')} />
          <SharePreview name={user?.name} rows={rows} />

          {confirming && (
            <div className="g-sp-card">
              <Button block haptic busy={turning} onClick={turnOnNow}>{t('Turn on Friends')}</Button>
              <StageNote>{t('Nothing goes out until you join')}</StageNote>
            </div>
          )}
        </>
      )}
    </StagePage>
  )
}
