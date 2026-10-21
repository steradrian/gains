import { t } from '../lib/i18n.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import StageBackground from './StageBackground.jsx'
import StageEmpty from './StageEmpty.jsx'

// The app is portrait-only. The native shells lock it; iOS Safari and home-screen web apps ignore
// the lock, so on a phone held sideways (ds.css .g-landscape-cover: landscape, short, coarse
// pointer) this covers the app with a stage and one line. The app stays mounted underneath, so
// nothing is lost when the phone turns back.
export default function LandscapeCover() {
  const accent = useDsAccent()
  return (
    <div className="g-root g-landscape-cover" data-accent={accent}>
      <StageBackground>
        <StageEmpty illustration="dumbbell" card={false} title={t('Turn your phone upright')} body={t('Gains works in portrait.')} />
      </StageBackground>
    </div>
  )
}
