import { useParams } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'

// /me/groups/:id/member/:uid. A stub that Friends group-m2 replaces (Fr2Member); the route exists
// so App.jsx never changes again.
export default function MemberScreen() {
  const { id } = useParams()
  return (
    <StagePage parent={'/me/groups/' + encodeURIComponent(id)}>
      <StageEmpty illustration="dumbbell" card={false} title={t('Groups')} />
    </StagePage>
  )
}
