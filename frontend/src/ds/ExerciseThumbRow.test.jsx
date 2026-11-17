// @vitest-environment happy-dom
// ExerciseThumbRow: the catalogue still on a white tile, a name, a line, a chevron when it opens.
import { describe, expect, it, vi } from 'vitest'
import ExerciseThumbRow from './ExerciseThumbRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.querySelector('.g-xrow')

describe('ExerciseThumbRow', () => {
  it('shows the picture at its size, the title and the line; a row with no tap is a div without a chevron', () => {
    view.render(<ExerciseThumbRow image="/ex/squat.png" size={52} title="Barbell full squat" sub="4 × 5 · 100 kg" />)
    expect(row().tagName).toBe('DIV')
    const img = row().querySelector('img')
    expect(img.getAttribute('src')).toBe('/ex/squat.png')
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('width')).toBe('52')
    expect(row().querySelector('.g-xrow-b').textContent).toBe('Barbell full squat4 × 5 · 100 kg')
    expect(row().querySelector('.g-xrow-chev')).toBeNull()
  })

  it('a dumbbell tile stands in without a picture', () => {
    view.render(<ExerciseThumbRow title="Plank" />)
    expect(row().querySelector('img')).toBeNull()
    expect(row().querySelector('.g-xrow-ph svg')).not.toBeNull()
  })

  it('opens with onClick or href and then ends in a chevron, unless trailing says otherwise', () => {
    const onClick = vi.fn()
    view.render(<ExerciseThumbRow title="Plank" onClick={onClick} />)
    expect(row().tagName).toBe('BUTTON')
    expect(row().querySelector('.g-xrow-chev')).not.toBeNull()
    click(row())
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<ExerciseThumbRow title="Plank" href="#/ex/1" trailing={<em>Swap</em>} />)
    expect(row().tagName).toBe('A')
    expect(row().querySelector('.g-xrow-chev')).toBeNull()
    expect(row().querySelector('em').textContent).toBe('Swap')
  })

  it('a button row can be a toggle: pressed says whether it is chosen', () => {
    view.render(<ExerciseThumbRow title="Plank" onClick={() => {}} pressed />)
    expect(row().getAttribute('aria-pressed')).toBe('true')
    view.render(<ExerciseThumbRow title="Plank" onClick={() => {}} pressed={false} />)
    expect(row().getAttribute('aria-pressed')).toBe('false')
    view.render(<ExerciseThumbRow title="Plank" onClick={() => {}} />)
    expect(row().hasAttribute('aria-pressed')).toBe(false)
  })

  it('tone, first and a small size choose the classes', () => {
    view.render(<ExerciseThumbRow title="Plank" tone="stage" first={false} size={40} />)
    expect([...row().classList]).toEqual(['g-xrow', 'g-xrow-stage', 'g-xrow-sm', 'g-xrow-line'])
    view.render(<ExerciseThumbRow title="Plank" />)
    expect([...row().classList]).toEqual(['g-xrow'])
  })
})
