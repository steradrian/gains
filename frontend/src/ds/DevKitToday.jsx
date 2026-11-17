import { useState } from 'react'
import AwayCard from './AwayCard.jsx'
import BodyMap from './BodyMap.jsx'
import Section from './DevKitSection.jsx'
import FirstSteps from './FirstSteps.jsx'
import GlassRow from './GlassRow.jsx'
import MealTiles from './MealTiles.jsx'
import SavedIndicator from './SavedIndicator.jsx'
import StageSection from './StageSection.jsx'
import Tag from './Tag.jsx'
import WaterGlasses from './WaterGlasses.jsx'
import WorkoutCard from './WorkoutCard.jsx'

// The Today content kit's part of the catalogue (DevKit.jsx), on the stage with sample data.
const SELF = '#/dev/kit'
const MEALS = [
  { icon: 'sunrise', name: 'Breakfast', sub: '420 kcal', state: 'done' },
  { icon: 'sun', name: 'Lunch', sub: 'Add now', state: 'now' },
  { icon: 'moon', name: 'Dinner', sub: 'Nothing yet', state: 'empty' },
  { icon: 'apple', name: 'Snacks', sub: '180 kcal', state: 'done' },
]
const LONG_MEALS = [
  { icon: 'sunrise', name: 'Mic dejun', sub: '1,420 kcal', state: 'done' },
  { icon: 'apple', name: 'Gustare de după-amiază', sub: 'Nimic încă', state: 'empty' },
]

export default function DevKitToday() {
  const [picked, setPicked] = useState('')
  const [water, setWater] = useState(0.75)

  return (
    <>
      <Section title="StageSection" note="A title with a link, a title with a value (not tappable), a title alone.">
        <StageSection title="Food" action="See day" actionHref={SELF} />
        <StageSection title="Water" action="1.25 of 2.5 L" />
        <StageSection title="Up next" />
      </Section>

      <Section title="GlassRow" note="Up next on Today: play, resume (a workout is running), check (done), chev (rest day); one solid white control at most. With no href or onClick it is a plain card.">
        <GlassRow href={SELF} eyebrow="Training today" title="Push A" sub="6 exercises · about 55 min" trailing="play" />
        <GlassRow href={SELF} eyebrow="Workout running · 24:18" title="Push A" sub="3 of 6 exercises done" trailing="resume" />
        <GlassRow href={SELF} eyebrow="Done today" title="Push A" sub="52 min · 18 sets · 2 new bests" trailing="check" />
        <GlassRow href={SELF} eyebrow="Rest day" title="Recover" sub="Next: Legs, tomorrow" trailing="chev" />
        <GlassRow title="No handler" sub="Only said" />
      </Section>

      <Section title="MealTiles" note="Logged (check), the meal due (the one solid tile, + and its call), empty. A name wraps to two lines, a number never truncates.">
        <MealTiles meals={MEALS} onPick={m => setPicked(m.name)} />
        <MealTiles meals={LONG_MEALS} />
        <p>Last tapped: {picked || 'none'}</p>
      </Section>

      <Section title="WaterGlasses" note="Tumblers that fill: empty, partial, full, then interactive (tap + to watch the next glass fill; it is controlled by a value and onAdd). The first row uncontrolled, counting up to the target.">
        <WaterGlasses value={0} target={2.5} />
        <WaterGlasses value={1.25} target={2.5} />
        <WaterGlasses value={2.5} target={2.5} />
        <StageSection title="Interactive" action={water + ' of 2.5 L'} />
        <WaterGlasses value={water} target={2.5} onAdd={setWater} />
        <WaterGlasses target={2.5} />
      </Section>

      <Section title="FirstSteps" note="Board T1.9, under a StageSection. A step to do goes somewhere; the done one ticks and is only said.">
        <StageSection title="First steps" action="1 of 4" />
        <FirstSteps steps={[
          { title: 'Set your goal', sub: 'Done in onboarding', done: true },
          { title: 'Log your first meal', sub: 'Takes about 20 seconds', href: SELF },
          { title: 'Plan your training week', sub: 'Pick your days in Plan', href: SELF },
          { title: 'Weigh in', sub: 'Starts your trend', onClick: () => {} },
        ]} />
      </Section>

      <Section title="AwayCard" note="Board T1.10: a message and up to two buttons, the solid one white.">
        <AwayCard
          title="Welcome back"
          body="8 days since your last log. Your Plan kept going, so start from today. Nothing to catch up on."
          actions={[{ label: 'Weigh in', solid: true, onClick: () => {} }, { label: 'Not now', onClick: () => {} }]}
        />
      </Section>

      <Section title="SavedIndicator" note="The stage pill under the header (board T1.14), one state each; idle renders nothing. Then the light tag for a light header.">
        <SavedIndicator tone="stage" state="offline" waiting={3} onClick={() => {}} />
        <SavedIndicator tone="stage" state="offline" waiting={1} />
        <SavedIndicator tone="stage" state="syncing" />
        <SavedIndicator tone="stage" state="saved" />
        <SavedIndicator tone="stage" state="error" onClick={() => {}} />
        <SavedIndicator tone="stage" />
        <div className="g-kit-light">
          <div className="g-kit-row">
            <SavedIndicator state="saved" />
            <SavedIndicator state="syncing" />
            <SavedIndicator state="offline" waiting={3} onClick={() => {}} />
            <SavedIndicator state="error" onClick={() => {}} />
          </div>
        </div>
      </Section>

      <Section title="WorkoutCard" note="A workout on a Day page or in History: header, muscle map, exercises with their picture (a dumbbell without) and a New best tag.">
        <WorkoutCard
          name="Push A"
          meta="Mon 19 Oct · 52 min"
          badge="2 new bests"
          href={SELF}
          body="male"
          levels={{ chest: 4, deltoids: 3, triceps: 3, serratus: 1 }}
          muscles="Chest, shoulders, triceps"
          summary="18 sets"
          exercises={[
            { name: 'Bench press', sets: '4 × 8 · 80 kg', newBest: true, href: SELF },
            { name: 'Overhead press', sets: '3 × 10 · 40 kg', onClick: () => {} },
            { name: 'Dips', sets: 'BW × 12' },
          ]}
        />
        <WorkoutCard name="Rest-day walk" meta="Tue 20 Oct · 30 min" />
      </Section>

      <Section title="BodyMap and Tag" note="The muscle map on the stage and on a light surface (levels 0 to 4, a picked muscle outlined); Tag in each tone.">
        <BodyMap levels={{ chest: 4, biceps: 2, abs: 1 }} selected="chest" width={90} label="Muscles trained" />
        <div className="g-kit-light">
          <BodyMap tone="light" body="female" levels={{ gluteal: 4, quadriceps: 3, hamstring: 2 }} width={90} label="Muscles trained" />
          <div className="g-kit-row">
            <Tag>Accent</Tag>
            <Tag tone="positive" icon="check">Positive</Tag>
            <Tag tone="warning">Warning</Tag>
            <Tag tone="muted">Muted</Tag>
          </div>
        </div>
        <div className="g-kit-row"><Tag tone="glass">Glass</Tag></div>
      </Section>
    </>
  )
}
