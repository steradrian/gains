import { t } from '../../../lib/i18n.js'
import { openExternal } from '../../../components/CustomMedia.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import { BRAND, LINKS } from '../../../brand.js'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { settingsPath } from '../paths.js'
import LicenceNotice from './LicenceNotice.jsx'

// Licences (board St1About, Credits): the AGPL-3.0 notice and the third-party attributions NOTICE.md
// carries. The media line is the one the Gym visual agreement (§8c) asks for word for word.
export default function LicencesPage() {
  return (
    <SettingsPage title={t('Licences')} line={t('AGPL-3.0 · open source')} parent={settingsPath('about')}>
      <div className="set-body">
        <div className="g-glist g-glass">
          <div className="set-lic">
            <b>{BRAND.name} v{BRAND.version}</b>
            <p>
              {LINKS.copyright.map(line => <span key={line}>{line}<br /></span>)}
              {t('Free software, licensed under the GNU Affero General Public License v3.0 or later. You may redistribute and modify it under those terms.')}
            </p>
          </div>
          <SettingRow icon="bookOpen" title={t('Full licence text')} onClick={() => openExternal(LINKS.upstream.license)} />
        </div>
        <StageNote>{t('It comes with no warranty, to the extent the law allows.')}</StageNote>

        <StageSection variant="label" title={t('Source code')} />
        <div className="g-glist g-glass">
          {LINKS.source.map(l => <SettingRow key={l.url} icon="link" title={l.label} onClick={() => openExternal(l.url)} />)}
        </div>
        <StageNote>{t('Built on {0} v{1} by {2}.', LINKS.upstream.name, __APP_VERSION__, LINKS.upstream.author)}</StageNote>

        <StageSection variant="label" title={t('Third-party notices')} />
        <LicenceNotice title={t('Exercise media')} links={[{ label: LINKS.media.name, url: LINKS.media.url }, { label: 'NOTICE.md', url: LINKS.upstream.notice }]}>
          {`Exercise media © Aliaksandr Makatserchyk, ${LINKS.media.name}, gymvisual.com. Media licensed for use in ${LINKS.upstream.name} only; see NOTICE.md`}
        </LicenceNotice>
        <LicenceNotice title={t('Body diagram')} links={[{ label: LINKS.muscleMap.name, url: LINKS.muscleMap.url }]}>
          {`${LINKS.muscleMap.name} © 2026 Melih Colpan, MIT License.`}
        </LicenceNotice>
        <LicenceNotice title={t('Exercise text')} links={[{ label: LINKS.exerciseDb.name, url: LINKS.exerciseDb.url }]}>
          {`${LINKS.exerciseDb.name} by AscendAPI, via hasaneyldrm/exercises-dataset © 2026 Hasan Emir Yıldırım, MIT License.`}
        </LicenceNotice>
        <LicenceNotice title={t('Icons')} links={[{ label: LINKS.lucide.name, url: LINKS.lucide.url }]}>
          {`Nutrition icons derived from ${LINKS.lucide.name}, ISC License, © Lucide Contributors; portions © 2013-2022 Cole Bemis (Feather), MIT License.`}
        </LicenceNotice>
      </div>
    </SettingsPage>
  )
}
