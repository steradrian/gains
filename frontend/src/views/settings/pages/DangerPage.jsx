import { t } from '../../../lib/i18n.js'
import { Section, Row } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { useAccountActions } from '../use-account-actions.js'

export default function DangerPage() {
  const ctx = useSettingsCtx()
  const { resetEverything } = useAccountActions()
  return <Section footer={<>
    {t('Export a backup first if you might want any of it back.')}
    {ctx.nutrition && <> {t('Your nutrition diary, foods and goals stay.')}</>}
  </>}>
    <Row icon="trash" iconTint="var(--red)" title={t('Reset training data')} danger onClick={resetEverything} />
  </Section>
}
