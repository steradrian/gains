import { t } from '../../lib/i18n.js'
import Icon from '../Icon.jsx'

// Under the frame while the camera reads (board Ea9Scan): what to do, and the way to type the
// number when the bars will not read.
export default function ScanReading({ notice, onType }) {
  return (
    <div className="g-scan-foot">
      <span className="g-scan-hint" data-step-heading>{t('Point the camera at the barcode')}</span>
      {notice && <span className="g-scan-notice" role="alert">{notice}</span>}
      <button type="button" className="g-scan-pill" onClick={onType}><Icon name="keyboard" className="g-icon" />{t('Type the barcode')}</button>
    </div>
  )
}
