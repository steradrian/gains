// @vitest-environment happy-dom
// The catalogue (#/dev/kit) is the review surface for the design system: every component's entry
// has to render with its sample data.
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { useUI } from '../store/useUI.js'
import DevKit from './DevKit.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('DevKit', () => {
  it('renders the hero kit entries', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    for (const name of ['StageHeader', 'StageRing', 'RingCarousel', 'GlassActions']) expect(titles).toContain(name)
    // Three in the hero kit's entry, two more as the search field in Shared: search.
    expect(view.host.querySelectorAll('.g-shdr')).toHaveLength(5)
    expect(view.host.querySelectorAll('.g-gacts')).toHaveLength(4)
  })

  it('renders the Shared: search kit', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining([
      'Shared: search · StageHeader searching', 'GoToChips', 'SearchSection and SearchRow', 'ResultChips', 'BestMatch', 'SearchFeatureCard', 'Nothing matches: the ways on',
    ]))
    expect(view.host.querySelectorAll('.g-spill-field input')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-goto-chip')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-rchip')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-best')).toHaveLength(2)
    expect(view.host.querySelector('.g-sfeat')).not.toBeNull()
    // Recent's × takes its row away, in memory.
    const before = view.host.querySelectorAll('.g-srow-xbtn').length
    act(() => { view.host.querySelector('.g-srow-xbtn').click() })
    expect(view.host.querySelectorAll('.g-srow-xbtn')).toHaveLength(before - 1)
  })

  it('renders an entry for the Today content kit', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining([
      'StageSection', 'GlassRow', 'MealTiles', 'WaterGlasses', 'FirstSteps', 'AwayCard', 'SavedIndicator', 'WorkoutCard', 'BodyMap and Tag',
    ]))
    expect(view.host.querySelectorAll('.g-tile')).toHaveLength(6)
    expect(view.host.querySelector('.g-wcard-ex')).not.toBeNull()
  })

  it('renders the drawer and toast kit, drawn still and opened for real', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['BottomSheet', 'SegmentedControl', 'ActionGrid', 'MenuList', 'UndoToast']))
    expect(view.host.querySelectorAll('.g-kit-frame .g-bs')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-kit-frame .g-bs .g-agrid-lg + .g-menulist')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-kit-frame .g-bs-pin .g-seg')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-kit-col .g-utoast')).toHaveLength(3)
    act(() => { [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Open auto').click() })
    expect(document.querySelector('#modal-root .g-bs')).not.toBeNull()
    act(() => { useUI.getState().closeAll() })
  })

  it('renders the GlassTabBar entry', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toContain('GlassTabBar')
    expect(view.host.querySelectorAll('.g-gtabbar')).toHaveLength(4)
  })

  it('renders the StageWeekMarks entry', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toContain('StageWeekMarks')
    expect(view.host.querySelectorAll('.g-wk')).toHaveLength(2)
  })
})
