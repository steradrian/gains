import Section from './DevKitSection.jsx'
import BarChart from './BarChart.jsx'
import LineChart from './LineChart.jsx'
import StatTiles from './StatTiles.jsx'

// The Train charts kit's part of the catalogue (DevKit.jsx), with static sample data.
const ONE_RM = [80, 82, 81, 85, 84, 88, 90, 90, 93, 94, 96, 96]
const ONE_RM_POINTS = ONE_RM.map((v, i) => `Week ${i + 1}: ${v} kg`)
const WEEKS = [9, 12, 11, 14, 0, 13, 15, 12, 16, 14, 17, 11]
const WEEK_LABELS = WEEKS.map((_, i) => String(i + 1))

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

      <Section title="BarChart" note="Twelve weeks, this week at full strength and the others dimmed, with a dashed target line. Without per-bar text it is one image named by the caller; with it, a group with a hidden list.">
        <BarChart tone="stage" values={WEEKS} labels={WEEK_LABELS} highlight={11} target={16} barLabels={WEEKS.map((v, i) => `Week ${i + 1}: ${v} t`)} label="Weekly volume, last 12 weeks, target 16 t" />
        <BarChart tone="stage" values={[3, 5, 0, 4]} labels={['M', 'T', 'W', 'T']} height={90} label="Four days: 3, 5, none and 4 sets" />
        <div className="g-kit-light">
          <BarChart values={WEEKS} labels={WEEK_LABELS} highlight={11} label="Weekly volume, last 12 weeks" />
        </div>
      </Section>
    </>
  )
}
