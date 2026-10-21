import { useState } from 'react'
import Chip from './Chip.jsx'
import DetailRow from './DetailRow.jsx'
import Section from './DevKitSection.jsx'
import StageSearchField from './StageSearchField.jsx'
import Tabs from './Tabs.jsx'

// The Train exercises kit's part of the catalogue (DevKit.jsx), on a light surface with sample data.
const NOOP = () => {}
const VIEWS = [{ value: 'how', label: 'How to' }, { value: 'progress', label: 'Progress' }, { value: 'history', label: 'History' }]

export default function DevKitTrainExercises() {
  const [q, setQ] = useState('bench')
  const [fav, setFav] = useState(false)
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
      <Section title="StageSearchField" note="In a page (T6.0): type and the count and the × appear; the × empties the text. Then the overlay's head with a scope chip and the glass ×.">
        <div className="g-kit-col">
          <StageSearchField
            placeholder="Search 6,554 exercises" label="Search exercises" query={q} onChange={setQ}
            clearLabel="Clear" count={q ? '12' : undefined} countLabel="12 exercises"
          />
          <StageSearchField
            placeholder="Search training" label="Search training" query="squat" onChange={NOOP}
            scope="Exercises" onClearScope={NOOP} scopeLabel="Remove the Exercises scope"
            onClose={NOOP} closeLabel="Close search"
          />
        </div>
      </Section>
      <Section title="Chip" note="The stage filter chip: off, on, with a count, and the two that open a choice (▾), one of them holding a pick. Favourites toggles.">
        <div className="g-kit-row">
          <Chip opens>Any equipment</Chip>
          <Chip opens pressed>Barbell</Chip>
          <Chip pressed={fav} count={3} onClick={() => setFav(v => !v)}>Favourites</Chip>
          <Chip pressed>Home gym</Chip>
        </div>
      </Section>
    </>
  )
}
