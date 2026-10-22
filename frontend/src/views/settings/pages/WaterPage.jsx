import { t } from '../../../lib/i18n.js'
import { waterOf } from '../../../lib/nutrition/diary.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import { useUnits } from '../../../lib/nutrition/use-units.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'
import NtSettingsPage, { NtSegmentSetting, NtSwitchSetting } from '../nt-setting-rows.jsx'
import { openContainerSheet } from './container-sheet.jsx'

const line = data => {
  const first = settingOf(data, 'waterContainers')[0]
  const unit = waterOf(0, data).unit
  if (!first) return unit
  const { value } = waterOf(first.volumeMl, data)
  return `${unit} · ${t('{0} first', `${first.name} ${value} ${unit}`)}`
}

// Water (board St1Water, A1.20): the unit water shows in, where it shows, and the quick-add
// containers. The daily goal is on Goals. A container opens its drawer (container-sheet.jsx) to be
// edited or removed. Each change is one write.
export default function WaterPage() {
  return <NtSettingsPage title={t('Water')} line={line}><WaterBody /></NtSettingsPage>
}

function WaterBody() {
  const { data } = useNtSettings()
  const units = useUnits()
  const containers = settingOf(data, 'waterContainers')
  return <>
    <StageSection variant="label" title={t('Display')} />
    <div className="g-glist g-glass">
      <NtSegmentSetting k="waterUnit" icon="droplet" title={t('Water unit')}
        options={[{ value: 'ml', label: 'ml' }, { value: 'oz', label: 'fl oz' }, { value: 'L', label: 'L' }, { value: 'G', label: t('Gallons') }]} />
      <NtSwitchSetting k="waterShowInDiary" icon="utensils" title={t('Show water in the diary')} sub={t('Today and Eat')} />
      <NtSwitchSetting k="waterShowInStats" icon="chart" title={t('Show water in statistics')} sub={t('In the Trends charts')} />
    </div>

    <StageSection variant="label" title={t('Containers')} />
    <div className="g-glist g-glass">
      {containers.map(c => (
        <SettingRow key={c.id} icon="droplet" title={c.name} sub={t('One tap adds it')} value={units.water(c.volumeMl)} onClick={() => openContainerSheet(c)} />
      ))}
      <SettingRow icon="plusCircle" title={t('Add a container')} sub={t('Your gym bottle, a mug')} onClick={() => openContainerSheet(null)} />
    </div>
    <StageNote>{containers.length
      ? t('Quick-add buttons for logging water in the diary.')
      : t('No containers: Home adds a 250 ml glass. Add one and its button replaces the glass.')}</StageNote>
  </>
}
