import SavedIndicator from '../../../ds/SavedIndicator.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import Tabs from '../../../ds/Tabs.jsx'
import { t } from '../../../lib/i18n.js'
import Measurements from '../../Measurements.jsx'
import PhotosTab from '../photos/PhotosTab.jsx'
import { usePhotosSub } from '../photos/use-photos.js'
import WeighInsTab, { bodySub } from './WeighInsTab.jsx'
import './body.css'

// The Body page (board Me2Body), pushed from Me at /me/body: the title with the latest weigh-in, the
// Saved / offline pill when the connection says something, three tabs, and the tab's body. Log weight
// is the bar's action. Weigh-ins is this milestone's, Photos is views/me/photos/PhotosTab.jsx;
// Measurements is the page it was, mounted as it is until body-M2.
// `pill`: { state, waiting } for ds/SavedIndicator, or null.
export default function BodyScreen({ tab = 'weigh-ins', onTab, data, range, onRange, waiting, asks = true, pill, onLog, onOpen }) {
  const photosSub = usePhotosSub(tab === 'photos')
  return (
    <StagePage largeTitle={t('Body')} sub={tab === 'photos' ? photosSub : bodySub(data)} parent="/me"
      actions={[{ icon: 'plus', label: t('Log weight'), onClick: onLog }]}>
      <div className="bd">
        {pill && (
          <div className="bd-pill"><SavedIndicator tone="stage" state={pill.state} waiting={pill.waiting} /></div>
        )}
        <div className="bd-tabs">
          <Tabs label={t('Body')} controls="bd-panel" value={tab} onChange={onTab}
            options={[{ value: 'weigh-ins', label: t('Weigh-ins') }, { value: 'measurements', label: t('Measurements') }, { value: 'photos', label: t('Photos') }]} />
        </div>
        <div id="bd-panel" role="tabpanel">
          {tab === 'measurements' ? <Measurements />
            : tab === 'photos' ? <PhotosTab />
              : <WeighInsTab data={data} range={range} onRange={onRange} waiting={waiting} asks={asks} onLog={onLog} onOpen={onOpen} />}
        </div>
      </div>
    </StagePage>
  )
}
