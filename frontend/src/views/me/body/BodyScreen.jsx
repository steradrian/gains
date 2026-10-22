import SavedIndicator from '../../../ds/SavedIndicator.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import Tabs from '../../../ds/Tabs.jsx'
import { t } from '../../../lib/i18n.js'
import PhotosTab from '../photos/PhotosTab.jsx'
import { usePhotosSub } from '../photos/use-photos.js'
import MeasurementsTab, { measureSub } from './MeasurementsTab.jsx'
import WeighInsTab, { bodySub } from './WeighInsTab.jsx'
import './body.css'

// The Body page (board Me2Body), pushed from Me at /me/body: the title with the latest weigh-in (or,
// on Measurements, what is tracked; on Photos, the photo count), the Saved / offline pill when the
// connection says something, three tabs, and the tab's body. The bar's action logs what the tab is
// about. Weigh-ins and Measurements are drawn here; Photos is views/me/photos/PhotosTab.jsx.
// `pill`: { state, waiting } for ds/SavedIndicator, or null. `measure`: measureOf's data;
// `onLogMeasure`, `onOpenMeasure(day)` and `onChooseMeasure` open the Measurements drawers.
export default function BodyScreen({ tab = 'weigh-ins', onTab, data, range, onRange, waiting, asks = true, pill, onLog, onOpen, measure, onLogMeasure, onOpenMeasure, onChooseMeasure }) {
  const photosSub = usePhotosSub(tab === 'photos')
  const measuring = tab === 'measurements' && !!measure
  const sub = tab === 'photos' ? photosSub : measuring ? measureSub(measure) : bodySub(data)
  return (
    <StagePage largeTitle={t('Body')} sub={sub} parent="/me"
      actions={measuring ? [{ icon: 'plus', label: t('Log measurements'), onClick: onLogMeasure }] : [{ icon: 'plus', label: t('Log weight'), onClick: onLog }]}>
      <div className="bd">
        {pill && (
          <div className="bd-pill"><SavedIndicator tone="stage" state={pill.state} waiting={pill.waiting} /></div>
        )}
        <div className="bd-tabs">
          <Tabs label={t('Body')} controls="bd-panel" value={tab} onChange={onTab}
            options={[{ value: 'weigh-ins', label: t('Weigh-ins') }, { value: 'measurements', label: t('Measurements') }, { value: 'photos', label: t('Photos') }]} />
        </div>
        <div id="bd-panel" role="tabpanel">
          {tab === 'measurements' ? (measure && <MeasurementsTab data={measure} range={range} onRange={onRange} onLog={onLogMeasure} onOpen={onOpenMeasure} onChoose={onChooseMeasure} />)
            : tab === 'photos' ? <PhotosTab />
              : <WeighInsTab data={data} range={range} onRange={onRange} waiting={waiting} asks={asks} onLog={onLog} onOpen={onOpen} />}
        </div>
      </div>
    </StagePage>
  )
}
