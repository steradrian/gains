import { useState } from 'react'
import Section from './DevKitSection.jsx'
import ExerciseThumbRow from './ExerciseThumbRow.jsx'
import RingCarousel from './RingCarousel.jsx'
import StageDayRail from './StageDayRail.jsx'
import StageEmpty from './StageEmpty.jsx'
import StageTrainCard from './StageTrainCard.jsx'

// The Train kit's part of the catalogue (DevKit.jsx), on the stage with sample data.
const SELF = '#/dev/kit'
const NOOP = () => {}
// A catalogue still is a photo on white; this stands in for one: grey shapes (black at a share, no
// colour literal) on the tile's own white
const STILL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><rect x="8" y="32" width="36" height="6" rx="3" fill-opacity=".35"/><rect x="16" y="14" width="20" height="14" rx="3" fill-opacity=".22"/></svg>')
const STILLS = [STILL, STILL, STILL, STILL, STILL, STILL]

const LETTERS = ['T', 'F', 'S', 'S', 'M', 'T', 'W']
const NAMES = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']
// [state, workout] for a week starting on Thursday
const WEEK_THIS = [['rest'], ['missed', 'Legs'], ['rest'], ['today', 'Push A'], ['planned', 'Legs'], ['rest'], ['planned', 'Pull A']]
const WEEK_PAST = [['done', 'Pull A'], ['rest'], ['done', 'Legs'], ['rest'], ['done', 'Push A'], ['rest'], ['done', 'Pull A']]
const WEEK_AHEAD = [['planned', 'Push A'], ['rest'], ['planned', 'Legs'], ['planned', 'Push A'], ['planned', 'Legs'], ['rest'], ['planned', 'Pull A']]
const WEEK_PLAIN = [['plain'], ['plain'], ['plain'], ['today'], ['rest'], ['rest'], ['rest']]

const WORDS = { today: 'today', done: 'done', missed: 'planned, not logged', planned: 'planned', rest: 'rest' }

function week(prefix, first, rows) {
  return rows.map(([state, name], i) => {
    const date = first + i
    const label = `${NAMES[i]} ${date} Oct` + (name ? `, ${name}` : state === 'plain' ? '' : `, ${WORDS[state]}`)
    return { iso: `${prefix}-${date}`, dow: LETTERS[i], date, state, label, name }
  })
}

const WEEKS = [
  week('a', 1, WEEK_PAST),
  week('b', 8, WEEK_PAST),
  week('c', 15, WEEK_THIS),
  week('d', 22, WEEK_AHEAD),
  week('e', 29, WEEK_AHEAD),
]
const TITLES = ['Week of 1 Oct', 'Week of 8 Oct', 'This week', 'Next week', 'Week of 29 Oct']
const HOME = 2

const RINGS = [
  { name: 'Workouts', top: 'This week', big: 2, unit: 'of 4 workouts', value: 2, max: 4, pill: 'Push A today', icon: 'dumbbell' },
  { name: 'Volume', top: 'Volume this week', big: '14.3', unit: 't of 18.9 t last week', value: 14.3, max: 18.9, pill: 'Bench press best: 82.5 kg', icon: 'chartLine' },
  { name: 'Streak', top: 'On plan', big: '6', unit: 'weeks in a row', value: 6, max: 8, pill: 'Best: 8 weeks', icon: 'flame' },
]

