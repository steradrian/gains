import Section from './DevKitSection.jsx'
import StatTiles from './StatTiles.jsx'

// The Train charts kit's part of the catalogue (DevKit.jsx), with static sample data.

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
    </>
  )
}
