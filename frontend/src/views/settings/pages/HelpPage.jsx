import { t } from '../../../lib/i18n.js'
import { BRAND } from '../../../brand.js'
import { openExternal } from '../../../components/CustomMedia.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { HELP_TOPICS } from '../help-topics.js'
import { openHelpSheet } from './help-sheet.jsx'

// Gains has no contact address, only its issue tracker, so Report a problem opens a new bug report
// there with the app version in the form's "Browser & OS" field, and "Ask Adrian" is not offered.
export const reportUrl = (version = BRAND.version) =>
  BRAND.url + '/issues/new?template=bug_report.yml&environment=' + encodeURIComponent('Gains v' + version)

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
          <SettingRow icon="flag" title={t('Report a problem')} sub={t('Opens GitHub with your app version filled in')} onClick={() => openExternal(reportUrl())} />
        </div>
        <StageNote>{t('Search settings finds these answers too.')}</StageNote>
      </div>
    </SettingsPage>
  )
}
