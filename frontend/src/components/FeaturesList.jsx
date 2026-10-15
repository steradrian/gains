import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { writeErrorText } from '../lib/nutrition/log-feedback.js'
import { setFastingEnabled } from '../lib/nutrition/use-fasting.js'
import { featuresFor, pageTrail, PAGES } from '../views/settings-pages.js'
import { Row, Section, Switch } from './ui.jsx'

// Profile › Features (ia-proposal §5, §9 q12): every switch that starts off, whether it is on, and
// the page it is on. A tap opens that page with the switch flashed, so each one is set in one
// place only. Fasting has no other page of settings, so its switch is here: on, the + sheet gets
// its Fast row.
export default function FeaturesList({ S, ctx }) {
  const nav = useNavigate()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)
  const rows = featuresFor(ctx)
  const fasting = async on => {
    setSwitching(true)
    setError(null)
    try { await setFastingEnabled(on) } catch (e) { setError(writeErrorText(e)) }
    setSwitching(false)
  }
  return <>
    {ctx.nutrition && <Section title={t('Nutrition')} footer={error || undefined}>
      <Row icon="timer" iconTint="var(--indigo)" title={t('Fasting')}
        subtitle={t('Adds Fast to the + sheet, and a timer and history under Nutrition › Fasting.')}>
        <Switch aria-label={t('Fasting')} checked={ctx.fastingOn} disabled={switching || !ctx.ntSettings} onChange={fasting} />
      </Row>
    </Section>}
    <Section title={t('Off until you turn them on')} footer={t('Tap one to go to its switch.')}>
      {rows.map(f => (
        <Row key={f.page + ':' + f.title} icon={PAGES[f.page].icon} iconTint={PAGES[f.page].tint} title={t(f.title)}
          subtitle={pageTrail(f.page)} value={f.on(S, ctx) ? t('On') : t('Off')} accessory="chevron"
          onClick={() => nav('/me/' + f.page, { state: { find: f.title } })} />
      ))}
    </Section>
  </>
}