export default function DevKitTrain() {
  const [at, setAt] = useState(HOME)
  const [picked, setPicked] = useState('c-18')
  const [lone, setLone] = useState('p-18')

  return (
    <>
      <Section title="StageDayRail" note="Thu to Wed around today. Swipe or press › for later weeks, swipe or Tab to ‹ for earlier ones (it is drawn once away from this week). The selected day is white, today keeps a glass pill, missed is amber.">
        <StageDayRail
          weeks={WEEKS}
          week={at}
          home={HOME}
          onWeek={setAt}
          title={TITLES[at]}
          action="Plan"
          actionHref={SELF}
          selected={picked}
          onSelect={d => setPicked(d.iso)}
          backLabel={at === HOME + 1 ? 'This week' : 'Previous week'}
          forwardLabel={at === HOME ? 'Next week' : 'Following week'}
          canBack={at > 0}
          canForward={at < WEEKS.length - 1}
        />
        <p>Selected: {picked}</p>
        <p>Before the first workout: plain numbers, and the rail stops at the first week.</p>
        <StageDayRail
          weeks={[week('p', 15, WEEK_PLAIN)]}
          title="This week"
          action="Plan"
          actionHref={SELF}
          selected={lone}
          onSelect={d => setLone(d.iso)}
        />
      </Section>

      <Section title="RingCarousel (Train)" note="Workouts this week (a number), volume against last week (a text number and its unit), the streak with its best on the pill.">
        <RingCarousel slides={RINGS} label="Training this week" onOpen={NOOP} />
      </Section>

      <Section title="StageTrainCard" note="The day's card: planned today, running, done, rest, a planned day picked in the rail, and a later week (a read-only list).">
        <StageTrainCard
          eyebrow="Today · planned"
          title="Push A"
          meta="Chest, shoulders, triceps · 6 exercises · about 55 min"
          thumbs={STILLS}
          actions={[{ label: 'Start Push A', icon: 'play', solid: true, onClick: NOOP }]}
          onMenu={NOOP}
        />
        <StageTrainCard
          eyebrow="In progress · 24:18"
          title="Push A"
          meta="3 of 6 exercises · 11 sets · next: Cable middle fly"
          progress={0.5}
          actions={[{ label: 'Resume', icon: 'play', solid: true, href: SELF }]}
          onMenu={NOOP}
        />
        <StageTrainCard
          eyebrow="Workout done"
          title="Push A"
          meta="52 min · 18 sets · 9 600 kg · 2 new bests"
          thumbs={STILLS}
          actions={[{ label: 'See workout', icon: 'trophy', onClick: NOOP }]}
        />
        <StageTrainCard
          eyebrow="Rest day"
          title="Recover"
          meta="Next: Legs, Mon 19 Oct"
          actions={[{ label: 'Train anyway', icon: 'play', onClick: NOOP }, { label: 'See Monday', onClick: NOOP }]}
        />
        <StageTrainCard
          eyebrow="Mon 19 Oct · planned"
          title="Legs"
          meta="Quads, hamstrings, calves · 6 exercises · about 60 min"
          thumbs={STILLS}
          actions={[{ label: 'Change this day', icon: 'calendar', onClick: NOOP }, { label: 'See routine', onClick: NOOP }]}
        />
        <StageTrainCard
          eyebrow="Sat 24 Oct"
          chip="Planned"
          title="Legs"
          meta="6 exercises · about 60 min · read-only until the day"
          exercises={[
            { name: 'Barbell full squat', sub: '4 × 5 · 100 kg', image: STILL, onClick: NOOP },
            { name: 'Barbell romanian deadlift', sub: '3 × 8 · 90 kg', image: STILL },
            { name: 'Lever seated calf raise', sub: '4 × 15 · 35 kg' },
          ]}
          actions={[{ label: 'Change this day', onClick: NOOP }, { label: 'Edit routine', onClick: NOOP }]}
        />
      </Section>

      <Section title="ExerciseThumbRow" note="The still on a white tile. Stage for glass lists, light on a light page; a row with a tap ends in a chevron, a trailing node replaces it.">
        <div className="g-glass g-kit-glass">
          <ExerciseThumbRow tone="stage" image={STILL} title="Barbell full squat" sub="4 × 5 · 100 kg" onClick={NOOP} />
          <ExerciseThumbRow tone="stage" first={false} title="No picture" sub="Dumbbell tile" onClick={NOOP} />
          <ExerciseThumbRow tone="stage" first={false} image={STILL} title="Only said" sub="No tap, no chevron" />
        </div>
        <div className="g-kit-light">
          <ExerciseThumbRow image={STILL} title="Sled 45° leg press" sub="3 × 10–12 · 160 kg" href={SELF} />
          <ExerciseThumbRow first={false} title="Swap" sub="With trailing" onClick={NOOP} trailing={<b>Swap</b>} />
        </div>
      </Section>

      <Section title="StageEmpty" note="Training not set up (board T2.9): a scene, one white button and two glass; then an icon with one button, and the bare form.">
        <StageEmpty
          illustration="plan"
          title="Add training"
          body="Plan your week, log every set, watch your lifts grow."
          action="Pick a ready-made plan"
          onClick={NOOP}
          actions={[{ label: 'Create a routine', onClick: NOOP }, { label: 'Import a plan file', icon: 'folder', onClick: NOOP }]}
        />
        <StageEmpty icon="clock" title="Nothing logged" body="Start a workout, or log one you did." action="Start a workout" href={SELF} />
        <StageEmpty icon="magnifier"title="No results" body="Try a shorter word." card={false} />
      </Section>
    </>
  )
}
