import NtSettingsGate from '../../components/NtSettingsGate.jsx'
import { settingOf, useNtSettings } from '../../lib/nutrition/use-nt-settings.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import StageSegmented from '../../ds/StageSegmented.jsx'
import StageSwitch from '../../ds/StageSwitch.jsx'
import SettingRow from './SettingRow.jsx'
import SettingsPage from './SettingsPage.jsx'

// The stage rows of NutriTrace's settings pages (Diary, Water, Foods, Sources). `k` is the settings
// key, read as NutriTrace would (the saved value, or its default) and written one key at a time
// through the hub; a refused save toasts and the row keeps the saved value (useNtSettings).

/** A boolean setting as a switch row. `title` is the row's visible title and the switch's spoken name. */
export function NtSwitchSetting({ k, icon, title, sub }) {
  const { data, save } = useNtSettings()
  return <SettingRow icon={icon} title={title} sub={sub}
    trailing={<StageSwitch label={title} checked={settingOf(data, k) === true} onChange={v => save(k, v)} />} />
}

/** A setting with two to five fixed values as a row with a segmented control under its text. */
export function NtSegmentSetting({ k, icon, title, sub, options }) {
  const { data, save } = useNtSettings()
  return <SettingRow icon={icon} title={title} sub={sub}
    below={<StageSegmented label={title} value={settingOf(data, k)} options={options} onChange={v => save(k, v)} />} />
}

/**
 * The frame of a NutriTrace settings page: the nav bar and title stand at once, the body waits for
 * NutriTrace's settings (NtSettingsGate: a loading line, or the failure with Try again). `line` is
 * the status line under the title, built from the settings once they are here.
 */
export default function NtSettingsPage({ title, line, children }) {
  const data = useNutrition(s => s.settings.data)
  return (
    <SettingsPage title={title} line={data && line ? line(data) : undefined}>
      <NtSettingsGate>
        <div className="set-body">{children}</div>
      </NtSettingsGate>
    </SettingsPage>
  )
}
