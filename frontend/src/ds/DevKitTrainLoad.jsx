import Section from './DevKitSection.jsx'
import LineChart from './LineChart.jsx'
import StatTiles from './StatTiles.jsx'

// The Train charts kit's part of the catalogue (DevKit.jsx), with static sample data.
const ONE_RM = [80, 82, 81, 85, 84, 88, 90, 90, 93, 94, 96, 96]
const ONE_RM_POINTS = ONE_RM.map((v, i) => `Week ${i + 1}: ${v} kg`)

export default function DevKitTrainLoad() {
  return (
    <>
      <Section title="StatTiles" note="Two or three tiles: a label, a value, and a line under it that can read as good news. Glass on the stage, white on a light surface.">
        <StatTiles tone="stage" items={[
          { label: 'Workouts', value: '24' },
          { label: 'Time', value: '14 h 20', sub: '+2 h on last month', tone: 'positive' },
          { label: 'Volume', value: '186 t', sub: 'Same as last month' },
        ]} />
        <StatTiles tone="stage" items={[
          { label: 'Best set', value: '82.5 kg' },
          { label: 'Estimated 1RM', value: '101 kg', sub: 'New best', tone: 'positive' },
        ]} />
        <div className="g-kit-light">
          <StatTiles items={[
            { label: 'Workouts', value: '24' },
            { label: 'Time', value: '14 h 20', sub: '+2 h on last month', tone: 'positive' },
            { label: 'Volume', value: '186 t' },
          ]} />
        </div>
      </Section>

      <Section title="LineChart" note="Hover or touch the line for a point's reading. A screen reader gets the caller's sentence and the list of points. The latest point is marked; one point and a flat line are drawn too.">
        <LineChart tone="stage" height={170} values={ONE_RM} pointLabels={ONE_RM_POINTS} labels={['Jul', 'Aug', 'Sep', 'Oct']} label="Estimated 1RM, 80 kg in week 1 to 96 kg in week 12" />
        <LineChart tone="stage" values={[96]} pointLabels={['Week 12: 96 kg']} label="Estimated 1RM, one reading: 96 kg" />
        <LineChart tone="stage" values={[70, 70, 70, 70]} unit="kg" label="Weight, 70 kg throughout" />
        <div className="g-kit-light">
          <LineChart values={ONE_RM} pointLabels={ONE_RM_POINTS} labels={['Jul', 'Aug', 'Sep', 'Oct']} label="Estimated 1RM, 80 kg in week 1 to 96 kg in week 12" />
        </div>
      </Section>
    </>
  )
}
