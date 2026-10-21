import { useId, useRef, useState } from 'react'
import { EXIDX, allExercises } from '../lib/exercises.js'
import { ALL_EQUIPMENT } from '../lib/equipment.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { cleanUrl, mediaOf, normalizeMediaRef } from '../lib/media-refs.js'
import { syncMedia } from '../lib/media-sync.js'
import { MUSCLES, MUSCLE_NAME, hasExplicitMuscleMetadata, inMuscleOrder, normalizeMuscleGroups } from '../lib/muscles.js'
import { LOG_CHOICES, logChoiceOf, withLogChoice } from '../lib/custom-exercise.js'
import { useSheetKeyboard } from '../lib/use-sheet-keyboard.js'
import { cx } from '../lib/ui-kit.js'
import { S, toast, update } from '../sheets/shared.js'
import Button from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import StageFooter from '../ds/StageFooter.jsx'
import TextField from '../ds/TextField.jsx'
import CustomMediaField from './CustomMediaField.jsx'
import Icon from './Icon.jsx'
import { MultiSelectRow } from './ui.jsx'
import '../views/train/exercises/exercises.css'

// The board's seven body parts (T6.4), each the app's own `bp` value: a catalogue body part, so the
// exercise files with the built-in ones. Lower arms, lower legs and neck have no chip; an exercise
// that already has one keeps it as a chip of its own, picked, and its muscles say the rest.
const BODY_PARTS = [
  { value: 'chest', label: 'Chest' }, { value: 'back', label: 'Back' }, { value: 'shoulders', label: 'Shoulders' },
  { value: 'upper arms', label: 'Arms' }, { value: 'upper legs', label: 'Legs' }, { value: 'waist', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
]
const LOG = {
  weight: { icon: 'dumbbell', title: 'Weight × reps', sub: 'Most strength exercises' },
  reps: { icon: 'figureStrength', title: 'Reps only', sub: 'No weight to enter. Just log the reps.' },
  time: { icon: 'timer', title: 'Time', sub: 'No weight to enter. Just time the hold.' },
  cardio: { icon: 'figureRun', title: 'Cardio', sub: 'Logs time and speed instead of weight × reps.' },
}

function initialPrimaries(existing) {
  if (existing && Array.isArray(existing.primaries) && existing.primaries.length) return [...existing.primaries]
  if (existing?.bp === 'cardio') return ['cardiovascular system']
  const norm = hasExplicitMuscleMetadata(existing || {}) ? normalizeMuscleGroups(existing || {}) : []
  return norm.length ? [norm[0]] : []
}
function initialSecondaries(existing) {
  if (existing && Array.isArray(existing.primaries) && existing.primaries.length) return [...(existing.secondaries || [])]
  const norm = hasExplicitMuscleMetadata(existing || {}) ? normalizeMuscleGroups(existing || {}) : []
  return norm.slice(1)
}

// "How you log it": four choices, one picked. A radio group of its own, since the kit's RadioRow
// is light only and this one also sits on the stage.
function LogChoice({ value, onChange, tone, labelledBy }) {
  const pick = (e, choice) => {
    const i = LOG_CHOICES.indexOf(choice)
    const rtl = e.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl'
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = LOG_CHOICES[(i + step + LOG_CHOICES.length) % LOG_CHOICES.length]
    onChange(next)
    e.currentTarget.parentElement.querySelector(`[data-choice="${next}"]`)?.focus()
  }
  return (
    <div className={cx('g-cxf-log', tone === 'stage' ? 'g-glass' : 'g-cxf-log-light')} role="radiogroup" aria-labelledby={labelledBy}>
      {LOG_CHOICES.map(choice => (
        <button key={choice} type="button" role="radio" aria-checked={value === choice} data-choice={choice}
          tabIndex={value === choice ? 0 : -1} className="g-cxf-logrow" onClick={() => onChange(choice)} onKeyDown={e => pick(e, choice)}>
          <span className="g-cxf-logic" aria-hidden="true"><Icon name={LOG[choice].icon} className="g-icon" /></span>
          <span className="g-cxf-logb"><b>{t(LOG[choice].title)}</b><span>{t(LOG[choice].sub)}</span></span>
          <span className="g-cxf-radio" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/**
 * Create or edit a custom exercise (issue #11, board T6.4). Name, body part and equipment are all
 * it takes; the exercise then behaves like any built-in one (planning, logging, PRs, stats). How
 * it is logged seeds a routine entry's mode (lib/custom-exercise.js). A photo, GIF or video of your
 * own and a link are optional (CustomMediaField): the state keeps a small reference to the file,
 * never the file itself, and the link is cleaned on save. The muscles and the description sit
 * under More details.
 *
 * Two hosts: the page /train/exercises/new (`tone="stage"`) and the light drawer behind
 * customExSheet (`tone="light"`), for callers inside a drawer or the workout.
 * `existing`: the exercise to edit, else a new one (`prefill` is its name). `onSaved(ex, { created })`
 * runs after the save; `onDelete` (edit only) is the host's Delete.
 */
export default function CustomExerciseForm({ existing, prefill, tone = 'light', onSaved, onDelete }) {
  const nameRef = useRef(null)
  const onNameFocus = useSheetKeyboard(nameRef, tone === 'light')
  const logId = useId()
  const [n, setN] = useState(existing ? existing.n : (prefill || ''))
  const [bp, setBp] = useState(existing ? existing.bp : '')
  const [eq, setEq] = useState(existing ? (existing.eq || '') : '')
  const [log, setLog] = useState(() => (existing ? logChoiceOf(existing) : 'weight'))
  const [logTouched, setLogTouched] = useState(!!existing)
  // An imported exercise can carry equipment or a body part the chips do not have (`custom` from
  // a CSV or Hevy import, an old "lower legs"). It stays a chip of its own, picked, so Save does
  // not stop on "Pick equipment".
  const storedEq = existing && typeof existing.eq === 'string' && existing.eq && !ALL_EQUIPMENT.includes(existing.eq) ? existing.eq : null
  const storedBp = existing && existing.bp && !BODY_PARTS.some(b => b.value === existing.bp) ? existing.bp : null
  const [desc, setDesc] = useState(existing ? (existing.desc || '') : '')
  const [media, setMedia] = useState(() => mediaOf(existing))
  // Whether this form changed the media at all. An edit that did not touch it writes back what the
  // exercise had, byte for byte: a ref from a newer version of the app (a codec or type this one
  // does not know) reads as nothing here, and re-normalizing it on a rename would delete it on
  // every device.
  const [mediaTouched, setMediaTouched] = useState(false)
  const [url, setUrl] = useState(existing && typeof existing.url === 'string' ? existing.url : '')
  const onMedia = patch => {
    if ('media' in patch) { setMedia(patch.media); setMediaTouched(true) }
    if ('url' in patch) setUrl(patch.url)
  }
  const [primaries, setPrimaries] = useState(() => initialPrimaries(existing))
  const [secondaries, setSecondaries] = useState(() => initialSecondaries(existing))
  const [more, setMore] = useState(() => !!(existing && (existing.desc || primaries.length || secondaries.length)))
  // Every primary chip this form saw a tap on, in that order. `primaries` alone cannot say what the
  // user reached for first: an existing exercise seeds it in the map's order, because that is how the
  // muscles are stored. The taps are the only record of the user's own order, and they decide the
  // target when the one the exercise had is un-ticked.
  const [primaryTaps, setPrimaryTaps] = useState([])
  const togglePrimary = value => {
    setPrimaryTaps(current => [...current, value])
    setPrimaries(current => current.includes(value) ? current.filter(m => m !== value) : [...current, value])
  }
  const toggleSecondary = value => setSecondaries(current => current.includes(value) ? current.filter(m => m !== value) : [...current, value])
  // Picking Cardio as the body part picks Cardio as the way it is logged, until the person picks one.
  const pickBp = value => {
    setBp(value)
    if (!logTouched) setLog(value === 'cardio' ? 'cardio' : 'weight')
  }
  const pickLog = value => { setLog(value); setLogTouched(true) }

  const save = () => {
    const name = n.trim()
    if (!name) { toast(t('Give it a name')); return }
    if (!bp) { toast(t('Pick a body part')); return }
    if (!eq) { toast(t('Pick equipment')); return }
    // An exercise kept under its own name is not a duplicate, even when the catalogue has one
    // spelled the same (an imported "trap bar deadlift"): only a new or changed name is checked.
    const renamed = !existing || name.toLowerCase() !== String(existing.n || '').trim().toLowerCase()
    const dup = renamed && allExercises(S()).find(e => e.n.toLowerCase() === name.toLowerCase() && e.id !== (existing || {}).id)
    if (dup) { toast(t('“{0}” already exists', dup.n)); return }
    const d = desc.trim().slice(0, 1000)
    // An empty field removes the link; anything else has to be a web address.
    const link = url.trim() ? cleanUrl(url) : null
    if (url.trim() && !link) { toast(t('That link is not a web address')); return }
    const keepMedia = !!existing && !mediaTouched
    const ref = keepMedia ? null : normalizeMediaRef(media)
    // Stored in the map's order, not the order the chips were tapped in: the tags on the exercise
    // used to shuffle with every edit.
    const prim = bp === 'cardio' ? ['cardiovascular system'] : inMuscleOrder(primaries)
    const sm = inMuscleOrder(secondaries.filter(m => !prim.includes(m)))
    const groups = [...prim, ...sm]
    // The one-word target (the library row, the picker, the Muscles view) is not the sorted list's
    // head: a hip thrust with Traps as an extra primary is not a Traps exercise. It is the primary
    // tapped first, and an edit keeps the exercise's target as long as that muscle is still a primary.
    // Once that muscle is gone the next answer is the first one tapped here that survived; a tap that
    // only turned a chip off says nothing and is skipped with it. The sorted list is the last resort,
    // for the user who drops the target and adds nothing in its place.
    const tg = (existing && prim.includes(existing.tg)) ? existing.tg : (primaryTaps.find(m => prim.includes(m)) || prim[0] || '')
    let id = existing && existing.id
    const fill = c => {
      c.n = name; c.bp = bp; c.desc = d; c.tg = tg; c.sm = sm; c.muscleGroups = groups; c.primaries = prim; c.secondaries = sm; c.eq = eq
      withLogChoice(c, log)
      if (!keepMedia) { if (ref) c.media = ref; else delete c.media }
      if (link) c.url = link; else delete c.url
    }
    if (existing) update(s => { const c = (s.customEx || []).find(x => x.id === id); if (c) fill(c) })
    else {
      id = 'c' + uid()
      update(s => { const c = { id, custom: true }; fill(c); (s.customEx = s.customEx || []).push(c) })
    }
    // The file goes to the server now rather than after the state's own debounce: another device
    // that sees the reference first shows a tile until it arrives.
    if (ref) syncMedia({ force: true })
    toast(existing ? t('Saved') : t('“{0}” created', name))
    onSaved?.(EXIDX[id], { created: !existing })
  }

  const stage = tone === 'stage'
  const chipTone = stage ? 'stage' : 'light'
  const bodyParts = [...BODY_PARTS, ...(storedBp ? [{ value: storedBp, label: storedBp }] : [])]
  const equipment = [...ALL_EQUIPMENT, ...(storedEq ? [storedEq] : [])]
  const actions = <>
    <Button block onClick={save}>{existing ? t('Save') : t('Create exercise')}</Button>
    {existing && onDelete && <Button block variant={stage ? 'ghost' : 'danger'} icon="trash" onClick={onDelete}>{t('Delete exercise')}</Button>}
  </>

  return (
    <div className={cx('g-cxf', stage ? 'g-cxf-stage' : 'g-cxf-light')}>
      <div className={cx('g-cxf-name', stage && 'g-glass')}>
        <TextField label={t('Exercise name')} value={n} tone={chipTone} onChange={setN} inputRef={nameRef}
          inputProps={{ maxLength: 80, onFocus: onNameFocus, autoComplete: 'off' }} />
      </div>

      <h2 className="g-cxf-h">{t('Body part')}</h2>
      <ChipGroup tone={chipTone} label={t('Body part')} value={bp} onChange={pickBp}
        options={bodyParts.map(b => ({ value: b.value, label: t(b.label) }))} />

      <h2 className="g-cxf-h">{t('Equipment')}</h2>
      <ChipGroup tone={chipTone} label={t('Equipment')} value={eq} onChange={setEq} scroll
        options={equipment.map(k => ({ value: k, label: t(k) }))} />

      <h2 className="g-cxf-h" id={logId}>{t('How you log it')}</h2>
      <LogChoice value={log} onChange={pickLog} tone={chipTone} labelledBy={logId} />

      <h2 className="g-cxf-h">{t('Picture or video')} <span>{t('Optional')}</span></h2>
      <div className="g-cxf-card">
        <CustomMediaField media={media} url={url} onChange={onMedia} />
      </div>

      <button type="button" className="g-cxf-more" aria-expanded={more} onClick={() => setMore(v => !v)}>
        {t('More details')}<Icon name={more ? 'chevronUp' : 'chevronDown'} className="g-icon" />
      </button>
      {more && (
        <div className="g-cxf-card">
          {bp && bp !== 'cardio' && <MultiSelectRow title={t('Primary muscle groups')} sheetTitle={t('Primary muscle groups')}
            values={primaries}
            options={MUSCLES.map(m => ({ value: m, label: t(MUSCLE_NAME[m]) }))}
            onToggle={togglePrimary} noneLabel={t('No explicit muscle group')} doneLabel={t('Done')} />}
          {bp && <MultiSelectRow title={t('Additional muscle groups')} sheetTitle={t('Additional muscle groups')}
            values={secondaries}
            options={MUSCLES.filter(m => !primaries.includes(m)).map(m => ({ value: m, label: t(MUSCLE_NAME[m]) }))}
            onToggle={toggleSecondary} noneLabel={t('No explicit muscle group')} doneLabel={t('Done')} />}
          {!bp && <p className="g-cxf-note">{t('Pick a body part to choose the muscles.')}</p>}
          <textarea className="input" rows={4} maxLength={1000} aria-label={t('Description')}
            placeholder={t('Description (optional): setup, cues, anything you want to remember')}
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
      )}

      {stage ? <StageFooter sticky={false}>{actions}</StageFooter> :<div className="g-cxf-actions">{actions}</div>}
    </div>
  )
}
