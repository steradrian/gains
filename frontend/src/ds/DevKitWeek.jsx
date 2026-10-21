import Section from './DevKitSection.jsx'
import StageWeekCells from './StageWeekCells.jsx'
import StatTiles from './StatTiles.jsx'
import WeekStrip4 from './WeekStrip4.jsx'

// The Week page's part of the catalogue (DevKit.jsx, after the shared pages): its day cells, Last 4
// weeks and Numbers tiles, on the stage with sample data.
const NOOP = () => {}
const SELF = '#/dev/kit'
const TRAINING = ['done', 'rest', 'done', 'rest', 'missed', 'rest', 'planned']
const KCAL = [0.99, 0.93, 1, null, 0.8, 1.12, 0.61]
const DAYS = TRAINING.map((training, i) => ({
  key: String(i), dow: 'MTWTFSS'[i], date: 12 + i, training, kcal: KCAL[i], over: i === 5, today: i === 6,
  label: `Day ${12 + i}, ${training}`, onClick: NOOP,
}))
const PAST = DAYS.map((d, i) => ({ ...d, training: i === 6 ? 'skipped' : i % 2 ? 'rest' : 'done', today: false, href: SELF, onClick: undefined }))
const WEEKS = [
  { key: 'a', label: '21 Sep', done: 4, planned: 4, onClick: NOOP },
  { key: 'b', label: '28 Sep', done: 3, planned: 4, onClick: NOOP },
  { key: 'c', label: '5 Oct', done: 3, planned: 4, onClick: NOOP },
  { key: 'd', label: '12 Oct', done: 2, planned: 4, onClick: NOOP },
]
const NUMBERS = [
  { key: 's', label: 'Streak', value: '6 weeks', sub: 'in a row · best 8' },
  { key: 't', label: 'Days on target', value: '4 of 6', sub: 'within 150 kcal' },
  { key: 'w', label: 'Weight', value: '−0.3 kg', sub: '81.7 → 81.4 kg' },
  { key: 'v', label: 'Volume', value: '–' },
]

export default function DevKitWeek() {
  return (
    <>
      <Section title="Shared: week" note="The Week page's parts (Sh2Week, Sh2WeekPast): the day cells, Last 4 weeks and the Numbers tiles." />

      <Section title="StageWeekCells" note="This week: done, rest, missed and today planned, a kcal ring each (amber past the target, – with nothing logged); a past week of links with a skipped day; nutrition off (no kcal row or key); no legend.">
        <StageWeekCells days={DAYS} label="12 to 18 Oct" />
        <StageWeekCells days={PAST} label="5 to 11 Oct" />
        <StageWeekCells days={DAYS} food={false} />
        <StageWeekCells days={DAYS.map(d => ({ ...d, onClick: undefined }))} legend={false} />
      </Section>

      <Section title="WeekStrip4" note="Four weeks, the one on screen edged; then a week with nothing planned, and plain cells with nowhere to go.">
        <WeekStrip4 weeks={WEEKS} active={3} />
        <WeekStrip4 weeks={[...WEEKS.slice(1), { key: 'e', label: '19 Oct', done: 0, planned: 0, onClick: NOOP }]} active={0} />
        <WeekStrip4 weeks={WEEKS.map(w => ({ ...w, onClick: undefined }))} />
      </Section>

      <Section title="StatTiles" note="On the stage two to a row, a tile with nothing to show reads –; then the light tone, three to a row.">
        <StatTiles tone="stage" columns={2} items={NUMBERS} />
        <StatTiles items={NUMBERS.slice(0, 3)} />
      </Section>
    </>
  )
}
