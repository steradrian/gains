import { useState } from 'react'
import DayFoodCard from './DayFoodCard.jsx'
import DayStatusCard from './DayStatusCard.jsx'
import Section from './DevKitSection.jsx'
import RadioRow from './RadioRow.jsx'
import StageDayRail from './StageDayRail.jsx'

// The Day page's part of the catalogue (DevKit.jsx, under "Shared: pages"): the parts the Day
// page (PR07 D1) adds, on the stage with sample data.
const NOOP = () => {}
// A white tile standing in for an exercise still.
const STILL = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" fill="#fff"/><path d="M8 22h28M13 15v14M31 15v14" stroke="#555" stroke-width="3" stroke-linecap="round"/></svg>')

const MACROS = [
  { key: 'p', name: 'Protein', line: '132 of 150 g', progress: 0.88 },
  { key: 'c', name: 'Carbs', line: '214 of 230 g', progress: 0.93 },
  { key: 'f', name: 'Fat', line: '66 of 70 g', progress: 0.94 },
]
const MEALS = [
  { key: 0, icon: 'sunrise', name: 'Breakfast', sub: 'Oats with milk, Banana', value: '485', unit: 'kcal', onClick: NOOP },
  { key: 1, icon: 'sun', name: 'Lunch', sub: 'Chicken rice bowl', value: '540', unit: 'kcal', onClick: NOOP },
  { key: 2, icon: 'moon', name: 'Dinner', sub: 'Salmon, Baked potatoes, Green beans with a long name that has to cut', value: '720', unit: 'kcal', onClick: NOOP },
  { key: 3, icon: 'apple', name: 'Snacks', sub: 'Nothing logged', onClick: NOOP },
]

const day = (iso, dow, date, state, disabled = false) => ({ iso, dow, date, state, label: `${dow} ${date}`, disabled })
const WEEK = [
  day('k-28', 'M', 28, 'plain', true), day('k-29', 'T', 29, 'plain', true), day('k-30', 'W', 30, 'done'),
  day('k-1', 'T', 1, 'rest'), day('k-2', 'F', 2, 'missed'), day('k-3', 'S', 3, 'rest'), day('k-4', 'S', 4, 'done'),
]

function Rail() {
  const [selected, setSelected] = useState('k-30')
  return <StageDayRail weeks={[WEEK]} week={0} title="Week of 28 Sept" action="Week" onAction={NOOP} selected={selected} onSelect={d => setSelected(d.iso)} />
}

export default function DevKitDay() {
  return (
    <>
      <Section title="StageDayRail on a Day page" note="Days before the first log are dimmed and cannot be tapped; the Week link opens the week on show.">
        <Rail />
      </Section>

      <Section title="DayStatusCard" note="A rest day with a glass button; a missed workout (amber disc, faded stills, the white button); skipped with its tag; food tracking off (grey line).">
        <div className="g-kit-col">
          <DayStatusCard icon="moon" title="Rest day" body="Nothing planned. Pull A was next, Wed 14 Oct." actions={[{ label: 'Add past workout', onClick: NOOP }]} />
          <DayStatusCard tone="warn" icon="calendar" title="Legs was planned, not logged" body="Log it if you trained and forgot, or mark it skipped."
            thumbs={[STILL, STILL, null, STILL, STILL]} actions={[{ label: 'Add past workout', solid: true, onClick: NOOP }, { label: 'Mark skipped', onClick: NOOP }]} />
          <DayStatusCard icon="skipForward" title="Legs, skipped" body="History still shows it as missed." tag="Skipped" />
          <DayStatusCard tone="off" icon="utensils" title="Tracking off" body="Sign in on the web app to log food and see your day here." />
        </div>
      </Section>

      <Section title="DayFoodCard" note="On target with the macros and the meals (a long line cuts, a meal with nothing says so); then nothing eaten and no macro goals.">
        <div className="g-kit-col">
          <DayFoodCard big="2,075" of="of 2,100 kcal" status="On target" progress={0.99} macros={MACROS} meals={MEALS} />
          <DayFoodCard big="0" of="of 2,100 kcal" status="2,100 under target" progress={0}
            macros={MACROS.map(m => ({ ...m, line: '0 g', progress: null }))} />
        </div>
      </Section>

      <Section title="RadioRow" note="Add past workout's choices on the light drawer: the planned one picked, then the others.">
        <div className="g-kit-light">
          <div className="g-pw-card" role="radiogroup" aria-label="Workout">
            <RadioRow title="Legs" sub="Planned for this day · 5 exercises" selected onClick={NOOP} />
            <RadioRow title="Push A" sub="6 exercises" onClick={NOOP} />
            <RadioRow title="Freestyle" sub="Pick exercises as you go" onClick={NOOP} />
          </div>
        </div>
      </Section>
    </>
  )
}
