import { t } from '../../../lib/i18n.js'
import { Section, Row } from '../../../components/ui.jsx'
import { BRAND, LINKS } from '../../../brand.js'

// AGPL-3.0 notices and the third-party attributions NOTICE.md carries. The legal wording is
// not translated; the media line is the one the Gym visual agreement (§8c) asks for word for word.
export default function LicencesPage() {
  return <>
    <Section footer={t('It comes with no warranty, to the extent the law allows.')}>
      <p className="sp-lic">
        <span className="sp-lic-title">{BRAND.name} v{BRAND.version}</span>
        {LINKS.copyright.map(line => <span key={line}>{line}<br /></span>)}
        {t('Free software, licensed under the GNU Affero General Public License v3.0 or later. You may redistribute and modify it under those terms.')}
      </p>
      <Row icon="bookOpen" iconTint="var(--grey)" title={t('Full licence text')} accessory="chevron"
        onClick={() => window.open(LINKS.upstream.license, '_blank', 'noopener')} />
    </Section>
    <Section title={t('Source code')} footer={t('Built on {0} v{1} by {2}.', LINKS.upstream.name, __APP_VERSION__, LINKS.upstream.author)}>
      {LINKS.source.map(l => <Row key={l.url} icon="link" iconTint="var(--grey)" title={l.label} accessory="chevron"
        onClick={() => window.open(l.url, '_blank', 'noopener')} />)}
    </Section>
    <Section title={t('Third-party notices')}>
      <p className="sp-lic">
        <b>{t('Exercise media')}</b><br />
        Exercise media © Aliaksandr Makatserchyk, <a href={LINKS.media.url} target="_blank" rel="noopener">Gym visual</a>, gymvisual.com.
        Media licensed for use in {LINKS.upstream.name} only; see <a href={LINKS.upstream.notice} target="_blank" rel="noopener">NOTICE.md</a>
      </p>
      <p className="sp-lic">
        <b>{t('Body diagram')}</b><br />
        <a href={LINKS.muscleMap.url} target="_blank" rel="noopener">{LINKS.muscleMap.name}</a> © 2026 Melih Colpan, MIT License.
      </p>
      <p className="sp-lic">
        <b>{t('Exercise text')}</b><br />
        <a href={LINKS.exerciseDb.url} target="_blank" rel="noopener">{LINKS.exerciseDb.name}</a> by AscendAPI, via hasaneyldrm/exercises-dataset © 2026 Hasan Emir Yıldırım, MIT License.
      </p>
      <p className="sp-lic">
        <b>{t('Icons')}</b><br />
        Nutrition icons derived from <a href={LINKS.lucide.url} target="_blank" rel="noopener">{LINKS.lucide.name}</a>, ISC License, © Lucide Contributors; portions © 2013-2022 Cole Bemis (Feather), MIT License.
      </p>
    </Section>
  </>
}
