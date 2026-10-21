import { t } from '../../../lib/i18n.js'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'

// A placeholder for /me/account/delete: the route exists from the shell on, and acct-m2 replaces
// this file with the real page.
export default function DeleteAccountPage() {
  return (
    <StagePage parent="/me/account">
      <StageEmpty card={false} illustration="calendar" title={t('Coming soon')} />
    </StagePage>
  )
}
