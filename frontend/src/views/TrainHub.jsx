import { t } from '../lib/i18n.js'
import TrainScreen from './train/TrainScreen.jsx'
import { useTrain } from './train/use-train.js'

// Train, the second tab (PR-02): on the stage, a full-screen view that draws its own header
// (ui-guards PAGE_EXEMPT). Its data is useTrain's; TrainScreen draws it.
export default function TrainHub() {
  const train = useTrain()
  // While the search is open the tab root's header names the page instead.
  return <>
    {!train.searching && <h1 className="sr-only">{t('Training')}</h1>}
    <TrainScreen {...train} />
  </>
}
