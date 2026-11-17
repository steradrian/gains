import { t } from '../../lib/i18n.js'
import { formatBarcode } from '../../lib/nutrition/barcode.js'

// The code is read and being looked up (board Ea9Looking): your foods first, then Open Food Facts.
// A lookup that did not go through (offline, slow, refused) stays here with the reason and a retry,
// since nobody said the product does not exist (`error` is that reason).
export default function ScanLooking({ code, error, onRetry, onAgain }) {
  return (
    <div className="g-scan-foot">
      <span className={'g-scan-code' + (error ? '' : ' g-scan-busy')} dir="ltr">
        {!error && <span className="g-spin" aria-hidden="true" />}
        {formatBarcode(code)}
      </span>
      {error
        ? <>
            <span className="g-scan-hint" role="alert" data-step-heading>{error}</span>
            <div className="g-scan-row">
              <button type="button" className="g-scan-pill g-scan-pill-solid" onClick={onRetry}>{t('Try again')}</button>
              <button type="button" className="g-scan-pill" onClick={onAgain}>{t('Scan another')}</button>
            </div>
          </>
        : <span className="g-scan-hint" role="status" data-step-heading>{t('Looking in your foods, then Open Food Facts')}</span>}
    </div>
  )
}
