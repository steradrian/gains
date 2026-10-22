import { THEME_IDS } from '../lib/themes.js'
import { oneOf } from '../lib/ui-kit.js'
import StageBackground from './StageBackground.jsx'

// A full-screen page on the stage (onboarding, sign-in): the design system's root (.g-root, so
// its tokens and type apply inside and nowhere else) with its accent preset, full height, on a
// StageBackground. The preset is the design system's own, not the app's <html data-accent>.
// `pushed` is a pushed page (StagePage): the stage at half intensity, with no calm zone — the
// roots' look is for a hero ring, and a dense list or an editor must stay readable.
export default function StageScreen({ accent = 'cobalt', pushed = false, children }) {
  oneOf('StageScreen', 'accent', accent, THEME_IDS)
  return (
    <div className={pushed ? 'g-root g-screen g-screen-pushed' : 'g-root g-screen'} data-accent={accent}>
      <StageBackground>{children}</StageBackground>
    </div>
  )
}
