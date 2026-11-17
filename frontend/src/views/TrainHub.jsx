import TrainScreen from './train/TrainScreen.jsx'
import { useTrain } from './train/use-train.js'

// Train, the second tab (PR-02): on the stage, a full-screen view that draws its own header
// (ui-guards PAGE_EXEMPT). Its data is useTrain's; TrainScreen draws it.
export default function TrainHub() {
  return <TrainScreen {...useTrain()} />
}
