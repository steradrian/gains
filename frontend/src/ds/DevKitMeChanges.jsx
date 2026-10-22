import Button from './Button.jsx'
import ChangeRow from './ChangeRow.jsx'
import Section from './DevKitSection.jsx'
import StageSection from './StageSection.jsx'
import Tag from './Tag.jsx'

// Me > Recent changes' part of the catalogue (DevKit.jsx, under "Me: changes").
const NOOP = () => {}

export default function DevKitMeChanges() {
  return (
    <Section title="ChangeRow" note="A day header (StageSection label), then rows: Restore as a glass button, a Restored tag once it is back, Undo for the Coach's own log, a long name that wraps. The row is a card; only the control is tapped.">
      <StageSection variant="label" title="Today" />
      <div className="g-kit-col">
        <ChangeRow title="Deleted Oats with milk" detail="Breakfast, Sun 18 Oct · 380 kcal · 09:12"
          trailing={<Button size="sm" variant="glass" onClick={NOOP}>Restore</Button>} />
        <ChangeRow title="Changed a weigh-in" detail="Sun 11 Oct · 81.8 → 81.7 kg · 08:05"
          trailing={<Tag tone="glass" icon="check">Restored</Tag>} />
        <ChangeRow title="Coach moved Legs" detail="Friday → Monday · 21:30"
          trailing={<Button size="sm" variant="glass" onClick={NOOP}>Undo</Button>} />
        <ChangeRow title="Deleted routine Legs deload with a name long enough to wrap onto a second line" detail="5 exercises · 19:44"
          trailing={<Button size="sm" variant="glass" busy onClick={NOOP}>Restore</Button>} />
      </div>
    </Section>
  )
}
