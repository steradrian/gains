import { t } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'

// /me/groups/join/:code. A stub that Friends core-m2 replaces (Fr4Join); the route exists so
// App.jsx never changes again.
export default function JoinScreen() {
  return (
    <StagePage parent="/me/groups">
      <StageEmpty illustration="dumbbell" card={false} title={t('Groups')} />
    </StagePage>
  )
}
