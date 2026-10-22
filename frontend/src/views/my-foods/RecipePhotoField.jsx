import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { limitsFrom } from '../../lib/media-limits.js'
import { mediaStore } from '../../lib/media-store.js'
import { mediaErrorText } from '../../components/CustomMediaField.jsx'
import Button from '../../ds/Button.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'

// The recipe's photo (board Ea5Recipe): "Add a photo, Take one or pick from your library". One file
// input for both: a phone offers its camera and its library for an image input. The photo is made
// the way every other photo in the app is (lib/media-ingest.js: checked on its bytes, re-encoded,
// scrubbed) and kept in the local media store as pending, so media sync uploads it. The recipe
// keeps its reference in the synced state (recipe-extras.js), which also keeps the file from the
// clean-up, here and on the server.

// The ingest is split off and loaded on first use.
const loadIngest = () => import('../../lib/media-ingest.js')

function usePhotoUrl(photo) {
  const hash = photo?.poster?.hash || photo?.hash || null
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!hash) { setUrl(null); return undefined }
    let live = true
    let held = false
    mediaStore.url(hash).then(found => {
      if (!live) { if (found) mediaStore.release(hash); return }
      held = !!found
      setUrl(found)
    }).catch(() => {})
    return () => { live = false; if (held) mediaStore.release(hash) }
  }, [hash])
  return url
}

export default function RecipePhotoField({ photo, onChange }) {
  const config = useStore(s => s.config)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const url = usePhotoUrl(photo)

  // The file stays out of the local clean-up while this editor is open, before the recipe has been
  // saved with it.
  const mainHash = photo?.hash, posterHash = photo?.poster?.hash
  useEffect(() => {
    if (!mainHash) return undefined
    return mediaStore.hold([mainHash, posterHash])
  }, [mainHash, posterHash])

  async function onFile(ev) {
    const file = ev.target.files && ev.target.files[0]
    ev.target.value = ''   // picking the same file again still fires onChange
    if (!file || busy) return
    setBusy(true)
    try {
      await mediaStore.ready()
      if (!mediaStore.persistent) { useUI.getState().toast(t('This browser cannot store photos here.')); return }
      const { ingestMediaFile } = await loadIngest()
      const out = await ingestMediaFile(file, limitsFrom(config))
      if (out.media.kind !== 'image') { useUI.getState().toast(t('That is not a photo.')); return }
      for (const b of out.blobs) await mediaStore.put(b.hash, b.blob, { mime: b.mime, pending: true })
      onChange(out.media)
    } catch (e) {
      useUI.getState().toast(mediaErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const open = () => fileRef.current?.click()
  return (
    <div className="g-rec-photo">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      {photo
        ? (
          <>
            <div className="g-rec-photo-frame">{url && <img src={url} alt={t('Recipe photo')} draggable={false} />}</div>
            <div className="g-rec-photo-acts">
              <Button variant="glass" size="sm" icon="camera" busy={busy} onClick={open}>{t('Change photo')}</Button>
              <Button variant="glass" size="sm" icon="trash" disabled={busy} onClick={() => onChange(null)}>{t('Remove photo')}</Button>
            </div>
          </>
        )
        : (
          <div className="g-glist g-glass g-fe-list">
            <GlassValueRow icon="camera" title={t('Add a photo')} sub={t('Take one or pick from your library')} onClick={busy ? undefined : open} />
          </div>
        )}
    </div>
  )
}
