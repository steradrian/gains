import { useState } from 'react'
import BarChart from './BarChart.jsx'
import Section from './DevKitSection.jsx'
import Heatmap from './Heatmap.jsx'
import LineChart from './LineChart.jsx'
import MonthGrid from './MonthGrid.jsx'
import StatTiles from './StatTiles.jsx'

// The Train charts kit's part of the catalogue (DevKit.jsx), with static sample data.
const NOOP = () => {}
const ONE_RM = [80, 82, 81, 85, 84, 88, 90, 90, 93, 94, 96, 96]
const ONE_RM_POINTS = ONE_RM.map((v, i) => `Week ${i + 1}: ${v} kg`)
const WEEKS = [9, 12, 11, 14, 0, 13, 15, 12, 16, 14, 17, 11]
const WEEK_LABELS = WEEKS.map((_, i) => String(i + 1))
// Twenty-six weeks of a made-up routine (Mon, Wed, Fri, a longer Sat now and then), static
const YEAR = Array.from({ length: 26 * 7 }, (_, i) => {
  const dow = i % 7, wk = Math.floor(i / 7)
  if (wk < 3 || wk === 11) return 0
  if (dow === 0 || dow === 2 || dow === 4) return 1 + ((wk + dow) % 4)
  return dow === 5 && wk % 3 === 0 ? 2 : 0
})
const YEAR_DAYS = YEAR.map((v, i) => ({ iso: v ? `2026-w${Math.floor(i / 7)}-d${i % 7}` : undefined, label: `Day ${i + 1}: level ${v}`, future: i >= 26 * 7 - 3, today: i === 26 * 7 - 4 }))
const YEAR_MONTHS = [{ week: 0, label: 'May' }, { week: 4, label: 'Jun' }, { week: 9, label: 'Jul' }, { week: 13, label: 'Aug' }, { week: 17, label: 'Sep' }, { week: 22, label: 'Oct' }]

// October 2026 starts on a Thursday: three blanks in a Monday-first week
const OCTOBER = Array.from({ length: 31 }, (_, i) => {
  const n = i + 1
  const trained = [1, 4, 6, 8, 11, 13, 15, 18, 20].includes(n)
  return { day: n, iso: `2026-10-${String(n).padStart(2, '0')}`, value: trained ? 1 : null,label: `${n} Oct${trained ? ', 1 workout' : ''}` }
})
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function DevKitTrainLoad() {
  const [opened, setOpened] = useState(null)
  const [month, setMonth] = useState(0)

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
        {/* Eat root m2: `targets`, a goal that differs per bar (Food trends' Calories); the third bar has none */}
        <BarChart tone="stage" values={[1800, 2100, 1500, 2300]} targets={[2100, 2100, null, 2400]} labels={['M', 'T', 'W', 'T']} height={90} label="Four days against their own targets" />
        <div className="g-kit-light">
          <BarChart values={WEEKS} labels={WEEK_LABELS} highlight={11} label="Weekly volume, last 12 weeks" />
        </div>
      </Section>

      <Section title="Heatmap" note="A year by week, five shades, the latest week in view; scroll sideways. Days with something to open are buttons (Tab to them), today has a ring, and the last days are dimmed. Below, three shades in rows, and one that only shows.">
        <Heatmap tone="stage" byWeek levels={5} values={YEAR} days={YEAR_DAYS} months={YEAR_MONTHS} onDay={setOpened}
          legend={{ less: 'Less time', more: 'More time' }} label="Activity, last 26 weeks. Choose a day to open it." />
        <p>Opened: {opened || 'nothing'}</p>
        <Heatmap tone="stage" values={[0, 1, 2, 0, 2, 1, 0, 1, 2, 2, 0, 1, 0, 0]} label="Training, last 2 weeks: 8 days of 14" />
        <div className="g-kit-light">
          <Heatmap byWeek values={YEAR} months={YEAR_MONTHS} legend={{ less: 'Less', more: 'More' }} label="Activity, last 26 weeks" />
        </div>
      </Section>

      <Section title="MonthGrid" note="A month on the stage: a ring on a trained day, a dimmed number on the rest, today lit. The days open (Tab to them), the arrows turn the month and stop at the ends. Below, the same month on a right-to-left page: the columns and the arrows mirror.">
        <MonthGrid
          title={month === 0 ? 'October 2026' : month < 0 ? 'September 2026' : 'November 2026'}
          weekdays={WEEKDAYS} offset={3} days={OCTOBER} today={21}
          onDay={setOpened}
          onPrev={month > -1 ? () => setMonth(month - 1) : undefined} prevLabel="Previous month"
          onNext={month < 1 ? () => setMonth(month + 1) : undefined} nextLabel="Next month"
          legend={[{ label: 'Trained', value: 1 }, { label: 'Planned', value: 0.4 }]}
        />
        <p>Opened: {opened || 'nothing'}</p>
        <div dir="rtl">
          <MonthGrid title="October 2026" weekdays={WEEKDAYS} offset={3} days={OCTOBER} today={21} onDay={setOpened}
            onPrev={NOOP} prevLabel="Previous month" onNext={NOOP} nextLabel="Next month" />
        </div>
      </Section>
    </>
  )
}
