import AppStage from '../../../ds/AppStage.jsx'
import { LOOKS, lookLabel } from '../../../lib/stage-look/index.js'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import Settings from '../../../views/Settings.jsx'
import { registerScreens } from '../registry.js'
import { both } from './today-fixture.js'

// The looks (PR-06 themes-m2, boards PR06Looks, LkToday*, LkSettings*): the real Today (a tab root,
// the chosen strength with the calm zone) and the real Settings (a pushed page: half strength, no
// calm zone) under the app's real stage, AppStage, which reads the look from the store. The frame
// is held still (Reduce motion on), so each shows its resting frame. Without WebGL (the test
// environment) the look draws nothing and Classic shows. Nothing here is stored.
const onStage = (pushed, screen) => () => (
  <>
    <AppStage pushed={pushed} />
    <div className="g-route" data-shared>{screen}</div>
  </>
)

const today = onStage(false, <TodayScreen {...both} />)
const settings = onStage(true, <Settings page={null} />)

const mock = (look, accent, intensity) => ({ S: { accent, bgLook: look, bgIntensity: intensity, reduceMotion: true } })

const looksOn = (prefix, title, render, note) => [
  ...LOOKS.map(look => ({
    id: `${prefix}.${look}`,
    title: `${title}: ${lookLabel(look)}`,
    note,
    render,
    mock: mock(look, 'cobalt', 0.45),
  })),
  { id: `${prefix}.light`, title: `${title}: Florals on Blossom`, note: 'A light stage: the print goes deeper than the stage.',
    render, mock: mock('florals', 'blossom', 0.5) },
]

registerScreens('Settings', [
  ...looksOn('PR06.L1', 'Today under a look', today, 'Cobalt at 45%. The calm zone sits behind the ring; quiet under the header and cards.'),
  ...looksOn('PR06.L2', 'Settings under a look', settings, 'A pushed page: half strength, no calm zone, standing still.'),
])
