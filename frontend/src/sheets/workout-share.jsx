import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { BRAND } from '../brand.js'
import { todayISO } from '../lib/format.js'
import { workoutDay } from '../lib/history.js'
import { t } from '../lib/i18n.js'
import { MOBILE, shareExportBlob } from '../lib/mobile.js'
import { speedUnitOf } from '../lib/speed.js'
import { workoutText } from '../lib/workout-text.js'
import { workoutCardModel, layoutWorkoutCard, drawWorkoutCard, viewAspect, CARD_FONT } from '../lib/workout-card.js'
import { copyText } from '../lib/clipboard.js'
import { Switch } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import DetailRow from '../ds/DetailRow.jsx'
import { ui, toast } from './shared.js'

// T8.3 Share as image (#453): the card lib/workout-card.js lays out, on the stage's gradient in
// the person's accent, previewed before it goes anywhere; then Share, Save image and Copy text.
// The muscle map is the finish summary's, for this one session; whether the card carries it is
// remembered with the profile (`shareMap`). `w` is the record with its note as the workout drawer
// last showed it, `nameOf(entry)` the exercise's name as the drawer and "Copy as text" write it.
function ShareWorkoutDrawer({ w, nameOf, close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const withMap = st.shareMap !== false
  const model = useMemo(() => workoutCardModel(w, { unit: st.unit, nameOf }), [w, st.unit, nameOf])
  const card = useRef(null)
  // The last picture stays up while the next one is drawn, so the toggle never blanks the drawer.
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const shown = useRef(null)
  useEffect(() => {
    let alive = true
    workoutCardImage(model, { map: withMap, body: st.body, el: card.current })
      .then(blob => {
        if (!alive) return
        if (!blob) { setImg(prev => ({ ...prev, failed: true })); return }
        if (shown.current) URL.revokeObjectURL(shown.current)
        shown.current = URL.createObjectURL(blob)
        setImg({ blob, url: shown.current })
      })
      .catch(() => { if (alive) setImg(prev => ({ ...prev, failed: true })) })
    return () => { alive = false }
  }, [model, withMap, st.body])
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current) }, [])
  const name = 'gains-workout-' + (workoutDay(w) || todayISO()) + '.png'
  const share = async () => {
    setBusy(true)
    await shareImage(img.blob, name, w.name || BRAND.name)
    setBusy(false)
    close()
  }
  const save = async () => {
    setBusy(true)
    await saveImage(img.blob, name)
    setBusy(false)
  }
  const copy = async () => {
    toast(await copyText(workoutText(w, { unit: st.unit, nameOf, speedUnit: speedUnitOf(st) })) ? t('Copied') : t('Could not copy'))
  }
  const ready = !!img?.blob && !busy
  return (
    <BottomSheet title={t('Share workout')}
      footer={(
        <div className="g-wd-share-acts">
          <Button variant="secondary" disabled={!ready} onClick={share}>{t('Share')}</Button>
          <Button variant="secondary" disabled={!ready} onClick={save}>{t('Save image')}</Button>
          <Button variant="secondary" onClick={copy}>{t('Copy text')}</Button>
        </div>
      )}>
      <div ref={card} className="g-wd-card">
        {img?.url
          ? <img src={img.url} alt={t('Preview of the image to share')} />
          : img?.failed ? <p className="g-wd-card-ph">{t('Could not create the image')}</p>
            : <span className="g-wd-card-ph" aria-hidden="true" />}
      </div>
      {model.levels && (
        <DetailRow icon="figureStrength" title={t('Muscle map')} sub={t('Show which muscles this workout trained.')}
          trailing={<Switch checked={withMap} aria-label={t('Muscle map')} onChange={v => update(s => { s.shareMap = v })} />} />
      )}
    </BottomSheet>
  )
}

/** Opens T8.3 for the saved workout `w` (with its note as shown), named through `nameOf(entry)`. */
export const shareWorkoutSheet = (w, nameOf) => ui().openSheet(close => <ShareWorkoutDrawer w={w} nameOf={nameOf} close={close} />, { variant: 'ds' })

// The stage's colours are the drawer's own tokens (it is a design-system root in the person's
// accent), read off the element the preview sits in. Without them there is no card to draw.
async function workoutCardImage(model, { map, body, el }) {
  const css = name => (el ? getComputedStyle(el).getPropertyValue(name).trim() : '')
  const colors = { stage: css('--accent-stage'), stageEnd: css('--accent-stage-end'), label: css('--on-stage'), label2: css('--on-stage-2') }
  if (!colors.stage || !colors.label) return null
  colors.stageEnd = colors.stageEnd || colors.stage
  colors.label2 = colors.label2 || colors.label
  // The body geometry is ~90 KB and lazy everywhere else too (components/BodyMap.jsx).
  const geometry = map && model.levels ? (await import('../lib/body-paths.js')).default : null
  const shape = geometry && (geometry[body] || geometry.male)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const measure = (text, weight, size) => { ctx.font = `${weight} ${size}px ${CARD_FONT}`; return ctx.measureText(text).width }
  const layout = layoutWorkoutCard(model, { measure, rtl: document.documentElement.dir === 'rtl', map: shape ? { aspect: viewAspect(shape.front) } : null })
  canvas.width = layout.width
  canvas.height = layout.height
  drawWorkoutCard(ctx, layout, colors, shape ? { body: shape, levels: model.levels } : null)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

const download = (blob, name) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
// The phone app goes through the OS share sheet the way a backup does; a browser that can share
// files (most phones) opens its own; anything else saves the picture as a download.
async function shareImage(blob, name, title) {
  if (MOBILE) { try { await shareExportBlob(blob, name) } catch { /* share sheet dismissed */ } return }
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
  if (file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }) } catch { /* dismissed */ }
    return
  }
  download(blob, name)
  toast(t('Image saved'))
}
// Save image: a download in the browser; the phone app has no downloads folder of its own, so it
// hands the file to the OS sheet (Save to Files, Photos), as a backup does.
async function saveImage(blob, name) {
  if (MOBILE) { try { await shareExportBlob(blob, name) } catch { /* share sheet dismissed */ } return }
  download(blob, name)
  toast(t('Image saved'))
}
