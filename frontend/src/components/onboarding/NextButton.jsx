import Button from '../../ds/Button.jsx'
import { t } from '../../lib/i18n.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { nextIsDone } from '../../lib/onboarding/flow.js'

// About you's Next (the kit's white footer button), off until the picker is touched. On the last
// step of a detour it says Done: it goes back to the end, not on to Training. Saves the body
// answers on the way.
export default function NextButton({ screen, ready }) {
  const { state, saveHubStep, next } = useOnboarding()
  return (
    <Button disabled={!ready} onClick={() => { saveHubStep('body'); next(screen) }}>
      {nextIsDone(screen, state.detour) ? t('Done') : t('Next')}
    </Button>
  )
}
