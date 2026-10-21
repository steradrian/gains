import Section from './DevKitSection.jsx'
import Tabs from './Tabs.jsx'

// The Train exercises kit's part of the catalogue (DevKit.jsx), on a light surface with sample data.
const VIEWS = [{ value: 'how', label: 'How to' }, { value: 'progress', label: 'Progress' }, { value: 'history', label: 'History' }]

export default function DevKitTrainExercises() {
  return (
    <>
      <Section title="Tabs" note="The exercise drawer's three views (T6.1); tap them, or use the arrow keys, and the line slides.">
        <div className="g-kit-light">
          <Tabs options={VIEWS} ariaLabel="Exercise views" />
        </div>
      </Section>
    </>
  )
}
