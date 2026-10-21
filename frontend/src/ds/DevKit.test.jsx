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
    // Train's two, and the Day page's (Shared: day)
    expect(view.host.querySelectorAll('.g-rail')).toHaveLength(3)
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
    // The other pages' entries sit above the Shared ones (the last in the kit), so the counts read
    // from the "Shared: pages" heading down.
    const sections = [...view.host.querySelectorAll('.g-kit-sec')]
    const shared = sections.slice(sections.findIndex(s => s.querySelector('h2').textContent === 'Shared: pages'))
    const all = selector => shared.flatMap(s => [...s.querySelectorAll(selector)])
    expect(all('.g-sempty-btn').map(b => b.textContent)).toEqual(['Set a reminder'])
    // The app has no Coach notifications (lib/notifications/feed.js), so the kit never shows the line.
    expect(all('.g-sempty')[0].textContent).not.toMatch(/Coach/)
    expect(all('.g-sbanner .g-ibanner-btn')).toHaveLength(2)
    expect(all('.g-snote')[0].textContent).toContain('Kept for 30 days')
    expect(all('.g-snav')).toHaveLength(7)
    expect(all('.g-ssec-line')).toHaveLength(2)
    expect(all('.g-ngroup')).toHaveLength(3)
    expect(all('.g-nrow')).toHaveLength(9)
    expect(all('.g-nrow-new')).toHaveLength(3)
  })

  // Shared: week
  it('renders the Week page entries', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['Shared: week', 'StageWeekCells', 'WeekStrip4', 'StatTiles']))
    expect(view.host.querySelectorAll('.g-swc')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-swc-cell')).toHaveLength(28)
    expect(view.host.querySelectorAll('.g-w4')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-w4-cell.on')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-stats')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-stats-stage .g-stat')).toHaveLength(4)
  })

  // Shared: day
  it('renders the Day page entries', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StageDayRail on a Day page', 'DayStatusCard', 'DayFoodCard', 'RadioRow']))
    expect(view.host.querySelectorAll('.g-dstat')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-dfood')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-radio')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-rd[disabled]')).toHaveLength(2)
  })
})
