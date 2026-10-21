import FoodCategoriesSettings from '../../../components/FoodCategoriesSettings.jsx'
import NtSettingsGate from '../../../components/NtSettingsGate.jsx'

export default function CategoriesPage() {
  return <NtSettingsGate><FoodCategoriesSettings /></NtSettingsGate>
}
