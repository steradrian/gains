import Section from './DevKitSection.jsx'
import TrendChart from './TrendChart.jsx'
import WeighInRow from './WeighInRow.jsx'

// The Body page's part of the catalogue (DevKit.jsx, Me body M1): the dated trend chart and the
// weigh-in row, on the stage with sample data (board Me2Body).
const NOOP = () => {}
const POINTS = [
  ['2026-09-06', 83.6], ['2026-09-13', 83.4], ['2026-09-20', 83.0], ['2026-09-27', 82.6],
  ['2026-10-04', 82.1], ['2026-10-11', 81.7], ['2026-10-18', 81.4],
].map(([d, v]) => ({ d, v }))
const AXIS = [{ d: '2026-09-06', text: '6 Sep' }, { d: '2026-09-20', text: '20 Sep' }, { d: '2026-10-04', text: '4 Oct' }, { d: '2026-10-18', text: '18 Oct' }]
const LABELS = POINTS.map(p => `${p.d.slice(8)} ${p.d.slice(5, 7) === '09' ? 'Sep' : 'Oct'}: ${p.v} kg`)

export default function DevKitMeBody() {
  return (
    <>
      <Section title="Me: body" note="The Body page's parts (Me2Body): the dated trend chart and the weigh-in row." />

      <Section title="TrendChart" note="Points sit on their dates; touch or hover reads the nearest one. With a dashed Target line and its caption, without one, and a single weigh-in (a dot).">
        <TrendChart points={POINTS} axis={AXIS} target={78} targetCaption="Target 78 kg" pointLabels={LABELS} unit="kg" label="Weight over time" />
        <TrendChart points={POINTS} axis={AXIS} pointLabels={LABELS} unit="kg" label="Weight over time" />
        <TrendChart points={POINTS.slice(-1)} unit="kg" label="Weight over time" />
      </Section>

      <Section title="WeighInRow" note="The whole row opens the Edit weigh-in drawer. The change from the weigh-in before, and for one made offline a second tag.">
        <WeighInRow weight="81.4 kg" date="Sun 18 Oct · today" change="−0.3 kg" onClick={NOOP} />
        <WeighInRow weight="81.7 kg" date="Sun 11 Oct" change="−0.4 kg" waiting="Waiting to sync" onClick={NOOP} />
        <WeighInRow weight="83.6 kg" date="Sun 6 Sep" onClick={NOOP} />
      </Section>
    </>
  )
}
