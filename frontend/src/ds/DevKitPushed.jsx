import { useState } from 'react'
import ChipGroup from './ChipGroup.jsx'
import Section from './DevKitSection.jsx'
import GlassValueRow from './GlassValueRow.jsx'
import RadioRow from './RadioRow.jsx'
import StagePage from './StagePage.jsx'
import StageSegmented from './StageSegmented.jsx'

// The pushed-page kit's part of the catalogue (DevKit.jsx), on the stage with sample data.
const SELF = '#/dev/kit'
const NOOP = () => {}
const RANGES = ['Week', '30d', '90d', 'All']
const PLANS = ['16:8', '18:6', '20:4', 'OMAD']
const MUSCLES = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes']
const UNITS = [
  { value: 'kg', title: 'Kilograms', sub: 'kg' },
  { value: 'lb', title: 'Pounds', sub: 'lb' },
  { value: 'st', title: 'Stone', sub: 'st and lb' },
]

export default function DevKitPushed() {
  const [range, setRange] = useState('30d')
  const [plan, setPlan] = useState('16:8')
  const [muscle, setMuscle] = useState('Chest')
  const [stageMuscle, setStageMuscle] = useState('Legs')
  const [unit, setUnit] = useState('kg')

  return (
    <>
      <Section title="Train: pushed pages" note="The frame a pushed page stands in, and the controls it is built from. Each frame is a phone-sized scroll area: the nav bar sticks, and the tab bar's room is left at the foot." />

      <Section title="StagePage" note="With a large title and its line; without one (the bar's title is the heading); with one action. The stage is at half the roots' intensity.">
        <div className="g-kit-page">
          <StagePage onBack={NOOP} largeTitle="Plan" sub="Push A, Pull A, Legs · 4 days a week">
            <div className="g-kit-pbody"><p>Large title, no bar title.</p></div>
          </StagePage>
        </div>
        <div className="g-kit-page">
          <StagePage title="Routines" onBack={NOOP}>
            <div className="g-kit-pbody"><p>Bar title only.</p></div>
          </StagePage>
        </div>
        <div className="g-kit-page">
          <StagePage title="Plan" onBack={NOOP} actions={[{ icon: 'gear', label: 'Plan settings', onClick: NOOP }]} largeTitle="Next week" sub="Moves with your loop">
            <div className="g-kit-pbody"><p>Both titles, one action.</p></div>
          </StagePage>
        </div>
      </Section>

      <Section title="GlassValueRow" note="Tappable with a chevron; a link; static (says something, opens nothing); a custom trailing in place of the chevron. Inside one glass card.">
        <div className="g-glist g-glass">
          <GlassValueRow icon="scale" title="Weight" sub="Today" value="78.4 kg" onClick={NOOP} />
          <GlassValueRow icon="target" title="Target" value="75 kg" href={SELF} />
          <GlassValueRow icon="calendar" title="Started" value="12 Sep" static />
          <GlassValueRow title="Rest timer" value="90 s" trailing={<span className="g-kit-trail">Auto</span>} onClick={NOOP} />
        </div>
      </Section>

      <Section title="StageSegmented" note="Chart ranges. The lit option is the one tab stop; the arrow keys move it. Then two options, and a label that is long.">
        <StageSegmented label="Range" options={RANGES} value={range} onChange={setRange} />
        <StageSegmented label="Units" options={['Metric', 'Imperial']} />
        <StageSegmented label="Chart range" options={[{ value: 'w', label: 'This week' }, { value: 'm', label: 'Last 30 days' }, { value: 'a', label: 'All time' }]} />
      </Section>

      <Section title="RadioRow" note="On a light drawer, one option applies: selected is filled, the others hollow; with and without a line under the title; as a link.">
        <div className="g-kit-light">
          <div role="radiogroup" aria-label="Weight unit">
            {UNITS.map(u => <RadioRow key={u.value} title={u.title} sub={u.sub} selected={unit === u.value} onClick={() => setUnit(u.value)} />)}
          </div>
          <div role="radiogroup" aria-label="Plan">
            <RadioRow title="Every other day" selected onClick={NOOP} />
            <RadioRow title="Weekdays only" onClick={NOOP} />
            <RadioRow title="Choose days" sub="Pick them on the next page" href={SELF} />
          </div>
        </div>
      </Section>

      <Section title="ChipGroup" note="Light, wrapping; light, one scrolling row; stage, wrapping; stage, scrolling.">
        <div className="g-kit-light">
          <ChipGroup label="Fasting plan" options={PLANS} value={plan} onChange={setPlan} />
          <ChipGroup label="Muscle" options={MUSCLES} value={muscle} onChange={setMuscle} scroll />
        </div>
        <ChipGroup tone="stage" label="Fasting plan" options={PLANS} />
        <ChipGroup tone="stage" label="Muscle" options={MUSCLES} value={stageMuscle} onChange={setStageMuscle} scroll />
      </Section>
    </>
  )
}
