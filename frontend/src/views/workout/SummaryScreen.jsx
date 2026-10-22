// The summary after Finish and save (boards W2.0 Wk2Summary, W2.2 Wk2First), on
// /train/workout/summary/:id, which replaced the workout's route, so Back never returns to a
// finished session. It reads the saved workout by id (use-summary.js), so a reload shows the same
// page. Done (and ×) go back where the workout was opened from, and Today then says "Saved Push A"
// with Reopen for 10 s (W2.1), counted from Done: the snapshot finishToSummary held is handed over
// once (takeReopen) and lives only as long as that toast. No Friends section (owner question 7).
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { nav } from '../../lib/nav.js'
import { levelsOf } from '../../lib/muscles.js'
import { back } from '../../lib/use-tab-nav.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import { writeWorkoutNote } from '../../lib/workout-note.js'
import { REOPEN_MS, reopenWorkout } from '../../lib/workout-reopen.js'
import { NOTE_MAX } from '../../lib/history.js'
import WorkoutMediaSection from '../../components/WorkoutMedia.jsx'
import Icon from '../../components/Icon.jsx'
import Act from '../../ds/Act.jsx'
import BodyMap from '../../ds/BodyMap.jsx'
import Button from '../../ds/Button.jsx'
import ExerciseThumbRow from '../../ds/ExerciseThumbRow.jsx'
import GlassList from '../../ds/GlassList.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StatTiles from '../../ds/StatTiles.jsx'
import LoadLegend from '../train/load/LoadLegend.jsx'
import { pictureOf } from '../train/use-train.js'
import { takeReopen } from './finish-drawers.js'
import { useSummary } from './use-summary.js'
import './summary.css'

// The trend pill on a trained row, as the board draws it: glass, and the warm one for down.
const trendClass = trend => (trend === 'down' ? 'g-tag g-sum-down' : 'g-tag g-tag-glass')

/**
 * Leaves the summary: back where the workout was opened from, then the Saved toast. With the
 * snapshot the save held, the toast offers Reopen for REOPEN_MS from now; its life is the limit
 * (a toast held under a finger still reopens), so Reopen gets a copy dated now and the copy is
 * dropped when the toast goes. Without one (a reload, a backfill) it only says it was saved.
 */
function leaveSummary(w) {
  const name = w.name || t('Workout')
  const snap = takeReopen(w.id)
  back()
  const { toast } = useUI.getState()
  if (!snap) { toast(t('Saved {0}', name)); return }
  let live = { ...snap, at: Date.now() }
  toast(t('Saved {0}', name), {
    action: t('Reopen'),
    ms: REOPEN_MS,
    onAction: () => { if (live && reopenWorkout(live, live.at)) nav('/train/workout') },
    onClose: () => { live = null },
  })
}

// Session note: an "Add a note" row that opens the box in place; a note already there shows in
// it. It writes on blur and when the page goes (Done, Back, a reload of the route), as the
// workout's drawer does, and only what was typed here: a note synced in meanwhile is not undone.
function SessionNote({ w, initial, noteRef }) {
  const [open, setOpen] = useState(!!initial)
  const [text, setText] = useState(initial)
  const box = useRef(null)
  const asked = useRef(false)
  useEffect(() => {
    if (open && asked.current) box.current?.focus()
  }, [open])
  const save = () => {
    if (!noteRef.current.dirty) return
    writeWorkoutNote(w, noteRef.current.text)
    noteRef.current.dirty = false
  }
  if (!open) {
    return (
      <GlassList items={[{ icon: 'pencil', title: t('Add a note'), sub: t('How it went, what to change'), onClick: () => { asked.current = true; setOpen(true) } }]} />
    )
  }
  return (
    <div className="g-sum-note g-glass">
      <textarea
        ref={box}
        rows={3}
        maxLength={NOTE_MAX}
        value={text}
        aria-label={t('Session note')}
        placeholder={t('How it went, what to change')}
        onChange={e => { setText(e.target.value); noteRef.current = { text: e.target.value, dirty: true } }}
        onBlur={save}
      />
    </div>
  )
}

