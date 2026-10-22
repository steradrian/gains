import { t } from '../../../lib/i18n.js'
import Button from '../../../ds/Button.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageRing from '../../../ds/StageRing.jsx'
import SettingsPage from '../SettingsPage.jsx'

/**
 * Importing (board St1Importing), for the one import that takes time: Hevy's account, fetched page
 * by page. `fraction` is 0 to 1 (import-progress.js), `label` the line under the ring. A file
 * import is parsed and merged in one go, so it goes straight to the done screen.
 *
 * The board promises that the import keeps going if you leave and that a notification says when
 * it is done. It does not: leaving this page drops the fetch's result, and nothing notifies. So
 * the note asks to keep the page open, and Cancel stops waiting.
 */
export default function ImportProgressScreen({ source, label, fraction, onCancel }) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100)
  return (
    <SettingsPage title={t('Importing')} line={source}>
      <div className="g-imp-progress">
        <StageRing value={pct} max={100} top={source} big={pct + '%'} />
        <p className="g-imp-label" aria-live="polite">{label}</p>
        <StageNote>{t('Keep this page open until it finishes.')}</StageNote>
        <Button variant="glass" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </SettingsPage>
  )
}
