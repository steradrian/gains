import StageEmpty from '../../ds/StageEmpty.jsx'
import { t } from '../../lib/i18n.js'

// Camera is blocked, or there is none (board Ea9Denied): how to allow it, and the way on that needs
// no camera. `reason` is the camera hook's error: 'denied' or 'unavailable'.
export default function ScanDenied({ reason, onType, onRetry }) {
  const blocked = reason === 'denied'
  return (
    <div className="g-scan-denied">
      <StageEmpty card={false} illustration="search"
        title={blocked ? t('Camera is blocked') : t('No camera found')}
        body={blocked
          ? t('Allow the camera for Gains in your browser settings, then scan again. Or type the number under the barcode.')
          : t('This device has no camera Gains can use. Type the number under the barcode.')}
        action={t('Type the barcode')} onClick={onType}
        actions={blocked ? [{ label: t('Try again'), onClick: onRetry }] : []} />
    </div>
  )
}
