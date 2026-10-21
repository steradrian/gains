import { useState } from 'react'
import Section from './DevKitSection.jsx'
import BigStepper from './BigStepper.jsx'
import ChatBubble from './ChatBubble.jsx'
import StageSwitch from './StageSwitch.jsx'

// The Train coach and gym kit's part of the catalogue (DevKit.jsx), with static sample data.
export default function DevKitTrainCoach() {
  const [filter, setFilter] = useState(true)
  const [pairs, setPairs] = useState(2)
  const [bell, setBell] = useState(12.5)

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

      <Section title="BigStepper" note="A count a step at a time, on a light drawer: whole pairs with a unit and a hint, stopping at 0 and at a maximum; then a fraction with a step of 2.5; then on the stage.">
        <div className="g-kit-light">
          <BigStepper label="25 kg plates, pairs" value={pairs} max={6} unit="pairs" hint="Per side of the bar" lessLabel="Fewer 25 kg plates" moreLabel="More 25 kg plates" onChange={setPairs} />
          <BigStepper label="Dumbbell" value={bell} step={2.5} min={2} unit="kg" lessLabel="Lighter dumbbell" moreLabel="Heavier dumbbell" onChange={setBell} />
        </div>
        <BigStepper tone="stage" label="Rest between sets" value={90} step={15} unit="s" hint="Quarter-minute steps" lessLabel="Shorter rest" moreLabel="Longer rest" />
      </Section>

      <Section title="ChatBubble" note="The Coach on glass at the start, you in white at the end (mirrored in RTL); the sender is spoken, the time shown; then a list inside, and a failed run.">
        <div className="g-kit-col">
          <ChatBubble who="Coach" time="09:40" text="Friday’s Legs didn’t happen. Want me to move it to Monday?" />
          <ChatBubble me who="You" time="09:41" text="Can we keep Sunday free from now on?" />
          <ChatBubble me who="You"><span>Here is what I am working with:</span><ul><li>Build muscle</li><li>4 days a week</li></ul></ChatBubble>
          <ChatBubble who="Coach" error text="The Coach couldn’t finish that. Try again in a minute." />
        </div>
      </Section>
    </>
  )
}
