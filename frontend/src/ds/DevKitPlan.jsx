import { useState } from 'react'
import Section from './DevKitSection.jsx'
import LoopStrip from './LoopStrip.jsx'
import PlanWeekGrid from './PlanWeekGrid.jsx'
import VolumeBars from './VolumeBars.jsx'

// The Plan page's kit in the catalogue (DevKit.jsx), on the stage with the board's sample week:
// Sunday 18 October 2026 is today, Friday's Legs was missed.
const PLAN = { 1: 'Push A', 3: 'Pull A', 5: 'Legs', 0: 'Push A' }
const NEXT = { 1: 'Legs', 3: 'Pull A', 4: 'Push A', 6: 'Legs' }
const DOWS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const LONG = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }
const week = (title, first, names, stateOf) => ({
  title,
  days: Array.from({ length: 7 }, (_, k) => {
    const date = first + k, dow = (k + 1) % 7, name = names[dow] || null
    const state = stateOf(date, name)
    return { iso: `2026-10-${date}`, date, state, short: name || 'Rest', today: date === 18, label: `${LONG[dow]} ${date} Oct, ${name || 'Rest day'}` }
  }),
})
const WEEKS = [
  week('This week', 12, PLAN, (date, name) => (!name ? 'rest' : date === 16 ? 'missed' : date < 18 ? 'done' : 'planned')),
  week('Next week', 19, NEXT, (date, name) => (name ? 'planned' : 'rest')),
]
const LOOP = [
  { id: 'push', n: 1, name: 'Push A', state: 'next', label: '1. Push A, Up next' },
  { id: 'pull', n: 2, name: 'Pull A', state: 'later', label: '2. Pull A, Later' },
  { id: 'legs', n: 3, name: 'Legs', state: 'later', label: '3. Legs, Later' },
]
const VOLUME = [['Upper back', 14], ['Shoulders', 12], ['Chest', 10], ['Quads', 7], ['Hamstrings', 6], ['Biceps', 6], ['Triceps', 6], ['Calves', 4]]
  .map(([name, sets]) => ({ key: name, name, sets, value: `${sets} sets` }))

export default function DevKitPlan() {
  const [picked, setPicked] = useState(null)
  const [editing, setEditing] = useState(false)
  return (
    <>
      <Section title="Train: plan" note="The Plan page's own pieces (boards T3.0 to T3.3)." />

      <Section title="PlanWeekGrid" note={'This week and next. Done is white with a tick, missed is amber with a cross, rest is faint, today is ringed. Tapped: ' + (picked || 'none')}>
        <PlanWeekGrid weeks={WEEKS} dows={DOWS} onPick={setPicked} />
      </Section>

      <Section title="LoopStrip" note="The loop with the next one lit and Edit; a round under way; a fixed week, unnumbered; an empty loop.">
        <LoopStrip title="Your loop" line="3 workouts, then repeat" items={LOOP} note="A missed day moves the loop forward; nothing is lost."
          action={{ label: editing ? 'Done' : 'Edit', pressed: editing, onClick: () => setEditing(e => !e) }} />
        <LoopStrip title="Your loop" line="3 workouts, then repeat" items={[{ ...LOOP[0], state: 'done', label: '1. Push A, Done' }, { ...LOOP[1], state: 'next' }, LOOP[2]]} />
        <LoopStrip title="Your week" items={LOOP.map(i => ({ ...i, state: null, label: i.name }))} numbered={false} note="The same routines on the same weekdays, every week." />
        <LoopStrip title="Your loop" items={[]} empty="No rotation yet" action={{ label: 'Add', onClick: () => {} }} />
      </Section>

      <Section title="VolumeBars" note="Planned sets a week against the 10 to 12 band: amber below it.">
        <VolumeBars rows={VOLUME} target={[10, 12]} note="Planned sets per week, from your plan. The line is a common target of 10 to 12." />
      </Section>
    </>
  )
}