export default function SummaryScreen() {
  const { id } = useParams()
  const m = useSummary(id)
  const accent = useDsAccent()
  const S = useStore(s => s.S)
  const w = m?.w || null
  // The note as typed, for the write when the page goes; `dirty` until it is written.
  const noteRef = useRef({ text: m?.note || '', dirty: false })
  const wRef = useRef(w)
  wRef.current = w
  const left = useRef(false)
  useEffect(() => () => {
    if (noteRef.current.dirty && wRef.current) writeWorkoutNote(wRef.current, noteRef.current.text)
  }, [])

  if (!m) {
    return (
      <StageScreen accent={accent}>
        <div className="g-sum g-sum-empty">
          <StageEmpty card={false} illustration="calendar" title={t('This workout isn’t in your history')} action={t('Back')} onClick={() => back()} />
        </div>
      </StageScreen>
    )
  }

  const done = () => {
    if (left.current) return
    left.current = true
    if (noteRef.current.dirty) {
      writeWorkoutNote(w, noteRef.current.text)
      noteRef.current.dirty = false
    }
    leaveSummary(w)
  }
  const tiles = m.tiles.map(x => ({
    label: x.label, value: x.value,
    sub: x.delta?.text || undefined,
    tone: x.delta?.dir > 0 ? 'positive' : undefined,
  }))

  return (
    <StageScreen accent={accent}>
      <div className="g-sum">
        <div className="g-wtop">
          <span className="g-sum-eyebrow">{m.eyebrow}</span>
          <Act onClick={done} ariaLabel={t('Close')} className="g-wtop-btn g-glass">
            <Icon name="xmark" className="g-icon" />
          </Act>
        </div>
        <header className="g-sum-head">
          <h1 className="g-sum-title">{m.title}</h1>
          {m.dateLine && <p className="g-sum-date">{m.dateLine}</p>}
        </header>
        <div className="g-sum-pad"><StatTiles tone="stage" items={tiles} /></div>

        {m.first && m.firstNote && (
          <section>
            <StageSection title={t('Your first time')} />
            <p className="g-sum-first g-glass">{m.firstNote}</p>
          </section>
        )}

        {m.bests.length > 0 && (
          <section>
            <StageSection title={t('New bests')} />
            <div className="g-sum-pad">
              <GlassList items={m.bests.map(b => ({ icon: b.kind === 'e1rm' ? 'chartLine' : 'trophy', title: b.name, sub: b.text }))} />
            </div>
          </section>
        )}

        <section>
          <StageSection title={t('Muscles worked')} />
          <div className="g-sum-pad">
            <div className="g-load-card g-glass">
              <BodyMap levels={levelsOf(m.muscles)} body={S.body} label={t('Muscle map')} />
              <LoadLegend less={t('Less')} more={t('More')} />
            </div>
          </div>
        </section>

        {m.trained.length > 0 && (
          <section>
            <StageSection title={t('What you just trained')} />
            <div className="g-sum-pad">
              <div className="g-glist g-glass">
                {m.trained.map((r, i) => (
                  <ExerciseThumbRow key={r.id} tone="stage" size={48} image={pictureOf(S, r.id)} title={r.name} sub={r.line} first={i === 0}
                    trailing={<span className={trendClass(r.trend)}>{r.trendText}</span>} />
                ))}
              </div>
            </div>
          </section>
        )}

        {m.cardio.length > 0 && (
          <section>
            <StageSection title={t('Cardio')} />
            <div className="g-sum-pad">
              <div className="g-glist g-glass">
                {m.cardio.map((r, i) => (
                  <ExerciseThumbRow key={r.id + ':' + i} tone="stage" size={48} image={pictureOf(S, r.id)} title={r.name} sub={r.line} first={i === 0} />
                ))}
              </div>
            </div>
          </section>
        )}

        {m.next.length > 0 && (
          <section>
            <StageSection title={t('Next time')} action={t('progression')} />
            <div className="g-sum-pad">
              <div className="g-glist g-glass">
                {m.next.map(r => <GlassValueRow key={r.id} static title={r.name} sub={r.text} />)}
              </div>
            </div>
          </section>
        )}

        <section>
          <StageSection title={t('Session note')} />
          <div className="g-sum-pad"><SessionNote w={w} initial={m.note} noteRef={noteRef} /></div>
        </section>

        {/* The moment for a progress photo or the clip of a set: the workout is saved, so what is
            added goes straight onto its record. The section hides itself when nothing can be
            added or shown, and its heading with it. */}
        <section className="g-sum-mediasec">
          <StageSection title={t('Photos and clips')} />
          <div className="g-sum-pad"><div className="g-sum-media"><WorkoutMediaSection w={w} hint /></div></div>
        </section>

        <div className="g-sum-done"><Button block onClick={done}>{t('Done')}</Button></div>
      </div>
    </StageScreen>
  )
}
