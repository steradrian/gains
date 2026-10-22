import { t } from '../../../lib/i18n.js'
import { BRAND, LINKS } from '../../../brand.js'
import { MOBILE } from '../../../lib/mobile.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { HELP_TOPICS } from '../help-topics.js'
import { openHelpSheet } from './help-sheet.jsx'

const platformLabel = () => `${MOBILE ? 'Phone app' : 'Browser'}; ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`

// Report a problem is a mail to Adrian (for now, until Gains has a tracker of its own), with the
// subject, the app version and the platform filled in so he does not have to ask.
export const reportUrl = ({ version = BRAND.version, platform = platformLabel() } = {}) => {
  const subject = t('Gains {0} problem', version)
  const body = `${t('App version')}: ${version}\n${t('Platform')}: ${platform}\n\n`
  return `mailto:${LINKS.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// A mailto address is not a web link, so openExternal (http and https only) would drop it. Opening
// it in this window hands it to the mail app and leaves the page where it is.
const openMail = url => window.open(url, '_self')

// Help (board St1Help, A1.35): six short answers, each in a drawer, then the way to report a
// problem. The answers are searchable (settings-pages.js builds an entry for each).
export default function HelpPage() {
  return (
    <SettingsPage title={t('Help')} line={t('How Gains works, in short answers')}>
      <div className="set-body">
        <div className="g-glist g-glass">
          {HELP_TOPICS.map(topic => (
            <SettingRow key={topic.id} icon={topic.icon} title={t(topic.title)} sub={t(topic.sub)} onClick={() => openHelpSheet(topic)} />
          ))}
        </div>

        <StageSection variant="label" title={t('Still stuck')} />
        <div className="g-glist g-glass">
          <SettingRow icon="flag" title={t('Report a problem')} sub={t('Opens your email app with your app version filled in')} onClick={() => openMail(reportUrl())} />
        </div>
        <StageNote>{t('Search settings finds these answers too.')}</StageNote>
      </div>
    </SettingsPage>
  )
}
