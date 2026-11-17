import { forwardRef, useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { SheetHeader } from '../../../components/sheet-layout.jsx'

// The update's progress sheet: `ref` is a callback that receives a (received, total) setter, so the
// caller can push byte counts in without re-rendering the whole page.
const DownloadProgress = forwardRef(function DownloadProgress(_, ref) {
  const [pct, setPct] = useState(0)
  const [text, setText] = useState(t('Starting download…'))
  if (ref) ref(function update(received, total) {
    if (total > 0) {
      const p = Math.min(100, Math.round((received / total) * 100))
      setPct(p)
      setText(t('{0} %', p))
    } else {
      setText(t('{0} MB', (received / 1_000_000).toFixed(1)))
    }
  })
  return (
    <div className="ta-center set-dl">
      <SheetHeader title={t('Downloading update…')} />
      <progress className="set-dl-bar" max={100} value={pct} aria-label={t('Downloading update…')} />
      <div className="muted small">{text}</div>
    </div>
  )
})

export default DownloadProgress
