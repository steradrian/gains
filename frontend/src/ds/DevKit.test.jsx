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

  it('renders the Train charts kit, and a day opens from the heatmap and the month', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StatTiles', 'LineChart', 'BarChart', 'Heatmap', 'MonthGrid']))
    expect(view.host.querySelectorAll('.g-stats')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-lc')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-bars-card')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-heat')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-mg')).toHaveLength(2)
    act(() => { view.host.querySelector('.g-heat button.g-heat-c').click() })
    expect(view.host.textContent).toMatch(/Opened: 2026-w\d+-d\d/)
    act(() => { view.host.querySelector('.g-mg button.g-mg-cell').click() })
    expect(view.host.textContent).toContain('Opened: 2026-10-01')
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
    expect([...view.host.querySelectorAll('.g-sempty-btn')].at(-1).textContent).toBe('Set a reminder')
    expect(view.host.querySelectorAll('.g-sbanner .g-ibanner-btn')).toHaveLength(2)
    expect(view.host.querySelector('.g-snote').textContent).toContain('Kept for 30 days')
    expect([...view.host.querySelectorAll('.g-snav')].filter(n => !n.closest('.g-kit-page'))).toHaveLength(7)
    expect(view.host.querySelectorAll('.g-ssec-line')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-ngroup')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-nrow')).toHaveLength(9)
    expect(view.host.querySelectorAll('.g-nrow-new')).toHaveLength(3)
  })

  it('renders the Train pushed-page kit', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StagePage', 'GlassValueRow', 'StageSegmented', 'RadioRow', 'ChipGroup']))
    expect(view.host.querySelectorAll('.g-kit-page .g-screen-pushed')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-kit-page .g-spage-title')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-gvr')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-gvr-static')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-sseg[role="radiogroup"]')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-radio')).toHaveLength(6)
    expect(view.host.querySelectorAll('.g-cgroup')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-cgroup-stage')).toHaveLength(2)
  })

  it('renders the Train exercises kit: the search field and the filter chips', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StageSearchField', 'Chip']))
    expect(view.host.querySelectorAll('.g-ssf')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-ssf-close')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-fchip')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-fchip-caret')).toHaveLength(2)
  })
})
