import { t } from '../../../lib/i18n.js'
import { useDsAccent } from '../../../lib/use-ds-accent.js'
import { back } from '../../../lib/use-tab-nav.js'
import StageNavBar from '../../../ds/StageNavBar.jsx'
import StagePageTitle from '../../../ds/StagePageTitle.jsx'
import StageScreen from '../../../ds/StageScreen.jsx'

// invite-M3: the member's view (M5.4 Ask an admin, M5.5 Asked) replaces this body. Until then a
// member who opens /me/invite (a push tap) gets the page chrome and its title.
export default function MemberInvite() {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <StageNavBar onBack={() => back()} />
      <StagePageTitle title={t('Invite a friend')} />
    </StageScreen>
  )
}
