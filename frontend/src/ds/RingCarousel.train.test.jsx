// @vitest-environment happy-dom
// RingCarousel with Train's three rings (boards T2.0, T2.12): the labels come from the slides as
// the data hook writes them, and the big number may be a number or text.
import { describe, expect, it } from 'vitest'
import RingCarousel from './RingCarousel.jsx'
import { useView } from './render.test-util.js'

const view = useView()

const SLIDES = [
  { name: 'Workouts', top: 'This week', big: 2, unit: 'of 4 workouts', value: 2, max: 4, pill: 'Push A today', icon: 'dumbbell' },
  { name: 'Volume', top: 'Volume this week', big: '14.3', unit: 't of 18.9 t last week', value: 14.3, max: 18.9, pill: 'Bench press best: 82.5 kg', icon: 'chartLine' },
  { name: 'Streak', top: 'On plan', big: '6', unit: 'weeks in a row', value: 6, max: 8, pill: 'Best: 8 weeks', icon: 'flame' },
]

describe('RingCarousel with the Train rings', () => {
  it('names each ring from the slide and says the board\'s numbers inside it', () => {
    view.render(<RingCarousel slides={SLIDES} label="Training this week" />)
    const slides = [...view.host.querySelectorAll('.g-rc-slide')]
    expect(slides.map(s => s.getAttribute('aria-label'))).toEqual([
      'Workouts: 2 of 4 workouts. Open details',
      'Volume: 14.3 t of 18.9 t last week. Open details',
      'Streak: 6 weeks in a row. Open details',
    ])
    expect(slides.map(s => s.querySelector('.g-sring').getAttribute('aria-label'))).toEqual([
      'This week 2 of 4 workouts',
      'Volume this week 14.3 t of 18.9 t last week',
      'On plan 6 weeks in a row',
    ])
    expect(view.host.querySelector('[role="group"]').getAttribute('aria-label')).toBe('Training this week')
  })

  it('draws the pills and three dots, and the big number as given', () => {
    view.render(<RingCarousel slides={SLIDES} />)
    expect([...view.host.querySelectorAll('.g-rc-pill')].map(p => p.textContent)).toEqual(['Push A today', 'Bench press best: 82.5 kg', 'Best: 8 weeks'])
    expect(view.host.querySelectorAll('.g-rc-dot')).toHaveLength(3)
    expect([...view.host.querySelectorAll('.g-sring b')].map(b => b.textContent)).toEqual(['2', '14.3', '6'])
  })

  it('a ring with no pill (nothing to say yet) draws none', () => {
    view.render(<RingCarousel slides={[{ ...SLIDES[2], pill: null, big: 0, value: 0 }]} />)
    expect(view.host.querySelector('.g-rc-pill')).toBeNull()
    expect(view.host.querySelector('.g-sring b').textContent).toBe('0')
  })
})
