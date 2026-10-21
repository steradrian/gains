// @vitest-environment happy-dom
// CurrentSet (boards W1.2, W1.32, W1.35, W1.28): the set's line with the last time, the fields in
// one row (a body weight tile in the weight's place the first time) and whatever else under it.
import { describe, expect, it, vi } from 'vitest'
import CurrentSet from './CurrentSet.jsx'
import SetStepper from './SetStepper.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const head = () => view.host.querySelector('.g-cs-head')
const steppers = () => (
  <>
    <SetStepper label="kg" defaultValue={80} lessLabel="Less kg" moreLabel="More kg" />
    <SetStepper label="Reps" defaultValue={8} lessLabel="Less Reps" moreLabel="More Reps" />
  </>
)

describe('CurrentSet', () => {
  it('draws the set line, what was done last time and the fields in one row', () => {
    view.render(<CurrentSet setLine="Set 2 of 3" last="Last time 80 × 8" fields={steppers()} />)
    expect(head().querySelector('b').textContent).toBe('Set 2 of 3')
    expect(head().querySelector('span').textContent).toBe('Last time 80 × 8')
    expect(view.host.querySelectorAll('.g-cs-row .g-sst')).toHaveLength(2)
    expect(view.host.querySelector('section').getAttribute('aria-label')).toBe('Set 2 of 3')
  })

  it('says the caller\'s first-time line instead of the last time', () => {
    view.render(<CurrentSet setLine="Set 1" first firstLabel="Première fois" last="Last time 80 × 8" fields={steppers()} />)
    expect(head().querySelector('span').textContent).toBe('Première fois')
  })

  it('has nothing on the right of the line when it has nothing to say', () => {
    view.render(<CurrentSet setLine="Set 2 · editing" fields={steppers()} />)
    expect(head().querySelector('span')).toBeNull()
  })

  it('shows a body weight tile in the weight\'s place, which adds weight', () => {
    const onLoad = vi.fn()
    view.render(
      <CurrentSet
        setLine="Set 2 of 2" first firstLabel="First time" bodyweight loadLabel="Load" bodyweightLabel="Body weight" loadHint="Tap to add weight" onLoad={onLoad}
        fields={<SetStepper label="Reps" defaultValue={15} lessLabel="Less Reps" moreLabel="More Reps" />}
      />,
    )
    const tile = view.host.querySelector('.g-cs-bw')
    expect([...tile.children].map(c => c.textContent)).toEqual(['Load', 'Body weight', 'Tap to add weight'])
    expect(view.host.querySelectorAll('.g-cs-row .g-sst')).toHaveLength(1)
    click(tile)
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('the body weight tile is a link with loadHref', () => {
    view.render(<CurrentSet setLine="x" bodyweight loadLabel="Load" bodyweightLabel="Body weight" loadHint="h" loadHref="#/load" />)
    expect(view.host.querySelector('.g-cs-bw').tagName).toBe('A')
  })

  it('has no body weight tile otherwise', () => {
    view.render(<CurrentSet setLine="x" fields={steppers()} />)
    expect(view.host.querySelector('.g-cs-bw')).toBeNull()
  })

  it('holds three fields for cardio, and the children under the row', () => {
    view.render(
      <CurrentSet
        setLine="Set 1 of 1"
        fields={(
          <>
            <SetStepper label="min" lessLabel="a" moreLabel="b" />
            <SetStepper label="km/h" lessLabel="c" moreLabel="d" />
            <SetStepper label="%" lessLabel="e" moreLabel="f" />
          </>
        )}
      >
        <p className="below">Plate line goes here</p>
      </CurrentSet>,
    )
    expect(view.host.querySelectorAll('.g-cs-row .g-sst')).toHaveLength(3)
    const below = view.host.querySelector('.below')
    expect(below.parentElement.classList.contains('g-cs')).toBe(true)
    expect(below.previousElementSibling.classList.contains('g-cs-row')).toBe(true)
  })

  it('marks a warm-up set', () => {
    view.render(<CurrentSet setLine="Warm-up set 1 of 2" warmup fields={steppers()} />)
    expect(view.host.querySelector('.g-cs').classList.contains('g-cs-warm')).toBe(true)
    view.render(<CurrentSet setLine="Set 1 of 2" fields={steppers()} />)
    expect(view.host.querySelector('.g-cs').classList.contains('g-cs-warm')).toBe(false)
  })
})
