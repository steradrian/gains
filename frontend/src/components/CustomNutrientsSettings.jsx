import { t } from '../lib/i18n.js'
import { removeCustomNutrient } from '../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings } from '../lib/nutrition/use-nt-settings.js'
import { Button, Row, Section } from './ui.jsx'
import { customNutrientSheet } from './CustomNutrientSheet.jsx'

// Profile › Custom nutrients (ia-proposal §5; NutriTrace Settings › Nutrients, the custom part):
// nutrients the built-in list lacks (Omega-3), each `{ id, label, unit }` with an id NutriTrace
// makes from the name. Which built-in nutrients show, and in what order, is not here.
export default function CustomNutrientsSettings() {
  const { data, busy, save } = useNtSettings()
  const nutrients = settingOf(data, 'customNutriments')
  return (
    <Section footer={t('Track a nutrient the built-in list does not cover, such as Omega-3.')}>
      {nutrients.map(n => (
        <Row key={n.id} icon="apple" iconTint="var(--red)" title={n.label} subtitle={n.unit}>
          <Button size="sm" icon="trash" aria-label={t('Remove {0}', n.label)} disabled={!!busy.customNutriments}
            onClick={() => save('customNutriments', removeCustomNutrient(nutrients, n.id))} />
        </Row>
      ))}
      <Row icon="plusCircle" iconTint="var(--green)" title={t('Add a custom nutrient')} accessory="chevron" onClick={customNutrientSheet} />
    </Section>
  )
}
