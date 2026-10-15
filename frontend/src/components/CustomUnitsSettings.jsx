import { t } from '../lib/i18n.js'
import { removeCustomUnit } from '../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings } from '../lib/nutrition/use-nt-settings.js'
import { Button, Row, Section } from './ui.jsx'
import { customUnitSheet } from './CustomUnitSheet.jsx'

// Profile › Custom units (ia-proposal §5; NutriTrace Settings › Custom units): units the built-in
// list lacks ("shot", "scoop"), each `{ abbr, full }`. A custom unit has no weight, so picking one
// scales a food's nutrition by the portion alone.
export default function CustomUnitsSettings() {
  const { data, busy, save } = useNtSettings()
  const units = settingOf(data, 'customUnits')
  return (
    <Section footer={t('Units the built-in list does not have, such as a shot or a scoop. They do not convert by weight: 1 unit to 2 units doubles the nutrition, nothing more.')}>
      {units.map(u => (
        <Row key={u.abbr} icon="ruler" iconTint="var(--teal)" title={u.full || u.abbr} subtitle={u.abbr}>
          <Button size="sm" icon="trash" aria-label={t('Remove {0}', u.full || u.abbr)} disabled={!!busy.customUnits}
            onClick={() => save('customUnits', removeCustomUnit(units, u.abbr))} />
        </Row>
      ))}
      <Row icon="plusCircle" iconTint="var(--green)" title={t('Add a custom unit')} accessory="chevron" onClick={customUnitSheet} />
    </Section>
  )
}
