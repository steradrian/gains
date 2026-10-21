// @vitest-environment happy-dom
// VolumeBars: a muscle a row with its value in words, a bar under it against the target band:
// amber below the band, white from it; the bars are drawing only.
import { describe, expect, it } from 'vitest'
import VolumeBars from './VolumeBars.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const ROWS = [
  { key: 'upper-back', name: 'Upper back', sets: 14, value: '14 sets' },
  { key: 'chest', name: 'Chest', sets: 10, value: '10 sets' },
  { key: 'calves', name: 'Calves', sets: 4, value: '4 sets' },
]
const tracks = () => [...view.host.querySelectorAll('.g-vbar-track')]

describe('VolumeBars', () => {
  it('lists each muscle with its value and a line under the bars', () => {
    view.render(<VolumeBars rows={ROWS} target={[10, 12]} note="The line is a common target of 10 to 12." />)
    expect([...view.host.querySelectorAll('.g-vbar-top')].map(e => e.textContent)).toEqual(['Upper back14 sets', 'Chest10 sets', 'Calves4 sets'])
    expect(tracks().every(t => t.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(view.host.querySelector('.g-vbars-note').textContent).toBe('The line is a common target of 10 to 12.')
  })

  it('scales to a third past the band, marks the band and colours what falls short', () => {
    view.render(<VolumeBars rows={ROWS} target={[10, 12]} />)
    expect(tracks()[1].style.getPropertyValue('--w')).toBe('62.5%')
    expect(tracks()[1].style.getPropertyValue('--lo')).toBe('62.5%')
    expect(tracks()[1].style.getPropertyValue('--hi')).toBe('75%')
    expect(tracks()[0].querySelector('.g-vbar-fill').className).not.toContain('low')
    expect(tracks()[1].querySelector('.g-vbar-fill').className).not.toContain('low')
    expect(tracks()[2].querySelector('.g-vbar-fill').className).toContain('low')
  })

  it('a value past the scale stretches it', () => {
    view.render(<VolumeBars rows={[{ key: 'quads', name: 'Quads', sets: 20, value: '20 sets' }]} target={[10, 12]} />)
    expect(tracks()[0].style.getPropertyValue('--w')).toBe('100%')
    expect(tracks()[0].style.getPropertyValue('--hi')).toBe('60%')
  })
})
