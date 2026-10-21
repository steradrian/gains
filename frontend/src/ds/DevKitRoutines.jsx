import { useState } from 'react'
import Section from './DevKitSection.jsx'
import RoutineExerciseRow from './RoutineExerciseRow.jsx'
import SetTable from './SetTable.jsx'
import SupersetGroup from './SupersetGroup.jsx'

// The routines slice's part of the catalogue (DevKit.jsx): the pieces of the exercise settings drawer
// that have no screen of their own. Words here are sample data; the app passes its own through t().
const NOOP = () => {}
const COLUMNS = ['Sets', 'Reps', 'Weight (kg)', 'Rest']

export default function DevKitRoutines() {
  const [sets, setSets] = useState(4)
  const [reps, setReps] = useState(8)
  const [weight, setWeight] = useState(80)
  const [pyramid, setPyramid] = useState([12, 8, 'max'])

  const summary = {
    columns: COLUMNS,
    rows: [{ key: 'all', cells: [
      { value: sets, onChange: setSets, label: 'Sets' },
      { value: reps, onChange: setReps, label: 'Reps' },
      { value: weight, onChange: setWeight, label: 'Weight (kg)', decimal: true },
      { text: '2:30', muted: true, label: 'Rest for this exercise: Default (2:30)', onClick: NOOP },
    ] }],
    add: { label: 'Add set', onClick: () => setSets(s => s + 1) },
  }
  const setAt = (i, v) => setPyramid(p => p.map((x, j) => (j === i ? v : x)))
  const perSet = {
    columns: ['Sets', 'Reps', 'Weight (kg)', 'Rest (s)'],
    rows: pyramid.map((p, i) => ({
      key: i,
      cells: [
        { text: String(i + 1), muted: true },
        p === 'max'
          ? { text: 'Max', aux: { text: 'Max', label: `Set ${i + 1} max`, pressed: true, onClick: () => setAt(i, 8) } }
          : { value: p, onChange: v => setAt(i, v), label: `Set ${i + 1} reps`, min: 1, aux: { text: 'Max', label: `Set ${i + 1} max`, pressed: false, onClick: () => setAt(i, 'max') } },
        { value: 40 + i * 10, onChange: NOOP, label: `Set ${i + 1} weight`, decimal: true },
        { value: 90, onChange: NOOP, label: `Set ${i + 1} rest (s)` },
      ],
      remove: pyramid.length > 1 ? { label: `Remove set ${i + 1}`, onClick: () => setPyramid(list => list.filter((_, j) => j !== i)) } : undefined,
    })),
    add: { label: 'Add set', onClick: () => setPyramid(list => [...list, list[list.length - 1]]), disabled: pyramid.length >= 8 },
  }

  return (
    <>
      <Section title="Train: routines" note="The exercise settings drawer's parts (boards T5.5). The picker and the Replace drawer are the real ones, in #/dev/screens under Train: routines picker." />
      <Section title="SetTable" note="One summary row for a mode with one value for all its sets (the cells are real fields, each named for a screen reader); then a row a set for a pyramid, with Max, a remove button and Add set.">
        <SetTable label="Sets" {...summary} />
        <SetTable label="Pyramid sets" {...perSet} />
      </Section>
      <Section title="RoutineExerciseRow" note="The editor's exercise row on the stage (board T5.0): picture, name, the numbers and the progression line. Then the reorder mode, with the move buttons and the grip, on a row without a picture.">
        <div className="g-re-list">
          <RoutineExerciseRow title="Bench press" sub="4 × 6–8 · 80 kg" line="Up 2.5 kg when every set hits 8" onOpen={NOOP} />
          <RoutineExerciseRow title="Dip" sub="3 × 10" line="Linear progression" warning="Needs dip bars, which isn’t in your active profile" onOpen={NOOP}
            moveUp={{ label: 'Move Dip up', onClick: NOOP }} moveDown={{ label: 'Move Dip down', disabled: true, onClick: NOOP }} handle={{ title: 'Reorder exercises' }} />
        </div>
      </Section>
      <Section title="SupersetGroup" note="Two exercises done back to back, under a header line that opens the superset's name and rest.">
        <div className="g-re-list">
          <SupersetGroup title="Superset" detail="1:30 rest after both" onClick={NOOP}>
            <RoutineExerciseRow title="Cable fly" sub="3 × 12 · 15 kg" badge={{ text: 'A1', label: 'Superset position A1' }} onOpen={NOOP} />
            <RoutineExerciseRow title="Push-up" sub="3 × 15" badge={{ text: 'A2', label: 'Superset position A2' }} onOpen={NOOP} />
          </SupersetGroup>
        </div>
      </Section>
    </>
  )
}
