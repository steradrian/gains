import SavedIndicator from '../../../ds/SavedIndicator.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import Tabs from '../../../ds/Tabs.jsx'
import { t } from '../../../lib/i18n.js'
import ProgressPhotos from '../../ProgressPhotos.jsx'
import MeasurementsTab, { measureSub } from './MeasurementsTab.jsx'
import WeighInsTab, { bodySub } from './WeighInsTab.jsx'
import './body.css'

// The Body page (board Me2Body), pushed from Me at /me/body: the title with the latest weigh-in (or,
// on Measurements, what is tracked), the Saved / offline pill when the connection says something,
// three tabs, and the tab's body. The bar's action logs what the tab is about. Weigh-ins and
// Measurements are drawn here; Photos is the page it was, mounted as it is until its own milestone.
// `pill`: { state, waiting } for ds/SavedIndicator, or null. `measure`: measureOf's data;
// `onLogMeasure` and `onChooseMeasure` open the Measurements drawers.
export default function BodyScreen({ tab = 'weigh-ins', onTab, data, range, onRange, waiting, asks = true, pill, onLog, onOpen, measure, onLogMeasure, onChooseMeasure }) {
  const measuring = tab === 'measurements' && !!measure
  return (
    <StagePage largeTitle={t('Body')} sub={measuring ? measureSub(measure) : bodySub(data)} parent="/me"
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
          {tab === 'measurements' ? (measure && <MeasurementsTab data={measure} range={range} onRange={onRange} onLog={onLogMeasure} onChoose={onChooseMeasure} />)
            : tab === 'photos' ? <ProgressPhotos />
              : <WeighInsTab data={data} range={range} onRange={onRange} waiting={waiting} asks={asks} onLog={onLog} onOpen={onOpen} />}
        </div>
      </div>
    </StagePage>
  )
}
