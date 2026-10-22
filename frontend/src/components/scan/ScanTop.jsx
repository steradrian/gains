import { t } from '../../lib/i18n.js'
import Icon from '../Icon.jsx'

// The overlay's top bar (board Ea9Scan): × returns to where Scan opened, the title, and the torch
// where the camera has one. Without the torch an empty slot keeps the title centred. `bare` is
// the × alone (Camera is blocked).
export default function ScanTop({ onClose, torch, bare = false }) {
  return (
    <div className="g-scan-top">
      <button type="button" className="g-scan-btn" aria-label={t('Close scan')} onClick={onClose}><Icon name="xmark" className="g-icon" /></button>
      {!bare && <h2>{t('Scan a barcode')}</h2>}
      {!bare && (torch?.available
        ? <button type="button" className="g-scan-btn" aria-label={t('Torch')} aria-pressed={torch.on} onClick={torch.toggle}><Icon name="flashlight" className="g-icon" /></button>
        : <span className="g-scan-gap" aria-hidden="true" />)}
    </div>
  )
}
