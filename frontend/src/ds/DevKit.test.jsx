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
    expect(view.host.querySelectorAll('.g-shdr')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-gacts')).toHaveLength(4)
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

  it('renders an entry for the Train kit and the rail turns its week', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StageDayRail', 'RingCarousel (Train)', 'StageTrainCard', 'ExerciseThumbRow', 'StageEmpty', 'RoutineTiles', 'MusclesCard']))
    expect(view.host.querySelectorAll('.g-rail')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-tcard')).toHaveLength(6)
    expect(view.host.querySelectorAll('.g-sempty')).toHaveLength(4)
    const title = () => view.host.querySelector('.g-rail-title').textContent
    expect(title()).toBe('This week')
    act(() => { view.host.querySelector('.g-rail-btn[aria-label="Next week"]').click() })
    expect(title()).toBe('Next week')
  })

  it('renders the shared pages entries', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining([
      'Shared: pages', 'StageNavBar', 'StageSection variants', 'NotificationRow', 'StageEmpty on the notifications page', 'Permission banner', 'StageNote',
    ]))
    expect(view.host.querySelector('.g-sempty-btn').textContent).toBe('Set a reminder')
    expect(view.host.querySelectorAll('.g-sbanner .g-ibanner-btn')).toHaveLength(2)
    expect(view.host.querySelector('.g-snote').textContent).toContain('Kept for 30 days')
    expect(view.host.querySelectorAll('.g-snav')).toHaveLength(7)
    expect(view.host.querySelectorAll('.g-ssec-line')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-ngroup')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-nrow')).toHaveLength(9)
    expect(view.host.querySelectorAll('.g-nrow-new')).toHaveLength(3)
  })
})
