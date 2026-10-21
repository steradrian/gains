// The exercise being worked on the running workout (boards W1.0 to W1.8, W1.24, W1.28, W1.32 to
// W1.36, W1.38, W1.39, W1.41, W1.42): the superset's A1/A2, the hero, the sets already done, the
// set being worked (its steppers or the timed hold), the effort on the set just done, the white
// Done, the sets still planned, Add set and the rest chip. A finished exercise looked back at
// shows its sets to fix and the way back. In the editor of a saved workout a tapped row is the
// one being edited, and Save changes saves.
import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { finishWorkout } from '../../sheets.jsx'
import Icon from '../../components/Icon.jsx'
import CurrentSet from '../../ds/CurrentSet.jsx'
import DoneSetRows from '../../ds/DoneSetRows.jsx'
import EffortChips from '../../ds/EffortChips.jsx'
import ExerciseHero from '../../ds/ExerciseHero.jsx'
import PlateLine from '../../ds/PlateLine.jsx'
import SetStepper from '../../ds/SetStepper.jsx'
import SupersetSwitch from '../../ds/SupersetSwitch.jsx'
import TimedHold from '../../ds/TimedHold.jsx'
import { exerciseRestSheet, howToSheet, platesSheet, setEditSheet } from './drawers.js'
import { setEffortAt } from './workout-actions.js'
import { plateLineFor, setFields, setText } from './workout-view.js'
import { changeSetField } from './set-field-change.js'

function Steppers({ idx, i, fields }) {
  return fields.map(f => (
    <SetStepper
      key={f.f + (f.side || '')} label={f.label} value={f.value} step={f.step} decimals={f.decimals} hint={f.hint}
      lessLabel={f.lessLabel} moreLabel={f.moreLabel} onChange={v => changeSetField(idx, i, f, v)}
    />
  ))
}

