import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageHeader from '../../ds/StageHeader.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import './eat.css'

// Eat with Food switched off in Settings > Features: the tab stays, and says so. Turning Food back
// on is a switch flip in place (S.trackFood); the diary was never touched.
export default function FoodOffScreen() {
  const accent = useDsAccent()
  const update = useStore(s => s.update)
  return (
    <StageScreen accent={accent}>
      <div className="eat eat-off">
        <StageHeader pinned title={t('Eat')} />
        <StageEmpty
          card={false}
          illustration="plate"
          title={t('Food is off')}
          body={t('Turn it on to log meals, water and fasting.')}
          action={t('Turn Food back on')}
          onClick={() => update(s => { s.trackFood = true })}
        />
      </div>
    </StageScreen>
  )
}
