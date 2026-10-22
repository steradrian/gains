import { useState } from 'react'
import Section from './DevKitSection.jsx'
import BarToast from './BarToast.jsx'
import CurrentSet from './CurrentSet.jsx'
import DoneSetRows from './DoneSetRows.jsx'
import ExerciseHero from './ExerciseHero.jsx'
import PhaseProgress from './PhaseProgress.jsx'
import NotCountedLine from './NotCountedLine.jsx'
import PlateLine from './PlateLine.jsx'
import ProgressionLine from './ProgressionLine.jsx'
import SetStepper from './SetStepper.jsx'
import SupersetSwitch from './SupersetSwitch.jsx'
import TimedHold from './TimedHold.jsx'
import WorkoutFooter from './WorkoutFooter.jsx'
import WorkoutTopBar from './WorkoutTopBar.jsx'

// The workout screen kit's part of the catalogue (DevKit.jsx), on phone-sized stage frames with
// sample data. Nothing here is a store or persists; the pieces take every string from their caller.
const SELF = '#/dev/kit'
const NOOP = () => {}
// An exercise still is a photo on white; this stands in for one: grey shapes on the tile's own white
const STILL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><rect x="8" y="32" width="36" height="6" rx="3" fill-opacity=".35"/><rect x="16" y="14" width="20" height="14" rx="3" fill-opacity=".22"/></svg>')

const WARM = [{ tone: 'warm', count: 3, state: 'now', name: 'Warm-up' }, { tone: 'main', count: 6, state: 'waiting', name: 'Workout' }, { tone: 'cool', count: 3, state: 'waiting', name: 'Cool-down' }]
const MAIN = [{ tone: 'warm', count: 3, state: 'done', name: 'Warm-up' }, { tone: 'main', count: 6, state: 'now', name: 'Workout' }, { tone: 'cool', count: 3, state: 'waiting', name: 'Cool-down' }]
const COOL = [{ tone: 'warm', count: 3, state: 'done', name: 'Warm-up' }, { tone: 'main', count: 6, state: 'done', name: 'Workout' }, { tone: 'cool', count: 3, state: 'now', name: 'Cool-down' }]
const LONG = [{ tone: 'warm', count: 3, state: 'done', name: 'Warm-up' }, { tone: 'main', count: 14, state: 'now', name: 'Workout' }, { tone: 'cool', count: 3, state: 'waiting', name: 'Cool-down' }]
const NO_WARM = [{ tone: 'warm', count: 0, state: 'done' }, { tone: 'main', count: 6, state: 'now' }, { tone: 'cool', count: 0, state: 'waiting' }]

const THREE_DONE = [
  { n: 1, name: 'Set 1', text: '80 kg × 8', label: '1, 80 kg × 8. Edit', onEdit: NOOP },
  { n: 2, name: 'Set 2', text: '80 kg × 8', label: '2, 80 kg × 8. Edit', onEdit: NOOP },
  { n: 3, name: 'Set 3', text: '80 kg × 7', label: '3, 80 kg × 7. Edit', onEdit: NOOP },
]
const BEST = [
  { n: 1, name: 'Set 1', text: '17.5 kg × 12', label: '1, 17.5 kg × 12. Edit', onEdit: NOOP },
  { n: 2, name: 'Set 2', text: '20 kg × 12', label: '2, 20 kg × 12. Edit', best: true, onEdit: NOOP },
]
const WARM_ROWS = [
  { n: 1, name: 'Warm-up set 1', text: '40 kg × 10', label: 'Warm-up 1, 40 kg × 10. Edit', warmup: true, onEdit: NOOP },
  { n: 2, name: 'Set 1', text: '80 kg × 8', label: '1, 80 kg × 8. Edit', onEdit: NOOP },
]

const HERO_LABELS = (name) => ({ howLabel: `${name}, how to`, moreLabel: `${name}, options` })

const FOOT_LABELS = {
  navLabel: 'Exercises', mapLabel: 'All exercises', prevLabel: 'Previous: Band pull-apart', nextLabel: 'Next: Dumbbell seated shoulder press',
  clockLabel: 'Rest, 1:42 left. Change', minusLabel: '15 seconds less', plusLabel: '15 seconds more', pauseLabel: 'Pause rest', resumeLabel: 'Resume rest',
  skipLabel: 'Skip rest', skipText: 'Skip', stepText: '15 s',
}
const NEIGHBOURS = { prev: { image: STILL, onClick: NOOP }, next: { image: STILL, onClick: NOOP } }
const REST = { left: '1:42', label: 'Rest', progress: 0.15, onClock: NOOP, onMinus: NOOP, onPlus: NOOP, onPause: NOOP, onSkip: NOOP }