export default function WorkoutFocus({ view, actions }) {
  const S = useStore(s => s.S)
  const [editAt, setEditAt] = useState(null)
  const { hero, current, review, superset, hold, editing } = view
  const idx = hero.idx
  const entry = S.active.entries[idx]
  const how = () => howToSheet(idx)
  const swipe = d => actions.navigateUnit(d === 'next' ? 1 : -1)

  // The editor: the row picked (else the first) is the set on the steppers; the others are rows.
  const editI = editing && entry.sets.length ? (editAt?.idx === idx && entry.sets[editAt.i] ? editAt.i : 0) : null
  const rows = editing
    ? entry.sets.map((s, i) => ({ s, i })).filter(x => x.i !== editI).map(({ s, i }) => ({
      n: i, name: t('Set {0}', i + 1), text: setText(S, entry, s), label: t('{0}, {1}. Edit', i + 1, setText(S, entry, s)),
      onEdit: () => setEditAt({ idx, i }),
    }))
    : view.doneRows.map(r => ({ ...r, n: r.i, onEdit: () => setEditSheet(idx, r.i) }))
  const edited = editI != null ? { ...setFields(S, entry, editI), plateLine: entry.sets[editI].w > 0 ? plateLineFor(S, entry, entry.sets[editI].w) : null } : null
  const holdHere = hold && hold.idx === idx

  const done = () => {
    if (current.timed) actions.startTimed(idx, current.i)
    else actions.toggle(idx, current.i, current.side || undefined)
  }

  return (
    <div className="wk-focus">
      {superset && (
        <SupersetSwitch
          a={superset.names[0]} b={superset.names[1]} tags={superset.tags} active={superset.activeKey} note={superset.note} ariaLabel={superset.ariaLabel}
          onChange={k => actions.selectEntry(k === 'a' ? superset.a : superset.b)}
        />
      )}
      <ExerciseHero
        image={hero.image} name={hero.name} meta={hero.meta} dots={hero.dots} dotsLabel={hero.dotsLabel} part={hero.partLine} note={hero.note}
        newToYou={!!hero.newToYou && !editing} newText={hero.newToYou} howLabel={hero.howLabel} onHow={how} moreLabel={hero.moreLabel} onMore={how} onSwipe={swipe}
      />
      <DoneSetRows rows={rows} bestLabel={view.bestLabel} />

      {edited && (
        <>
          <CurrentSet setLine={t('Set {0} · editing', editI + 1)} last={null} bodyweight={edited.bodyweight}
            loadLabel={t('Load')} bodyweightLabel={t('Body weight')} loadHint={t('Tap to add weight')} onLoad={() => setEditSheet(idx, editI)}
            fields={<Steppers idx={idx} i={editI} fields={edited.fields} />}>
            <PlateLine text={edited.plateLine} label={t('Plate loading')} onClick={() => platesSheet(idx)} />
          </CurrentSet>
          <button type="button" className="wk-done" onClick={finishWorkout}>{t('Save changes')}</button>
          <button type="button" className="wk-link" onClick={() => setEditSheet(idx, editI)}>{t('Set options')}</button>
        </>
      )}

      {!editing && holdHere && (
        <>
          <TimedHold
            side={hold.sideLabel} left={hold.leftText} detail={hold.detail} progress={hold.progress} tone={hold.tone} ringLabel={hold.ringLabel}
            paused={hold.paused} pauseLabel={hold.pauseLabel} resumeLabel={hold.resumeLabel}
            onPause={() => (hold.paused ? useUI.getState().resumeWork() : useUI.getState().pauseWork())}
            switchLabel={hold.switchLabel} onSwitch={() => useUI.getState().finishWorkEarly()} note={hold.note}
          />
          {hold.doneLabel && <button type="button" className="wk-done" onClick={() => useUI.getState().finishWorkEarly()}>{hold.doneLabel}</button>}
        </>
      )}

      {!editing && !holdHere && current && (
        <>
          {current.effort && (
            <EffortChips tone="stage" options={current.effort.options} value={current.effort.value} label={current.effort.label}
              onChange={v => setEffortAt(idx, current.effort.i, current.effort.field, v)} />
          )}
          <CurrentSet
            setLine={current.setLine} last={current.last} first={!!current.first} firstLabel={current.first} warmup={current.warmup}
            bodyweight={current.bodyweight} loadLabel={current.loadLabel} bodyweightLabel={current.bodyweightLabel} loadHint={current.loadHint}
            onLoad={() => setEditSheet(idx, current.i)}
            fields={<Steppers idx={idx} i={current.i} fields={current.fields} />}
          >
            <PlateLine text={current.plateLine} label={t('Plate loading')} onClick={() => platesSheet(idx)} />
          </CurrentSet>
          <button type="button" className="wk-done" onClick={done}>{current.timed ? current.startLabel : current.doneLabel}</button>
          {current.upcoming.length > 0 && (
            <div className="wk-todo g-glass">
              {current.upcoming.map(u => (
                <button key={u.i} type="button" className="wk-todo-row" aria-label={u.label} onClick={() => setEditSheet(idx, u.i)}>
                  <span className="wk-todo-dot" aria-hidden="true" />
                  <span className="wk-todo-n">{u.name}</span>
                  <span className="wk-todo-v">{u.text}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!editing && !current && !holdHere && review && (
        <div className="wk-review">
          <p className="wk-review-line"><b>{review.line}</b> <span>{review.hint}</span></p>
          {review.back && <button type="button" className="wk-done" onClick={() => actions.selectEntry(review.back.idx)}>{review.back.label}</button>}
        </div>
      )}

      <div className="wk-acts">
        <button type="button" className="wk-act g-glass" onClick={() => actions.addSet(idx)}>
          <Icon name="plus" className="g-icon" />
          {t('Add set')}
        </button>
        {!editing && current?.restChip && (
          <button type="button" className="wk-act g-glass" aria-label={current.restLabel} onClick={() => exerciseRestSheet(idx)}>
            <Icon name="timer" className="g-icon" />
            {current.restChip}
          </button>
        )}
      </div>
    </div>
  )
}
