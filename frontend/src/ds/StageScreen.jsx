import { oneOf } from '../lib/ui-kit.js'
import StageBackground from './StageBackground.jsx'

export const ACCENTS = ['cobalt', 'moss', 'ember', 'tide', 'plum', 'ink']

// A full-screen page on the stage (onboarding, sign-in): the design system's root (.g-root, so
// its tokens and type apply inside and nowhere else) with its accent preset, full height, on a
// StageBackground. The preset is the design system's own, not the app's <html data-accent>.
export default function StageScreen({ accent = 'cobalt', children }) {
  oneOf('StageScreen', 'accent', accent, ACCENTS)
  return (
    <div className="g-root g-screen" data-accent={accent}>
      <StageBackground>{children}</StageBackground>
    </div>
  )
}
