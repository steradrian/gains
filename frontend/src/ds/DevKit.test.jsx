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
    expect(view.host.querySelectorAll('.g-kit-frame .g-bs')).toHaveLength(5)
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
    // Three here, and the Week page's two (Shared: week)
    expect(view.host.querySelectorAll('.g-stats')).toHaveLength(5)
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

  it('renders the Train pushed-page kit', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StagePage', 'GlassValueRow', 'StageSegmented', 'RadioRow', 'ChipGroup']))
    expect(view.host.querySelectorAll('.g-kit-page .g-screen-pushed')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-kit-page .g-spage-title')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-gvr')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-gvr-static')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-sseg[role="radiogroup"]')).toHaveLength(3)
    // The Day page's RadioRows (Shared: day) come after the Shared: pages heading.
    const sections = [...view.host.querySelectorAll('.g-kit-sec')]
    const train = sections.slice(0, sections.findIndex(s => s.querySelector('h2').textContent === 'Shared: pages'))
    expect(train.flatMap(s => [...s.querySelectorAll('.g-radio')])).toHaveLength(6)
    expect(view.host.querySelectorAll('.g-cgroup')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-cgroup-stage')).toHaveLength(2)
  })

  it('renders the routines kit: the sets table, as a summary row and as a row a set', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toContain('SetTable')
    const tables = view.host.querySelectorAll('.g-sett')
    expect(tables).toHaveLength(2)
    expect(tables[0].querySelectorAll('[role="row"]')).toHaveLength(2)
    expect(tables[1].querySelectorAll('[role="row"]')).toHaveLength(4)
    expect(tables[1].querySelectorAll('.g-sett-rmbtn')).toHaveLength(3)
  })

  it('renders the routine editor kit: the exercise rows, one in reorder mode, and a superset', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['RoutineExerciseRow', 'SupersetGroup']))
    expect(view.host.querySelectorAll('.g-rx')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-rx-btn')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-ssg .g-rx')).toHaveLength(2)
    expect(view.host.querySelector('button.g-ssg-h')).not.toBeNull()
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

  it('renders the Train coach kit, the switch turns and the stepper counts', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StageSwitch', 'BigStepper']))
    const switches = view.host.querySelectorAll('.g-sswitch')
    expect(switches).toHaveLength(2)
    expect(switches[0].getAttribute('aria-checked')).toBe('true')
    act(() => { switches[0].click() })
    expect(view.host.querySelectorAll('.g-sswitch')[0].getAttribute('aria-checked')).toBe('false')
    expect(view.host.querySelectorAll('.g-bstep')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-bstep-stage')).toHaveLength(1)
    act(() => { view.host.querySelector('.g-bstep button[aria-label="More 25 kg plates"]').click() })
    expect(view.host.querySelector('.g-bstep-v b').textContent).toBe('3')
  })

  it('renders the chat bubbles, the Coach’s on glass and yours in white', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toContain('ChatBubble')
    expect(view.host.querySelectorAll('.g-bubble-them')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-bubble-me')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-bubble-error')).toHaveLength(1)
  })

  it('renders the Train plan kit, and a tapped day says which', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['PlanWeekGrid', 'LoopStrip', 'VolumeBars']))
    expect(view.host.querySelectorAll('.g-pcell')).toHaveLength(14)
    expect(view.host.querySelectorAll('.g-loop')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-vbar')).toHaveLength(8)
    act(() => { view.host.querySelector('.g-pcell-missed').click() })
    expect(view.host.textContent).toContain('Tapped: 2026-10-16')
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
    // The Train charts kit has its own StatTiles above, so read from the Week heading down.
    const sections = [...view.host.querySelectorAll('.g-kit-sec')]
    const week = sections.slice(sections.findIndex(s => s.querySelector('h2').textContent === 'Shared: week'))
    expect(week.flatMap(s => [...s.querySelectorAll('.g-stats')])).toHaveLength(2)
    expect(week.flatMap(s => [...s.querySelectorAll('.g-stats-stage .g-stat')])).toHaveLength(4)
  })

  // Shared: day
  it('renders the Day page entries', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    expect(titles).toEqual(expect.arrayContaining(['StageDayRail on a Day page', 'DayStatusCard', 'DayFoodCard', 'RadioRow']))
    expect(view.host.querySelectorAll('.g-dstat')).toHaveLength(4)
    expect(view.host.querySelectorAll('.g-dfood')).toHaveLength(2)
    // The Day page's three, below its first entry (the Train pushed-page kit has its own).
    const sections = [...view.host.querySelectorAll('.g-kit-sec')]
    const day = sections.slice(sections.findIndex(s => s.querySelector('h2').textContent === 'StageDayRail on a Day page'))
    expect(day.flatMap(s => [...s.querySelectorAll('.g-radio')])).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-rd[disabled]')).toHaveLength(2)
  })
})
