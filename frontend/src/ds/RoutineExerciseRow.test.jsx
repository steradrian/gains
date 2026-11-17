// @vitest-environment happy-dom
// RoutineExerciseRow: the editor's exercise row, one button to its settings, and in reorder mode
// the move buttons and the grip, every word the caller's.
import { describe, expect, it, vi } from 'vitest'
import RoutineExerciseRow from './RoutineExerciseRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const open = () => view.host.querySelector('.g-rx-open')
const buttons = () => [...view.host.querySelectorAll('.g-rx-btn')]

describe('RoutineExerciseRow', () => {
  it('is one button with the picture, the name, the sub line and the progression line, ending in a chevron', () => {
    const onOpen = vi.fn()
    view.render(<RoutineExerciseRow image="/ex/bench.png" title="Bench press" sub="4 × 6–8 · 80 kg" line="Up 2.5 kg when every set hits 8" onOpen={onOpen} />)
    expect(open().tagName).toBe('BUTTON')
    expect(open().hasAttribute('data-row-open')).toBe(true)
    expect(open().querySelector('img').getAttribute('src')).toBe('/ex/bench.png')
    expect(open().querySelector('.g-xrow-b').textContent).toBe('Bench press4 × 6–8 · 80 kgUp 2.5 kg when every set hits 8')
    expect(open().querySelector('.g-xrow-chev')).not.toBeNull()
    click(open())
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('draws the tile without a picture and leaves out the lines it was not given', () => {
    view.render(<RoutineExerciseRow title="My move" onOpen={() => {}} />)
    expect(open().querySelector('img')).toBeNull()
    expect(open().querySelector('.g-xrow-ph')).not.toBeNull()
    expect(open().querySelector('.g-rx-prog')).toBeNull()
    expect(open().querySelector('.g-xrow-b').textContent).toBe('My move')
  })

  it('names the superset place and the equipment warning with the caller\'s words', () => {
    view.render(<RoutineExerciseRow title="Dip" badge={{ text: 'A2', label: 'Superset position A2' }} warning="Needs dip bars" onOpen={() => {}} />)
    expect(view.host.querySelector('.g-rx-pos').getAttribute('aria-label')).toBe('Superset position A2')
    expect(view.host.querySelector('.g-rx-warn').textContent).toBe('Needs dip bars')
  })

  it('in reorder mode shows the move buttons, named by the caller, and a grip hidden from a screen reader; no chevron', () => {
    const up = vi.fn(), down = vi.fn()
    view.render(<RoutineExerciseRow title="Dip" onOpen={() => {}}
      moveUp={{ label: 'Move Dip up', disabled: true, onClick: up }}
      moveDown={{ label: 'Move Dip down', title: 'Move out of the superset', onClick: down }}
      handle={{ title: 'Reorder exercises' }} />)
    expect(buttons().map(b => b.getAttribute('aria-label'))).toEqual(['Move Dip up', 'Move Dip down'])
    expect(buttons()[0].disabled).toBe(true)
    expect(buttons()[1].title).toBe('Move out of the superset')
    click(buttons()[1])
    expect(down).toHaveBeenCalledOnce()
    const grip = view.host.querySelector('[data-drag-handle]')
    expect(grip.getAttribute('aria-hidden')).toBe('true')
    expect(grip.tagName).toBe('SPAN')
    expect(open().querySelector('.g-xrow-chev')).toBeNull()
  })
})
