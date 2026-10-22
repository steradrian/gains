import { t } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'

// /me/groups/:id. A stub that Friends group-m1 replaces (Fr2Group); the route exists so App.jsx
// never changes again.
export default function GroupScreen() {
  return (
    <StagePage parent="/me/groups">
      <StageEmpty illustration="dumbbell" card={false} title={t('Groups')} />
    </StagePage>
  )
}
