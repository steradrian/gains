import DetailRow from './DetailRow.jsx'
import Section from './DevKitSection.jsx'
import Tabs from './Tabs.jsx'

// The Train exercises kit's part of the catalogue (DevKit.jsx), on a light surface with sample data.
const NOOP = () => {}
const VIEWS = [{ value: 'how', label: 'How to' }, { value: 'progress', label: 'Progress' }, { value: 'history', label: 'History' }]

export default function DevKitTrainExercises() {
  return (
    <>
      <Section title="Tabs" note="The exercise drawer's three views (T6.1); tap them, or use the arrow keys, and the line slides.">
        <div className="g-kit-light">
          <Tabs options={VIEWS} ariaLabel="Exercise views" />
        </div>
      </Section>
      <Section title="DetailRow" note="Tinted and plain icons, a sub line, a value, a row that goes nowhere, a trailing control, and danger.">
        <div className="g-kit-light">
          <div>
            <DetailRow icon="plus" tint title="Add to my plan" sub="Pick a routine. Sets, reps and weight come next." onClick={NOOP} />
            <DetailRow icon="pencil" title="Suggest a fix for this exercise" sub="Opens the catalogue on GitHub" onClick={NOOP} />
            <DetailRow icon="dumbbell" title="Plate loading" value="20 kg" onClick={NOOP} />
            <DetailRow icon="info" title="Weight means" sub="As entered" />
            <DetailRow title="Favourite" trailing={<span className="g-kit-p">On</span>} onClick={NOOP} />
            <DetailRow icon="trash" title="Delete exercise" danger onClick={NOOP} chevron={false} />
          </div>
        </div>
      </Section>
    </>
  )
}
