// @vitest-environment happy-dom
// MemberRing: a segment per member in join order, filled by their own share, never ranked.
import { describe, expect, it } from 'vitest'
import MemberRing from './MemberRing.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const q = sel => [...view.host.querySelectorAll(sel)]
const dash = c => c.getAttribute('stroke-dasharray').split(' ').map(Number)

describe('MemberRing', () => {
  it('draws one track per member and a fill only for a member who has done something', () => {
    view.render(<MemberRing segments={[{ value: 2, of: 4, tone: 'mint' }, { value: 0, of: 4, tone: 'blue' }, { value: 4, of: 4, tone: 'purple' }]} />)
    expect(q('.g-mring-track')).toHaveLength(3)
    expect(q('.g-mring-val')).toHaveLength(2)
  })

  it('fills each segment by its own share of its own length', () => {
    view.render(<MemberRing segments={[{ value: 1, of: 4 }, { value: 4, of: 4 }]} />)
    const [track0, track1] = q('.g-mring-track').map(dash)
    const [val0, val1] = q('.g-mring-val').map(dash)
    expect(val0[0]).toBeCloseTo(track0[0] / 4, 1)
    expect(val1[0]).toBeCloseTo(track1[0], 1)
  })

  it('keeps the members in the order given: each starts after the one before', () => {
    view.render(<MemberRing segments={[{ value: 4, of: 4 }, { value: 0, of: 4 }, { value: 2, of: 4 }]} />)
    const offsets = q('.g-mring-track').map(c => Math.abs(Number(c.getAttribute('stroke-dashoffset'))))
    expect(offsets[0]).toBe(0)
    expect(offsets[1]).toBeGreaterThan(offsets[0])
    expect(offsets[2]).toBeGreaterThan(offsets[1])
  })

  it('a member with no plan is an empty segment of the same length, not a warning', () => {
    view.render(<MemberRing segments={[{ value: 0, of: 0, tone: 'mint' }, { value: 3, of: 3, tone: 'blue' }]} />)
    const [a, b] = q('.g-mring-track').map(dash)
    expect(a[0]).toBe(b[0])
    expect(q('.g-mring-val')).toHaveLength(1)
    expect(view.host.innerHTML).not.toMatch(/red|danger|warning/)
  })

  it('caps a share at the whole segment and ignores an unknown tone', () => {
    view.render(<MemberRing segments={[{ value: 9, of: 4, tone: 'red' }]} />)
    expect(dash(q('.g-mring-val')[0])[0]).toBeCloseTo(dash(q('.g-mring-track')[0])[0], 1)
    expect(q('g')[0].classList.contains('g-mtone-white')).toBe(true)
  })

  it('with one member it is a whole ring, with none only the track', () => {
    view.render(<MemberRing segments={[{ value: 1, of: 2 }]} />)
    const [track] = q('.g-mring-track')
    expect(dash(track)[0]).toBeGreaterThan(600)
    view.render(<MemberRing segments={[]} />)
    expect(q('.g-mring-track')).toHaveLength(1)
    expect(q('.g-mring-val')).toHaveLength(0)
  })

  it('reads as one image named by the caller, with the centre slot inside', () => {
    view.render(<MemberRing label="17 of 22 sessions this week" segments={[{ value: 1, of: 2 }]}><b>17</b></MemberRing>)
    const ring = q('.g-mring')[0]
    expect(ring.getAttribute('role')).toBe('img')
    expect(ring.getAttribute('aria-label')).toBe('17 of 22 sessions this week')
    expect(q('.g-mring-in b')[0].textContent).toBe('17')
  })
})
