import FoodsSettings from '../../../components/FoodsSettings.jsx'
import NtSettingsGate from '../../../components/NtSettingsGate.jsx'

export default function FoodsPage() {
  return <NtSettingsGate><FoodsSettings /></NtSettingsGate>
}
