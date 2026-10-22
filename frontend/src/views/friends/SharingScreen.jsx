import { t } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'

// /me/groups/sharing (?first=1 when Friends is being turned on). A stub that Friends core-m2
// replaces (Fr5Sharing); the route exists so App.jsx never changes again.
export default function SharingScreen() {
  return (
    <StagePage parent="/me/groups">
      <StageEmpty illustration="dumbbell" card={false} title={t('Groups')} />
    </StagePage>
  )
}
