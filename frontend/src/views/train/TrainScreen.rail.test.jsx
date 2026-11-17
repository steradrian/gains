// @vitest-environment happy-dom
// Train's rail keeps its page as a week offset: when the rail's first week moves (older workouts
// arrive by sync, or the oldest is deleted) the week shown stays the same week.
import { describe, expect, it } from 'vitest'
import { base } from '../../dev/screens/states/train.jsx'
import { click, useView } from '../../ds/render.test-util.js'
import TrainScreen from './TrainScreen.jsx'

const view = useView()
const title = () => view.host.querySelector('.g-rail-title').textContent

describe('the rail page', () => {
  it('stays on the week it was turned to when an earlier week is added before it', () => {
    const later = { ...base.rail, from: -1, weeks: base.rail.weeks.slice(1) }
    view.render(<TrainScreen {...base} rail={later} />)
    expect(title()).toBe('This week')
    click(view.host.querySelector('.g-rail-btn[aria-label="Next week"]'))
    expect(title()).toBe('Next week')
    view.render(<TrainScreen {...base} rail={base.rail} />)
    expect(title()).toBe('Next week')
  })
})
