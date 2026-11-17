import { useState } from 'react'
import DurationWheel from '../components/DurationWheel.jsx'
import BottomSheet from './BottomSheet.jsx'
import Button from './Button.jsx'
import ConfirmDrawer from './ConfirmDrawer.jsx'
import Section from './DevKitSection.jsx'
import Dock from './Dock.jsx'
import EffortChips from './EffortChips.jsx'
import MapDrawer from './MapDrawer.jsx'
import MapRow from './MapRow.jsx'
import PhaseOfferSheet from './PhaseOfferSheet.jsx'
import PlateBar from './PlateBar.jsx'
import Switch from './Switch.jsx'

// The Workout drawer kit's part of the catalogue (DevKit.jsx): the contents of the light drawers
// (map, offers, confirm, plates, effort, the rest wheel), the switch, and the dock. Each drawer
// is drawn still in a phone-sized frame, inside a BottomSheet the way the app opens it; the map
// reorders for real (drag a handle, or Arrow Up and Down on it) on in-memory sample data, so
// nothing is saved. Its sample copy is English and not translated.
const NOOP = () => {}
const EFFORT = ['0 · failure', '1', '2', '3', '4+']

const row = (id, name, sub, extra) => ({ id, name, sub, handleLabel: 'Move ' + name, ...extra })
const move = (list, from, to) => {
  const next = list.slice()
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

const WARM = [
  row('gb', 'Glute bridge', '2 × 15 · done', { state: 'done', stateLabel: 'Done' }),
  row('db', 'Dead bug', '2 × 10 each side · done', { state: 'done', stateLabel: 'Done' }),
  row('bp', 'Band pull-apart', '2 × 15 · done', { state: 'done', stateLabel: 'Done' }),
]
const MAIN = [
  row('bench', 'Bench press', '80 × 8 · 8 · 8', { state: 'done', stateLabel: 'Done' }),
  row('incl', 'Incline dumbbell press', '26 × 10 · 10 · 10', { state: 'done', stateLabel: 'Done' }),
  row('shp', 'Dumbbell shoulder press', '24 × 8 · 8 · 7', { state: 'done', stateLabel: 'Done' }),
  row('fly', 'Cable fly', '17.5 kg × 12 · 1 of 3', { state: 'now', nowLabel: 'Set 2 of 3' }),
  row('lat', 'Lateral raise', 'A1 · 3 × 15', { superset: 'a', stateLabel: 'Up next' }),
  row('tri', 'Triceps pushdown', 'A2 · 3 × 12', { superset: 'b', stateLabel: 'Up next' }),
]
const COOL = [
  row('hip', 'Kneeling hip flexor stretch', '2 × 30 s each side', { stateLabel: 'Up next' }),
  row('couch', 'Couch stretch', '2 × 45 s each side', { stateLabel: 'Up next' }),
  row('foam', 'Pec foam roll', '1 min', { stateLabel: 'Up next' }),
]
const SECTIONS = [
  { key: 'warm', title: 'Warm-up · done', tone: 'warm', rows: WARM },
  { key: 'main', title: 'Workout', tone: 'main', rows: MAIN },
  { key: 'cool', title: 'Cool-down · 3 stretches', tone: 'cool', action: 'Skip cool-down', onAction: NOOP, rows: COOL },
]
// W1.45: twenty exercises, so the list is what scrolls
const LONG = [
  { key: 'main', title: 'Workout', tone: 'main', rows: Array.from({ length: 20 }, (_, i) => row('x' + i, 'Exercise ' + (i + 1), '3 × 10', i < 7 ? { state: 'done', stateLabel: 'Done' } : i === 7 ? { state: 'now', nowLabel: 'Set 1 of 3' } : { stateLabel: 'Up next' })) },
]

const FOOT = {
  addLabel: 'Add exercise', onAdd: NOOP, supersetLabel: 'Make superset', onSuperset: NOOP,
  footer: <Button variant="ghost" onClick={NOOP}>Workout options</Button>,
}

// The map with its sections in state: a reorder moves a row inside its own section and says so.
function ReorderMap({ start }) {
  const [sections, setSections] = useState(start)
  const [last, setLast] = useState('')
  const reorder = (key, from, to) => {
    setSections(all => all.map(s => (s.key === key ? { ...s, rows: move(s.rows, from, to) } : s)))
    setLast(`Moved ${key} row ${from + 1} to ${to + 1}`)
  }
  return (
    <>
      <div className="g-wd-frame">
        <BottomSheet title="Push A · 12 exercises" meta="24:18" type="full" onClose={NOOP}>
          <MapDrawer sections={sections} hint="Drag to reorder within a phase" onReorder={reorder}
            movedLabel={(name, place, count) => `${name}, ${place} of ${count}`} {...FOOT} />
        </BottomSheet>
      </div>
      <p className="g-kit-trail">{last || 'Drag a handle, or focus one and press Arrow Up or Down.'}</p>
    </>
  )
}

function EffortDemo({ tone }) {
  const [value, setValue] = useState(null)
  return (
    <EffortChips tone={tone} options={EFFORT} value={value} onChange={setValue} label="How hard was that set? Reps left in the tank"
      hint={value == null ? 'Optional' : undefined} />
  )
}

function WheelDemo({ variant }) {
  const [sec, setSec] = useState(105)
  return <DurationWheel variant={variant} value={sec} onChange={setSec} max={900} off="Off" />
}

// A drawer drawn still in a phone-sized frame: an auto-height BottomSheet at its bottom.
const sheetFrame = props => <div className="g-wd-frame"><BottomSheet onClose={NOOP} {...props} /></div>

export default function DevKitWorkoutDrawers() {
  return (
    <>
      <Section title="MapRow" note="done, now with its label, todo; a superset pair; the phase dot on warm and cool rows; a handle; the row held mid-drag; and a row with no tap (plain text).">
        <div className="g-kit-light">
          <MapRow name="Bench press" sub="80 × 8 · 8 · 8" state="done" stateLabel="Done" onClick={NOOP} />
          <MapRow name="Cable fly" sub="17.5 kg × 12 · 1 of 3" state="now" nowLabel="Set 2 of 3" onClick={NOOP} />
          <MapRow name="Lateral raise" sub="A1 · 3 × 15" superset="a" stateLabel="Up next" onClick={NOOP} />
          <MapRow name="Triceps pushdown" sub="A2 · 3 × 12" superset="b" stateLabel="Up next" onClick={NOOP} />
          <MapRow name="Glute bridge" sub="2 × 15 · done" state="done" stateLabel="Done" tone="warm" onClick={NOOP} />
          <MapRow name="Couch stretch" sub="2 × 45 s each side" tone="cool" stateLabel="Up next" onClick={NOOP} />
          <MapRow name="Pec foam roll" sub="1 min" handle handleLabel="Move Pec foam roll" onMove={NOOP} onDragStart={NOOP} stateLabel="Up next" onClick={NOOP} />
          <MapRow name="Incline dumbbell press" sub="26 × 10 · 10 · 10" state="done" stateLabel="Done" handle handleLabel="Move Incline dumbbell press" lifted onClick={NOOP} />
          <MapRow name="Plain row" sub="no tap, no handle" stateLabel="Up next" />
        </div>
      </Section>

      <Section title="MapDrawer" note="W1.37: three phases, a superset bracket, Skip cool-down, the foot. Reorders for real inside a phase (drag a handle, or Arrow Up and Down on it); nothing is saved.">
        <ReorderMap start={SECTIONS} />
      </Section>

      <Section title="MapDrawer, 20 exercises" note="W1.45: the hint and the foot stay pinned, the list scrolls under them.">
        <ReorderMap start={LONG} />
      </Section>

      <Section title="PhaseOfferSheet" note="W1.31 warm-up and W1.40 cool-down: the tag in its light tint, the items, Start and Skip.">
        {sheetFrame({
          title: 'Start with your warm-up',
          children: (
            <PhaseOfferSheet tone="warm" tag="Warm-up · 3" body="Logged like any exercise: sets and reps count in your history and muscle map, never for new bests."
              items={[{ name: 'Glute bridge', sub: '2 × 15' }, { name: 'Dead bug', sub: '2 × 10 each side' }, { name: 'Band pull-apart', sub: '2 × 15' }]}
              startLabel="Start warm-up" onStart={NOOP} skipLabel="Skip warm-up" onSkip={NOOP} />
          ),
        })}
        {sheetFrame({
          title: 'Cool-down',
          children: (
            <PhaseOfferSheet tone="cool" tag="Cool-down · 3" body="Three stretches, about 5 min. Each one is a timed hold; the other side follows."
              items={[{ name: 'Kneeling hip flexor stretch', sub: '2 × 30 s each side' }, { name: 'Couch stretch', sub: '2 × 45 s each side' }, { name: 'Pec foam roll', sub: '1 min' }]}
              startLabel="Start cool-down" onStart={NOOP} skipLabel="Skip cool-down" onSkip={NOOP} />
          ),
        })}
      </Section>

      <Section title="ConfirmDrawer" note="W1.46: what goes, the quiet note about Undo, the danger button and the way back.">
        {sheetFrame({
          title: 'Discard 14 sets?',
          children: (
            <ConfirmDrawer body="Push A closes and these go:" items={['14 logged sets, warm-up included', '24:18 on the clock', 'Nothing reaches History, bests or the muscle map']}
              note="You can still undo for 8 s on Today." confirmLabel="Discard workout" onConfirm={NOOP} cancelLabel="Keep going" onCancel={NOOP} />
          ),
        })}
      </Section>

      <Section title="EffortChips" note="W1.12: wrapping pills, the answer in the accent; light in a drawer and stage under the set just done. Arrow keys move and choose.">
        <div className="g-kit-light"><EffortDemo tone="light" /></div>
        <EffortDemo tone="stage" />
      </Section>

      <Section title="PlateBar" note="W1.25: 80 kg on a 20 kg bar, a pound bar, a heavy load, a bar with nothing on it, and a caption.">
        <div className="g-kit-light">
          <PlateBar plates={[25, 5]} unit="kg" label="80 kg: bar plus 25 and 5 each side" />
          <PlateBar plates={[45, 25, 10, 5, 2.5]} unit="lb" label="255 lb: bar plus 45, 25, 10, 5 and 2.5 each side" />
          <PlateBar plates={[25, 25, 25, 20, 15, 10, 5, 2.5, 1.25]} unit="kg" label="Heavy: nine plates each side" />
          <PlateBar plates={[]} unit="kg" label="20 kg: the bar alone" />
          <PlateBar plates={[20, 10]} unit="kg" label="80 kg: bar plus 20 and 10 each side">From your plates at Home gym.</PlateBar>
        </div>
      </Section>

      <Section title="Switch" note="W1.21: the bare switch (off, on, disabled) and the row with its title and line.">
        <div className="g-kit-light">
          <div className="g-kit-row">
            <Switch ariaLabel="Off" />
            <Switch ariaLabel="On" checked onChange={NOOP} />
            <Switch ariaLabel="Disabled, on" checked onChange={NOOP} disabled />
            <Switch ariaLabel="Disabled, off" disabled />
          </div>
          <Switch label="Sound" description="Chime when rest or a hold ends" />
          <Switch label="Plate loading" description="Shows the plates under barbell sets" checked onChange={NOOP} />
        </div>
      </Section>

      <Section title="DurationWheel, DS look" note="W1.4: variant ds in a drawer with its hint, Skip and Done; then the default look the app's other callers keep.">
        {sheetFrame({
          title: 'Time left',
          children: (
            <>
              <WheelDemo variant="ds" />
              <p className="g-wd-hint">Scroll to 0:00 to end the rest now.</p>
              <div className="g-wd-foot">
                <Button variant="secondary" onClick={NOOP}>Skip</Button>
                <Button onClick={NOOP}>Done</Button>
              </div>
            </>
          ),
        })}
        <div className="g-kit-light"><WheelDemo variant="default" /></div>
      </Section>

      <Section title="Dock" note="Planned with Start, running with the clock, running with the rest countdown and its +30 and Skip, Ready, and a timed hold.">
        <div className="g-kit-light">
          <Dock state="planned" routine="Push A" meta="6 exercises" actionLabel="Start" onAction={NOOP} />
          <Dock state="running" routine="Push A" clock="23:10" actionLabel="Resume" onAction={NOOP} />
          <Dock state="running" routine="Push A" clock="23:10" count="1:12" progress={0.6} openLabel="Open workout" onOpen={NOOP}>
            <Button size="sm" variant="secondary" icon="plus" aria-label="Add 30 seconds">30s</Button>
            <Button size="sm">Skip</Button>
          </Dock>
          <Dock state="running" routine="Push A" clock="23:10" count="Ready" progress={0} openLabel="Open workout" onOpen={NOOP}>
            <Button size="sm">Dismiss</Button>
          </Dock>
          <Dock state="running" routine="A very long routine name that has to give way before the buttons do" clock="23:10" count="0:25" progress={0.4} hold openLabel="Open workout" onOpen={NOOP}>
            <Button size="sm">Skip</Button>
          </Dock>
        </div>
      </Section>
    </>
  )
}
