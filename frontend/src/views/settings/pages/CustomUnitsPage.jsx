import { t, tn } from '../../../lib/i18n.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import NtSettingsGate from '../../../components/NtSettingsGate.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { openCustomUnitSheet } from './custom-unit-sheet.jsx'
import { useFreshNtSettings } from './use-fresh-nt-settings.js'

// Custom units (boards St1CustomUnits, A1.26): units the built-in list lacks ("shot", "scoop"),
// each `{ abbr, full }`. They are offered beside g and ml wherever a food's unit is picked
// (lib/nutrition/diary.js unitsFor). A row opens the unit drawer (A1.27).
export default function CustomUnitsPage() {
  const { data } = useNtSettings()
  useFreshNtSettings()
  const units = data ? settingOf(data, 'customUnits') : []

  return (
    <SettingsPage title={t('Custom units')} line={units.length ? tn('{0} unit', '{0} units', units.length) : undefined}>
      <div className="set-body">
        {!data ? <NtSettingsGate>{null}</NtSettingsGate> : <>
          {units.length === 0 && (
            <StageEmpty illustration="plate" card={false} title={t('No custom units yet')} body={t('Add a shot, a scoop or a handful and pick it when you log a food.')} />
          )}
          <div className="g-glist g-glass">
            {units.map(u => (
              <SettingRow key={u.abbr} icon="ruler" title={u.full || u.abbr} sub={t('Abbreviation “{0}”', u.abbr)} onClick={() => openCustomUnitSheet(u)} />
            ))}
            <SettingRow icon="plusCircle" title={t('Add a custom unit')} sub={t('Stick, handful, bowl')} onClick={() => openCustomUnitSheet()} />
          </div>
          <StageNote>{t('Units the built-in list does not have, such as a shot or a scoop. They do not convert by weight: 1 unit to 2 units doubles the nutrition, nothing more.')}</StageNote>
        </>}
      </div>
    </SettingsPage>
  )
}