function Steppers({ kg = 80, reps = 8, step = 2.5 }) {
  return (
    <>
      <SetStepper label="kg" defaultValue={kg} step={step} hint={`${step} kg steps`} lessLabel="Less kg" moreLabel="More kg" />
      <SetStepper label="Reps" defaultValue={reps} hint="same as last time" lessLabel="Less Reps" moreLabel="More Reps" />
    </>
  )
}

export default function DevKitWorkout() {
  const [swiped, setSwiped] = useState('none yet')
  const [side, setSide] = useState('Left side')
  const [paused, setPaused] = useState(false)
  const [restPaused, setRestPaused] = useState(false)

  return (
    <>
      <Section title="WorkoutTopBar" note="Running (a glass Minimise, the title over the clock, the white Finish), offline (the line under the clock), editing a saved workout (× and Save, a date line for the clock) and an empty workout (Discard).">
        <div className="g-kit-wk">
          <WorkoutTopBar title="Push A" clock="8:02" minimiseLabel="Minimise" onMinimise={NOOP} finishLabel="Finish" onFinish={NOOP} />
          <WorkoutTopBar title="Push A" clock="24:18" status="Offline · 6 waiting" minimiseLabel="Minimise" onMinimise={NOOP} finishLabel="Finish" onFinish={NOOP} />
          <WorkoutTopBar title="Editing · Sat 17 Oct" closeIcon closeLabel="Close editor" onClose={NOOP} finishLabel="Save" onFinish={NOOP} />
          <WorkoutTopBar title="Empty workout" clock="0:42" minimiseLabel="Minimise" onMinimise={NOOP} finishLabel="Discard" onFinish={NOOP} />
          <WorkoutTopBar title="A workout with a very long name that has to be cut short" clock="1:12:40" minimiseLabel="Minimise" minimiseHref={SELF} finishLabel="Finish" finishHref={SELF} />
        </div>
      </Section>

      <Section title="PhaseProgress" note="The open phase is a row of segments, the others fold into a pill (a check once done, the count while waiting); the whole bar opens the map. Warm-up peach, cool-down mint. Then the workout, the cool-down, 14 exercises (thinner gaps), and a workout with neither part (nothing drawn for them).">
        <div className="g-kit-wk">
          <PhaseProgress phases={WARM} index={1} done={1} partial={0.4} label="All exercises" onOpen={NOOP} />
          <PhaseProgress phases={MAIN} index={0} done={0} partial={0.5} label="All exercises" onOpen={NOOP} />
          <PhaseProgress phases={COOL} index={0} done={0} partial={0} label="All exercises" onOpen={NOOP} />
          <PhaseProgress phases={LONG} index={6} done={6} partial={0.33} label="All exercises" onOpen={NOOP} />
          <PhaseProgress phases={NO_WARM} index={2} done={2} partial={0.6} label="All exercises" onOpen={NOOP} />
        </div>
      </Section>

      <Section title="SupersetSwitch" note="A1 / A2 tabs and the round note. Press one to work that exercise.">
        <div className="g-kit-wk">
          <SupersetSwitch a="Lateral raise" b="Pushdown" note="Superset · go straight to A2, rest 1:00 after both" ariaLabel="Superset" />
          <SupersetSwitch a="Lateral raise with a very long name" b="Rope pushdown" active="b" onChange={NOOP} ariaLabel="Superset" />
        </div>
      </Section>

      <Section title="ExerciseHero" note={`The picture opens How to, ⋯ the options. Main exercise with its dots and the pinned setup note; a warm-up that is new to you (the white tag also opens How to); one already done; a long name; a timed stretch. A sideways swipe on any of them calls onSwipe: ${swiped}.`}>
        <div className="g-kit-wk">
          <ExerciseHero
            image={STILL} name="Bench press" meta="Barbell · 3 × 8 · 2:00 rest" dots={['done', 'now', 'todo']} dotsLabel="Set 2 of 3"
            part="Workout · 1 of 6" note="Feet flat, shoulder blades back" onHow={NOOP} onMore={NOOP} onSwipe={d => setSwiped(d)} {...HERO_LABELS('Bench press')}
          />
          <ExerciseHero
            image={STILL} name="Glute bridge" meta="Body weight · 2 × 15" part="Warm-up · 1 of 3" newToYou newText="New to you · how to"
            onHow={NOOP} onMore={NOOP} onSwipe={d => setSwiped(d)} {...HERO_LABELS('Glute bridge')}
          />
          <ExerciseHero
            image={STILL} name="Incline dumbbell press" meta="Dumbbells · 3 × 10 · done" dots={['done', 'done', 'done']} part="Workout · 3 of 6"
            onHow={NOOP} onMore={NOOP} {...HERO_LABELS('Incline dumbbell press')}
          />
          <ExerciseHero
            image={STILL} name="Kneeling hip flexor stretch" meta="Timed · 2 × 30 s a side" part="Cool-down · 1 of 3"
            onHow={NOOP} onMore={NOOP} {...HERO_LABELS('Kneeling hip flexor stretch')}
          />
          <ExerciseHero name="No picture yet" meta="Cable · 3 × 12" onHow={NOOP} onMore={NOOP} {...HERO_LABELS('No picture yet')} />
        </div>
      </Section>

      <Section title="DoneSetRows" note="Each done set is a button that opens it to fix. A new best carries its tag; a warm-up row has a hollow tick. Nothing draws without rows.">
        <div className="g-kit-wk">
          <DoneSetRows rows={THREE_DONE} />
          <DoneSetRows rows={BEST} bestLabel="NEW BEST" />
          <DoneSetRows rows={WARM_ROWS} />
          <DoneSetRows rows={[]} />
        </div>
      </Section>

      <Section title="SetStepper, CurrentSet and PlateLine" note="Two steppers per set: tap − / + or type the number. Last time on the right of the line; body weight takes the kg's place the first time (Tap to add weight); a warm-up set; editing a saved set; cardio with three fields. The plate line goes under a barbell set.">
        <div className="g-kit-wk">
          <CurrentSet setLine="Set 2 of 3" last="Last time 80 × 8" fields={<Steppers />}>
            <PlateLine text="Bar 20 kg + 25 + 5 each side" label="Plate loading" onClick={NOOP} />
          </CurrentSet>
          <CurrentSet
            setLine="Set 2 of 2" first firstLabel="First time" last="Last time 0 × 15" bodyweight
            loadLabel="Load" bodyweightLabel="Body weight" loadHint="Tap to add weight" onLoad={NOOP}
            fields={<SetStepper label="Reps" defaultValue={15} hint="same as last time" lessLabel="Less Reps" moreLabel="More Reps" />}
          />
          <CurrentSet setLine="Warm-up set 1 of 2" warmup last="Last time 40 × 10" fields={<Steppers kg={40} reps={10} />} />
          <CurrentSet setLine="Set 2 · editing" fields={<Steppers kg={20} reps={12} />} />
          <CurrentSet
            setLine="Set 1 of 1"
            fields={(
              <>
                <SetStepper label="min" defaultValue={20} hint="1 min steps" lessLabel="Less min" moreLabel="More min" />
                <SetStepper label="km/h" defaultValue={9.5} step={0.5} hint="0.5 steps" lessLabel="Less km/h" moreLabel="More km/h" />
                <SetStepper label="%" defaultValue={1} hint="incline" lessLabel="Less %" moreLabel="More %" />
              </>
            )}
          />
          <PlateLine text="" label="Plate loading" />
        </div>
      </Section>

      <Section title="TimedHold" note="The ring runs down; it is mint on a cool-down exercise. Left side with Switch side and the note; then the right side paused (the button says Resume); then a hold with one side (no Switch).">
        <div className="g-kit-wk g-kit-wk-pad">
          <TimedHold
            side={side} left="0:18" detail="of 0:30 · round 1 of 2" progress={0.4} tone="cool" ringLabel={`${side}, 18 seconds left`}
            pauseLabel="Pause" resumeLabel="Resume" onPause={NOOP} switchLabel="Switch side" onSwitch={() => setSide(s => (s === 'Left side' ? 'Right side' : 'Left side'))}
            note="A soft chime and a buzz at 0:00, then the right side starts on its own."
          />
          <TimedHold
            side="Right side" left="0:30" detail="of 0:30 · round 1 of 2" progress={0} tone="cool" ringLabel="Right side, 30 seconds left" paused={paused}
            pauseLabel="Pause" resumeLabel="Resume" onPause={() => setPaused(p => !p)} switchLabel="Switch side" onSwitch={NOOP}
          />
          <TimedHold left="0:42" detail="of 1:00" progress={0.3} ringLabel="42 seconds left" pauseLabel="Pause" resumeLabel="Resume" onPause={NOOP} />
        </div>
      </Section>

      <Section title="WorkoutFooter" note="Between sets: the previous and next pictures either side of the position, which opens the map. Resting: the ring (press to change it) and a row above with −15 s, +15 s, pause and Skip. After the rest: Ready, +15 s and the white Go. A superset reads 8–9 of 12; at the ends one side is empty. Tab through it: the ring is dark on the light bar.">
        <div className="g-kit-wk g-kit-wk-foot">
          <WorkoutFooter {...FOOT_LABELS} {...NEIGHBOURS} position="4 of 12" phase="Workout" onMap={NOOP} />
        </div>
        <div className="g-kit-wk g-kit-wk-foot g-kit-wk-foot-up">
          <WorkoutFooter {...FOOT_LABELS} {...NEIGHBOURS} rest={{ ...REST, paused: restPaused, onPause: () => setRestPaused(p => !p) }} />
        </div>
        <div className="g-kit-wk g-kit-wk-foot g-kit-wk-foot-up">
          <WorkoutFooter
            {...FOOT_LABELS} {...NEIGHBOURS} ready readyTitle="Ready" readyLabel="Rest is over" rest={{ onPlus: NOOP }}
            goText="Go · set 2" goLabel="Start the next set" onGo={NOOP}
          />
        </div>
        <div className="g-kit-wk g-kit-wk-foot">
          <WorkoutFooter {...FOOT_LABELS} next={{ image: STILL, onClick: NOOP }} position="8–9 of 12" phase="Superset" onMap={NOOP} />
        </div>
        <div className="g-kit-wk g-kit-wk-foot">
          <WorkoutFooter {...FOOT_LABELS} prev={{ image: STILL, onClick: NOOP }} position="12 of 12" phase="Cool-down" onMap={NOOP} />
        </div>
      </Section>

      <Section title="BarToast" note="A line over the footer with the exercise picture or a glyph and one action; a status, so it is read out. It does not time itself out. Shown above the bar, above the rest row, with a picture, and without an action.">
        <div className="g-kit-wk g-kit-wk-foot">
          <BarToast placement="footer" message="Warm-up done · 3 exercises · 6 sets" actionLabel="Back" onAction={NOOP} />
          <WorkoutFooter {...FOOT_LABELS} {...NEIGHBOURS} position="4 of 12" phase="Workout" onMap={NOOP} />
        </div>
        <div className="g-kit-wk g-kit-wk-foot g-kit-wk-foot-up">
          <BarToast placement="rest" icon="trophy" message="New best · Cable fly 20 kg × 12" actionLabel="Trend" onAction={NOOP} />
          <WorkoutFooter {...FOOT_LABELS} {...NEIGHBOURS} rest={REST} />
        </div>
        <div className="g-kit-wk g-kit-wk-pad">
          <BarToast image={STILL} message="Next: Dumbbell seated shoulder press" actionLabel="Back" onAction={NOOP} />
          <BarToast message="Round done" />
        </div>
      </Section>

      {/* === Workout progression === */}
      <Section title="Workout progression" note="ProgressionLine: what progression decided for this exercise, one button that opens Exercise settings; up, hold, a deload in the warning tone, and a long reason cut at two lines. NotCountedLine: the dashed line in its place when the exercise or the whole workout is kept out, with Undo (or none, when a routine keeps it out).">
        <div className="g-kit-wk g-kit-wk-pad">
          <ProgressionLine icon="arrowUp" policy="Double progression" reason="Hit 12 reps in every set. Add 2.5 kg and go back to 8." label="Double progression. Hit 12 reps in every set. Add 2.5 kg and go back to 8. Open exercise settings" onClick={NOOP} />
          <ProgressionLine icon="lightbulb" policy="Linear" reason="Missed reps last time. Same weight again (2 of 3 to go)." label="Linear. Missed reps last time. Same weight again, 2 of 3 to go. Open exercise settings" onClick={NOOP} />
          <ProgressionLine icon="arrowDown" tone="warning" policy="Double progression" reason="Missed 8 reps twice. Drop to 22 kg and build back up." label="Double progression. Missed 8 reps twice. Drop to 22 kg and build back up. Open exercise settings" onClick={NOOP} />
          <ProgressionLine icon="lightbulb" policy="Double progression" reason="You have outgrown the rack: 24 kg is your heaviest dumbbell, so the weight stays. Add a heavier pair in Gym setup to keep going up." label="Double progression. Open exercise settings" onClick={NOOP} />
          <NotCountedLine text="Not counted for progression today" undoText="Undo" undoLabel="Count Cable fly for progression again" onUndo={NOOP} />
          <NotCountedLine text="The whole workout is left out of progression" undoText="Undo" undoLabel="Count Push A for progression again" onUndo={NOOP} />
          <NotCountedLine text="Not counted for progression" />
        </div>
      </Section>
    </>
  )
}
