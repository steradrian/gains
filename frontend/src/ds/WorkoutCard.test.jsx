// @vitest-environment happy-dom
// WorkoutCard: the header opens the workout, each exercise has its picture and its sets as done.
// Nothing here edits a set; a line with nowhere to go is only said.
import { describe, expect, it, vi } from 'vitest'
import WorkoutCard from './WorkoutCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const head = () => view.host.querySelector('.g-wcard-head')
const exercises = () => [...view.host.querySelectorAll('.g-wcard-ex')]

const EXERCISES = [
  { name: 'Bench press', sets: '4 × 8 · 80 kg', image: '/media/bench.jpg', newBest: true, href: '#/exercise/bench' },
  { name: 'Overhead press', sets: '3 × 10 · 40 kg', onClick: () => {} },
  { name: 'Dips', sets: 'BW × 12' },
]

describe('WorkoutCard', () => {
  it('shows the name, meta and badge, and opens the workout from the header', () => {
    const onClick = vi.fn()
    view.render(<WorkoutCard name="Push A" meta="Mon 19 Oct · 52 min" badge="2 new bests" onClick={onClick} />)
    expect(head().tagName).toBe('BUTTON')
    expect(head().textContent).toBe('Push AMon 19 Oct · 52 min2 new bests')
    expect(head().querySelector('.g-tag-glass')).not.toBeNull()
    click(head())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a link with an href', () => {
    view.render(<WorkoutCard name="Push A" href="#/workout/1" />)
    expect(head().tagName).toBe('A')
  })

  it('lists each exercise with its picture, or a dumbbell when it has none, and marks a new best', () => {
    view.render(<WorkoutCard name="Push A" href="#/w" exercises={EXERCISES} />)
    expect(exercises().map(e => e.textContent)).toEqual(['Bench press4 × 8 · 80 kgNew best', 'Overhead press3 × 10 · 40 kg', 'DipsBW × 12'])
    expect(exercises()[0].querySelector('img').getAttribute('src')).toBe('/media/bench.jpg')
    expect(exercises()[1].querySelector('.g-lead')).not.toBeNull()
    expect(exercises().map(e => e.tagName)).toEqual(['A', 'BUTTON', 'DIV'])
  })

  it('is only said, with no button or link, when it has nowhere to go', () => {
    view.render(<WorkoutCard name="Push A" exercises={[{ name: 'Dips', sets: 'BW × 12' }]} />)
    expect(view.host.querySelector('button, a')).toBeNull()
    expect(head().querySelector('svg')).toBeNull()
  })

  it('puts the muscles and summary beside the map, and has no map row with neither', () => {
    view.render(<WorkoutCard name="Push A" href="#/w" muscles="Chest, shoulders, triceps" summary="18 sets" />)
    expect(view.host.querySelector('.g-wcard-map').textContent).toBe('Chest, shoulders, triceps18 sets')
    view.render(<WorkoutCard name="Push A" href="#/w" />)
    expect(view.host.querySelector('.g-wcard-map')).toBeNull()
  })
})
