// @vitest-environment happy-dom
// StageRing: the number and its lines, the white arc for the share done, the amber arc past the
// target, the number a step smaller above four digits, and the skeleton.
import { describe, expect, it } from 'vitest'
import StageRing from './StageRing.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const q = sel => view.host.querySelector(sel)
const offset = el => el.style.getPropertyValue('--to')
// the circumference of the default 240px ring at 16px stroke
const C = 653.45

describe('StageRing', () => {
  it('holds the two landing boxes of the onboarding thread on its 9 and 12 o\'clock tangents', () => {
    view.render(<StageRing value={1} max={2} big="1" />)
    // r = 104 at 240/16: the stroke's middle runs 16px in from the box
    const v = q('.g-sring-land-v').style, h = q('.g-sring-land-h').style
    expect([v.left, v.top]).toEqual(['16px', '88px'])
    expect([h.left, h.top]).toEqual(['88px', '16px'])
    expect(q('.g-sring-land-v').getAttribute('aria-hidden')).toBe('true')
  })

  it('reads as one image: its lines in order', () => {
    view.render(<StageRing value={1200} max={2400} top="Left today" big="1,200" unit="of 2,400 kcal" />)
    const ring = q('.g-sring')
    expect(ring.getAttribute('role')).toBe('img')
    expect(ring.getAttribute('aria-label')).toBe('Left today 1,200 of 2,400 kcal')
    expect([...view.host.querySelectorAll('.g-sring-in > *')].map(e => e.textContent)).toEqual(['Left today', '1,200', 'of 2,400 kcal'])
  })

  it('draws the share done as the white arc', () => {
    view.render(<StageRing value={1} max={4} big="3" />)
    expect(Number(offset(q('.g-sring-val')))).toBeCloseTo(C * 0.75, 0)
    expect(q('.g-sring-over')).toBeNull()
  })

  it('draws no arc at zero and a closed ring at or past the max', () => {
    view.render(<StageRing value={0} max={10} big="0" />)
    expect(q('.g-sring-val')).toBeNull()
    view.render(<StageRing value={12} max={10} big="0" />)
    expect(Number(offset(q('.g-sring-val')))).toBe(0)
  })

  it('does not divide by a zero max', () => {
    view.render(<StageRing value={5} max={0} big="5" />)
    expect(q('.g-sring-val')).toBeNull()
  })

  it('adds the amber arc for how far over, as the over-target board draws it (180 over 2,100)', () => {
    view.render(<StageRing value={2100} max={2100} over={180 / 2100} top="Over today" big="180" unit="kcal over 2,100" />)
    expect(Number(offset(q('.g-sring-val')))).toBe(0)
    expect(Number(offset(q('.g-sring-over')))).toBeCloseTo(597.4, 1)
    expect(q('.g-sring-in').textContent).toBe('Over today180kcal over 2,100')
  })

  it('never draws the over arc past a full turn', () => {
    view.render(<StageRing value={1} max={1} over={3} big="9" />)
    expect(Number(offset(q('.g-sring-over')))).toBe(0)
  })

  it('keeps the number at its size up to four digits and steps it down above', () => {
    view.render(<StageRing big="2,280" />)
    expect(q('.g-sring-in b').getAttribute('style')).toBeNull()
    view.render(<StageRing big="12,280" />)
    expect(q('.g-sring-in b').style.fontSize).toBe('44px')
    expect(q('.g-sring-in b').textContent).toBe('12,280')
  })

  it('scales the number with a smaller ring', () => {
    view.render(<StageRing size={120} big="73" />)
    expect(q('.g-sring').style.width).toBe('120px')
    expect(q('.g-sring-in b').style.fontSize).toBe('28px')
  })

  it('draws the skeleton: the track and two blobs, hidden from the reader', () => {
    view.render(<StageRing loading value={5} max={10} big="5" top="Left" />)
    const ring = q('.g-sring')
    expect(ring.getAttribute('aria-hidden')).toBe('true')
    expect(ring.hasAttribute('role')).toBe(false)
    expect(q('.g-sring-track')).not.toBeNull()
    expect(q('.g-sring-val')).toBeNull()
    expect(view.host.querySelectorAll('.g-skel')).toHaveLength(2)
    expect(ring.textContent).toBe('')
  })
})
