import { useState } from 'react'
import Section from './DevKitSection.jsx'
import StageSwitch from './StageSwitch.jsx'

// The Train coach and gym kit's part of the catalogue (DevKit.jsx), with static sample data.
export default function DevKitTrainCoach() {
  const [filter, setFilter] = useState(true)

  return (
    <>
      <Section title="StageSwitch" note="On and off, on glass; the first is controlled. The caller names it and writes the text beside it; the lit one is white with an accent knob.">
        <div className="g-glist g-glass">
          <div className="g-glist-row">
            <span className="g-glist-body"><b>Filter by equipment</b><span>{filter ? 'Home gym only' : 'Everything'}</span></span>
            <StageSwitch label="Filter by equipment" checked={filter} onChange={setFilter} />
          </div>
          <div className="g-glist-row">
            <span className="g-glist-body"><b>Uncontrolled, starts off</b></span>
            <StageSwitch label="Uncontrolled, starts off" />
          </div>
        </div>
      </Section>
    </>
  )
}
