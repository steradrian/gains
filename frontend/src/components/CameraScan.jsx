import { useRef } from 'react'
import { t } from '../lib/i18n.js'
import { useCameraScan } from '../lib/use-camera-scan.js'
import { Button } from '../components/ui.jsx'
import { SheetHeader } from './sheet-layout.jsx'

// Live QR scanner for the browser/PWA (the app build uses ML Kit's own UI instead — see
// lib/scan.js). Opens the rear camera into a <video>, decodes a frame every ~150 ms until a QR
// shows up, then hands { value, fmt } to onFound. Cancel (or unmount) stops the camera. The food
// barcode scanner is its own overlay (components/ScanSheet.jsx) on the same reader.
//
// Errors are shown in place rather than thrown: a denied permission or a browser without
// getUserMedia leaves the sheet up with a message, and the add-card form underneath still offers
// photo import and typing.
export default function CameraScan({ onFound, onCancel }) {
  const videoRef = useRef(null)
  const { error } = useCameraScan({ video: videoRef, onFound })

  return <>
    <SheetHeader title={t('Scan')} />
    {error
      ? <div className="muted small mb-8 lh-150">
          {error === 'denied'
            ? t('Camera access was denied. Allow it in your browser and try again.')
            : t('No camera available here. Import a photo or type the code instead.')}
        </div>
      : <>
          <div className="cam-wrap">
            {/* playsInline keeps iOS from going full-screen; muted satisfies autoplay rules. */}
            <video ref={videoRef} playsInline muted autoPlay />
            <div className="cam-frame" aria-hidden="true" />
          </div>
          <div className="muted small ta-center mt-6 mb-8">{t('Point the camera at the QR code')}</div>
        </>}
    <Button variant="tinted" onClick={onCancel}>{t('Cancel')}</Button>
  </>
}
