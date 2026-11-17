import { useState } from 'react'
import { Check, Switch } from '../../../components/ui.jsx'
import Button from '../../../ds/Button.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageScreen from '../../../ds/StageScreen.jsx'
import { registerScreens } from '../registry.js'

// The controls that tick (ds/HapticSwitch.jsx, lib/use-haptic.js), side by side: the opted-in set
// beside the ones that stay silent. On an iPhone each ticking control carries an invisible native
// switch over it (inspect: input[data-slot="haptic-switch"]); on Android a tap vibrates; here, in a
// desktop browser, they look and act as the plain controls, which is the point.
function Controls() {
  const [on, setOn] = useState(true)
  const [set, setSet] = useState(false)
  return (
    <StageScreen>
      <div className="dsg-haptics">
        <StageNote>Ticks: the tap itself saved something.</StageNote>
        <Button block haptic>Save weigh-in</Button>
        <div className="dsg-haptics-row">
          <Switch aria-label="Haptics" checked={on} onChange={setOn} />
          <Check haptic label="Set 1 done" checked={set} onChange={setSet} />
        </div>
        <StageNote>Silent: it opens a sheet, goes on to ask, or moves to another page.</StageNote>
        <Button block variant="glass">Choose a different workout</Button>
      </div>
    </StageScreen>
  )
}

registerScreens('Native motion and haptics', [
  { id: 'H1.0', title: 'Haptic controls', note: 'The opted-in controls (Button, Switch, Check) beside the silent ones.', render: () => <Controls /> },
])
