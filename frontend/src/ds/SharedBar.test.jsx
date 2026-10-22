// @vitest-environment happy-dom
// SharedBar: a segment per person in join order, each as long as their own share of the goal,
// never sorted, never red, full (not "over") past the goal.
import { describe, expect, it } from 'vitest'
import SharedBar from './SharedBar.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const segs = () => [...view.host.querySelectorAll('.g-sbar-seg')]
const basis = el => parseFloat(el.style.flexBasis)

describe('SharedBar', () => {
  it('draws the segments in the order given, one per person with something counted', () => {
    view.render(<SharedBar goal={15} segments={[
      { value: 3, tone: 'mint' }, { value: 2, tone: 'blue' }, { value: 0, tone: 'purple' }, { value: 4, tone: 'orange' },
    ]} />)
    expect(segs()).toHaveLength(3)
    expect(segs().map(s => s.className.match(/g-mtone-(\w+)/)[1])).toEqual(['mint', 'blue', 'orange'])
  })

  it('sizes each segment by its own value of the goal, so the segments add up to the count', () => {
    view.render(<SharedBar goal={20} segments={[{ value: 5, tone: 'mint' }, { value: 3, tone: 'blue' }, { value: 2, tone: 'green' }]} />)
    expect(segs().map(basis)).toEqual([25, 15, 10])
    expect(segs().map(basis).reduce((a, b) => a + b, 0)).toBe(50)
  })

  it('is full and shares the bar past the goal, never longer than the bar', () => {
    view.render(<SharedBar goal={4} segments={[{ value: 4, tone: 'mint' }, { value: 4, tone: 'blue' }]} />)
    expect(segs().map(basis)).toEqual([50, 50])
  })

  it('does not rank: a smaller segment stays where the order puts it', () => {
    view.render(<SharedBar goal={10} segments={[{ value: 1, tone: 'mint' }, { value: 6, tone: 'blue' }]} />)
    expect(segs().map(basis)).toEqual([10, 60])
  })

  it('falls back to the stage glass for an unknown tone, and never to a red one', () => {
    view.render(<SharedBar goal={5} segments={[{ value: 1, tone: 'red' }]} />)
    expect(segs()[0].className).toContain('g-mtone-white')
  })

  it('draws an empty track with nothing counted or no goal', () => {
    view.render(<SharedBar goal={0} segments={[]} />)
    expect(segs()).toHaveLength(0)
    expect(view.host.querySelector('.g-sbar')).not.toBeNull()
  })

  it('is one image: the label when given, else the segments\' own spoken labels', () => {
    view.render(<SharedBar goal={15} label="12 of 15 workouts" segments={[{ value: 3, tone: 'mint', label: 'Adrian: 3' }]} />)
    expect(view.host.querySelector('.g-sbar').getAttribute('aria-label')).toBe('12 of 15 workouts')
    view.render(<SharedBar goal={15} segments={[{ value: 3, tone: 'mint', label: 'Adrian: 3' }, { value: 2, tone: 'blue', label: 'Mara: 2' }]} />)
    expect(view.host.querySelector('.g-sbar').getAttribute('aria-label')).toBe('Adrian: 3, Mara: 2')
    expect(view.host.querySelector('.g-sbar').getAttribute('role')).toBe('img')
  })
})
