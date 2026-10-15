import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { featuresFor, pageTrail, PAGES } from '../views/settings-pages.js'
import { Row, Section } from './ui.jsx'

// Profile › Features (ia-proposal §5, §9 q12): every switch that starts off, whether it is on, and
// the page it is on. A tap opens that page with the switch flashed, so each one is set in one
// place only.
export default function FeaturesList({ S, ctx }) {
  const nav = useNavigate()
  const rows = featuresFor(ctx)
  return <Section title={t('Off until you turn them on')} footer={t('Tap one to go to its switch.')}>
    {rows.map(f => (
      <Row key={f.page + ':' + f.title} icon={PAGES[f.page].icon} iconTint={PAGES[f.page].tint} title={t(f.title)}
        subtitle={pageTrail(f.page)} value={f.on(S, ctx) ? t('On') : t('Off')} accessory="chevron"
        onClick={() => nav('/me/' + f.page, { state: { find: f.title } })} />
    ))}
  </Section>
}
