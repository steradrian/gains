import { t } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'

// /me/groups/cheers. A stub that Friends surfaces-m1 replaces (Fr8Cheers); the route exists so
// App.jsx never changes again.
export default function CheersScreen() {
  return (
    <StagePage parent="/me/groups">
      <StageEmpty illustration="bell" card={false} title={t('Groups')} />
    </StagePage>
  )
}
