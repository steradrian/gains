import { t } from '../lib/i18n.js'
import { removeContainer } from '../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings } from '../lib/nutrition/use-nt-settings.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import { Button, Row, Section } from './ui.jsx'
import NtChoiceRow from './NtChoiceRow.jsx'
import NtSwitchRow from './NtSwitchRow.jsx'
import { waterContainerSheet } from './WaterContainerSheet.jsx'

// Profile › Water (ia-proposal §5; NutriTrace Settings › Water): the unit water shows in, where it
// shows, and the quick-add containers. The daily goal is on Goals. Each change is one write.
export default function WaterSettings() {
  const { data, busy, save } = useNtSettings()
  const units = useUnits()
  const containers = settingOf(data, 'waterContainers')
  return <>
    <Section title={t('Display')}>
      <NtChoiceRow k="waterUnit" icon="droplet" tint="var(--blue)" title={t('Water unit')} options={[
        { value: 'ml', label: t('Milliliters (ml)') },
        { value: 'oz', label: t('Fluid ounces (fl oz)') },
        { value: 'L', label: t('Liters (L)') },
        { value: 'G', label: t('Gallons (G)') },
      ]} />
      <NtSwitchRow k="waterShowInDiary" icon="utensils" tint="var(--orange)" title={t('Show water in the diary')} />
      <NtSwitchRow k="waterShowInStats" icon="chart" tint="var(--teal)" title={t('Show water in statistics')} />
    </Section>
    <Section title={t('Containers')} footer={t('Quick-add buttons for logging water in the diary.')}>
      {containers.map(c => (
        <Row key={c.id} icon="droplet" iconTint="var(--blue)" title={c.name} subtitle={units.water(c.volumeMl)}>
          <Button size="sm" icon="trash" aria-label={t('Remove {0}', c.name)} disabled={!!busy.waterContainers}
            onClick={() => save('waterContainers', removeContainer(containers, c.id))} />
        </Row>
      ))}
      <Row icon="plusCircle" iconTint="var(--green)" title={t('Add a container')} accessory="chevron" onClick={waterContainerSheet} />
    </Section>
  </>
}
