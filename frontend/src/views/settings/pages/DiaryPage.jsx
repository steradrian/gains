import DiaryMealsSettings from '../../../components/DiaryMealsSettings.jsx'
import NtSettingsGate from '../../../components/NtSettingsGate.jsx'

// NutriTrace's settings pages wait for its settings (NtSettingsGate), then read and write them.
export default function DiaryPage() {
  return <NtSettingsGate><DiaryMealsSettings /></NtSettingsGate>
}
