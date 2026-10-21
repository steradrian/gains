import { useStore } from '../../../store/useStore.js'
import FeaturesList from '../../../components/FeaturesList.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

export default function FeaturesPage() {
  const S = useStore(s => s.S)
  const ctx = useSettingsCtx()
  return <FeaturesList S={S} ctx={ctx} />
}
