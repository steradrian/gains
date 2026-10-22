import { useOfflinePill } from '../../today/use-offline-pill.js'
import BodyScreen from './BodyScreen.jsx'
import { useBody } from './use-body.js'
import { manageMeasurementsSheet, measurementLogSheet } from './measure-drawers.jsx'
import { editWeighInSheet, logWeightSheet } from './weigh-in-drawers.jsx'

// /me/body, /me/body/measurements and /me/body/photos: the data from useBody, the drawers from
// weigh-in-drawers.jsx and measure-drawers.jsx, drawn by BodyScreen.
export default function BodyRoute() {
  const pill = useOfflinePill()
  const body = useBody({ offline: pill?.state === 'offline' })
  return (
    <BodyScreen
      tab={body.tab} onTab={body.pickTab} data={body.data} range={body.range} onRange={body.pickRange}
      waiting={body.waiting} asks={body.asks} pill={pill}
      onLog={logWeightSheet} onOpen={editWeighInSheet}
      measure={body.measure} onLogMeasure={() => measurementLogSheet()} onChooseMeasure={manageMeasurementsSheet} />
  )
}
