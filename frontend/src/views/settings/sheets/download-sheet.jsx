import { useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t, tn } from '../../../lib/i18n.js'
import { referencedFiles } from '../../../lib/media-refs.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import { useDataActions } from '../use-data-actions.js'

export const openDownloadSheet = () => useUI.getState().openSheet(close => <DownloadSheet close={close} />, { variant: 'ds' })

const len = list => (Array.isArray(list) ? list.length : 0)

/* A2.7 and A2.8: "Download my data". The drawer says what the file holds, counted from the
   profile on this device (the same state the backup exports), then Prepare download builds it: a
   JSON file, or a .zip with the photos and videos when there are any. A built file is saved from
   the toast's Save (A2.8), a tap of its own, because a download started after the wait for a
   large zip is no longer a user gesture and Safari refuses it. Food is not in it: the diary
   lives with NutriTrace, not in Gains' state. */
export function DownloadSheet({ close }) {
  const S = useStore(s => s.S)
  const { buildJson, buildZip, saveFile } = useDataActions()
  const [busy, setBusy] = useState(false)
  const media = referencedFiles(S).length
  const prepare = async () => {
    if (busy) return
    setBusy(true)
    let file
    try { file = media > 0 ? await buildZip() : buildJson() } finally { setBusy(false) }
    if (!file) return
    close()
    useUI.getState().toast(t('Your data is ready'), { action: t('Save'), body: file.name, onAction: () => saveFile(file) })
  }
  return (
    <BottomSheet title={t('Download my data')} onClose={close}>
      <div className="g-acct-sheet">
        <div>
          <DetailRow icon="dumbbell" title={t('Training')}
            sub={[tn('{0} workout', '{0} workouts', len(S.workouts)), tn('{0} routine', '{0} routines', len(S.routines))].join(', ')} />
          <DetailRow icon="scale" title={t('Body')}
            sub={[tn('{0} weigh-in', '{0} weigh-ins', len(S.bodyweight)), tn('{0} measurement', '{0} measurements', len(S.measurements))].join(', ')} />
          {media > 0 && <DetailRow icon="camera" title={t('Photos')} sub={tn('{0} photo or video', '{0} photos or videos', media)} />}
        </div>
        <p className="g-acct-p">{media > 0 ? t('A .zip with your data as a JSON file anyone can read, and your photos and videos.') : t('A JSON file anyone can read.')}</p>
        <Button busy={busy} onClick={prepare}>{t('Prepare download')}</Button>
      </div>
    </BottomSheet>
  )
}
