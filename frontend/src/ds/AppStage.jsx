import { useDsAccent } from '../lib/use-ds-accent.js'
import { useStageLook } from '../lib/use-stage-look.js'
import { StageArt } from './StageBackground.jsx'
import StageLook from './StageLook.jsx'

// The app's one stage, drawn once and fixed behind every page (ds.css .g-app-stage): the gradient,
// the glows and the rings, and over them the chosen look. Pages are transparent over it, so a page
// change moves content across a shared surface and the ground never remounts. `pushed`: the page on
// top is a pushed one, which has the stage at half intensity (the glows and rings ease there; the
// look draws at half with no calm zone and stands still). It shows only while a page on the stage
// is on screen (a page that paints its own ground hides it).
export default function AppStage({ pushed = false }) {
  const accent = useDsAccent()
  const { look, intensity, motion } = useStageLook()
  return (
    <div className="g-root g-app-stage" data-accent={accent} data-pushed={pushed || undefined} aria-hidden="true">
      <StageArt />
      <StageLook look={look} intensity={intensity} pushed={pushed} motion={motion} accent={accent} />
    </div>
  )
}
