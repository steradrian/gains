// @vitest-environment happy-dom
// A ready-made plan's preview (T10.1, /train/plans/:id) and Load (T10.2). It is where a starter plan
// can quietly do the wrong thing: fit to the wrong profile, load the wrong week, or leave an Undo
// that does not put the old week back (lib/starter-load.js has the edge cases of the load itself).
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../../ds/render.test-util.js'
import { fmtDate, isoOf } from '../../../lib/format.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import PlanPreview from './PlanPreview.jsx'

const nav = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn())
const params = vi.hoisted(() => ({ id: 'upper-lower' }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => nav,
  useParams: () => params,
  Navigate: ({ to, replace }) => { redirect(to, replace); return null },
}))

const view = useView()
const S = () => useStore.getState().S
const mine = { id: 'mine', name: 'My routine', emoji: 'star', ex: [] }
const home = { id: 'home', name: 'Home', equipment: ['dumbbell'] }
const gym = { id: 'gym', name: 'City Gym', equipment: ['barbell', 'dumbbell', 'cable'] }
const nameOn = day => S().routines.find(r => r.id === [].concat(S().week[day] ?? [])[0])?.name
const exIds = () => S().routines.slice(1).flatMap(r => r.ex.map(e => e.id))

const setS = (over = {}) => useStore.setState(s => ({
  S: {
    ...s.S, routines: [structuredClone(mine)], week: {}, dayPlan: {}, workouts: [], active: null, queue: null, rotation: null,
    scheduleMode: null, weekStart: undefined, equipProfiles: [], activeEquipId: null, equipFilterOn: false, ...over,
  },
}))
const cells = () => [...view.host.querySelectorAll('.tcp-cell')]
const chips = () => [...view.host.querySelectorAll('.g-cchip')]
const chip = label => chips().find(c => c.textContent === label)
const segment = label => [...view.host.querySelectorAll('.g-sseg [role="radio"]')].find(b => b.textContent === label)
const loadButton = () => [...view.host.querySelectorAll('button')].find(b => b.textContent.startsWith('Load '))

beforeEach(() => {
  vi.clearAllMocks()
  params.id = 'upper-lower'
  useUI.setState({ toastMsg: '', toastAction: null, sheets: [] })
  setS()
})

describe('the preview', () => {
  it('names the plan and says what it is, with its days and no minutes', () => {
    view.render(<PlanPreview />)
    expect(view.host.querySelector('.g-spage-title').textContent).toBe('Upper / Lower')
    expect(view.host.querySelector('.g-spage-sub').textContent).toBe('Upper body twice, lower body twice. · 4 days per week')
    expect(view.host.textContent).not.toMatch(/\bmin\b/)
  })

  it('draws the week in seven cells, the plan\'s days named and the rest Rest', () => {
    view.render(<PlanPreview />)
    expect(cells()).toHaveLength(7)
    expect(cells().map(c => c.getAttribute('aria-label').split(': ')[1])).toEqual(['Upper A', 'Lower A', 'Rest', 'Upper B', 'Lower B', 'Rest', 'Rest'])
    expect(cells()[0].getAttribute('aria-label')).toMatch(/^Monday: /)
    expect(cells()[2].classList.contains('tcp-cell-rest')).toBe(true)
  })

  it('follows the week the profile starts on', () => {
    setS({ weekStart: 0 })
    view.render(<PlanPreview />)
    expect(cells()[0].getAttribute('aria-label')).toMatch(/^Sunday: Rest$/)
    expect(cells()[1].getAttribute('aria-label')).toMatch(/^Monday: Upper A$/)
  })

  it('counts and lists the routines with the days they fall on and their exercises', () => {
    view.render(<PlanPreview />)
    expect(view.host.textContent).toContain('4 routines')
    const rows = [...view.host.querySelectorAll('.g-xrow')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(rows[0].querySelector('.g-xrow-b span').textContent).toMatch(/^Mon · \d+ exercises$/)
    expect(rows.every(r => r.tagName === 'DIV')).toBe(true)   // said, not tappable
  })

  it('says what loading does to the week: yours come off the Plan and stay in Routines', () => {
    setS({ week: { 0: ['mine'], 6: ['mine'] } })
    view.render(<PlanPreview />)
    expect(view.host.textContent).toContain('Replaces your current week')
    expect(view.host.textContent).toContain('Your routines stay. Off the Plan, still in Routines: My routine.')
  })

  it('says only the days change when nothing is on the Plan', () => {
    view.render(<PlanPreview />)
    expect(view.host.textContent).toContain('Your routines stay. Only the days change.')
  })

  it('takes the id from the route, or from a prop', () => {
    params.id = '5x5'
    view.render(<PlanPreview />)
    expect(view.host.querySelector('.g-spage-title').textContent).toBe('5×5')
    view.render(<PlanPreview id="full-body" />)
    expect(view.host.querySelector('.g-spage-title').textContent).toBe('Full Body')
  })

  it('sends an id with no plan back to Ready-made plans, replacing the entry', () => {
    params.id = 'nope'
    view.render(<PlanPreview />)
    expect(redirect).toHaveBeenCalledWith('/train/plans', true)
    expect(view.host.querySelector('.g-spage-title')).toBeNull()
  })
})

describe('fitting to equipment', () => {
  it('with no profile Fit is off and out of reach, and the line says why and goes to Gym setup', () => {
    view.render(<PlanPreview />)
    const wrap = view.host.querySelector('.g-sseg').parentElement
    expect(wrap.hasAttribute('inert')).toBe(true)
    expect(segment('As written').getAttribute('aria-checked')).toBe('true')
    const line = [...view.host.querySelectorAll('.tcp-link')].find(b => b.textContent === 'Add an equipment profile to fit a plan to what you own.')
    expect(line).toBeTruthy()
    click(line)
    expect(nav).toHaveBeenCalledWith('/me/equipment')
  })

  it('with a profile the control is live and the plan starts as written, without the filter on', () => {
    setS({ equipProfiles: [home], activeEquipId: 'home', equipFilterOn: false })
    view.render(<PlanPreview id="ppl" />)
    expect(view.host.querySelector('.g-sseg').parentElement.hasAttribute('inert')).toBe(false)
    expect(segment('As written').getAttribute('aria-checked')).toBe('true')
    expect(view.host.textContent).not.toContain('Fitted to')
    expect(chips()).toHaveLength(0)
  })

  it('starts fitted to the profile the library is filtered by, and says what it changed', () => {
    setS({ equipProfiles: [home], activeEquipId: 'home', equipFilterOn: true })
    view.render(<PlanPreview id="ppl" />)
    expect(segment('Fit to my equipment').getAttribute('aria-checked')).toBe('true')
    expect(view.host.textContent).toMatch(/Fitted to "Home": \d+ swapped, \d+ dropped\. The rest stays as written\./)
    expect(view.host.textContent).toMatch(/ (becomes|is left out)/)
    act(() => { segment('As written').click() })
    expect(view.host.textContent).not.toContain('Fitted to')
  })

  it('offers the profiles as chips when there is more than one, and the pick re-fits', () => {
    setS({ equipProfiles: [home, gym], activeEquipId: 'home', equipFilterOn: true })
    view.render(<PlanPreview id="ppl" />)
    expect(chips().map(c => c.textContent)).toEqual(['Home', 'City Gym'])
    expect(chip('Home').getAttribute('aria-pressed')).toBe('true')
    expect(view.host.textContent).toContain('Fitted to "Home"')
    click(chip('City Gym'))
    expect(chip('City Gym').getAttribute('aria-pressed')).toBe('true')
    expect(view.host.textContent).toContain('Fitted to "City Gym"')
  })

  it('hides the chips as written', () => {
    setS({ equipProfiles: [home, gym], activeEquipId: 'home', equipFilterOn: false })
    view.render(<PlanPreview id="ppl" />)
    expect(chips()).toHaveLength(0)
    act(() => { segment('Fit to my equipment').click() })
    expect(chips()).toHaveLength(2)
  })
})

describe('Load', () => {
  it('loads over the whole week at once, goes to the Plan replacing this page, and offers Undo in the toast', () => {
    setS({ week: { 0: ['mine'], 6: ['mine'] } })
    view.render(<PlanPreview />)
    click(loadButton())

    expect(useUI.getState().sheets).toHaveLength(0)    // no confirmation was raised
    expect([1, 2, 4, 5].map(nameOn)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(S().week[0]).toBeUndefined()                // every other weekday becomes rest
    expect(S().week[6]).toBeUndefined()
    expect(S().routines[0].name).toBe('My routine')    // and no routine is deleted
    expect(nav).toHaveBeenCalledWith('/train/schedule', { replace: true })
    expect(useUI.getState().toastAction?.label).toBe('Undo')
  })

  it('names the day the week starts in the toast', () => {
    view.render(<PlanPreview />)
    click(loadButton())
    const msg = useUI.getState().toastMsg
    expect(msg).toMatch(/^Loaded Upper \/ Lower\. Your week starts /)
    // The plan trains Mon, Tue, Thu and Fri: the first of those from today
    const first = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = new Date(); d.setDate(d.getDate() + i); return d }).find(d => [1, 2, 4, 5].includes(d.getDay()))
    expect(msg).toBe(`Loaded Upper / Lower. Your week starts ${fmtDate(isoOf(first), true)}`)
  })

  it('leaves out the start day in rotation mode, where the rotation keeps deciding the days', () => {
    setS({ scheduleMode: 'rotation' })
    view.render(<PlanPreview />)
    click(loadButton())
    expect(useUI.getState().toastMsg).toBe('Loaded Upper / Lower')
  })

  it('Undo in the toast puts the week back and takes away only the routines it added', () => {
    setS({ week: { 1: ['mine'], 2: ['mine'] } })
    view.render(<PlanPreview id="5x5" />)
    click(loadButton())
    expect(S().routines).toHaveLength(4)

    act(() => { useUI.getState().runToastAction() })
    expect(S().routines.map(r => r.id)).toEqual(['mine'])
    expect(S().week).toEqual({ 1: ['mine'], 2: ['mine'] })
  })

  it('loads as written unless a profile is chosen, and fitted when one is', () => {
    setS({ equipProfiles: [home], activeEquipId: 'home', equipFilterOn: false })
    view.render(<PlanPreview id="ppl" />)
    click(loadButton())
    expect(exIds()).toContain('0025')            // the barbell bench press, as written

    // Filtering on starts the page fitted: opened afresh, over what the first load left
    useStore.setState(s => ({ S: { ...s.S, equipFilterOn: true } }))
    view.render(null)
    view.render(<PlanPreview id="ppl" />)
    click(loadButton())
    const fitted = S().routines.filter(r => r.name === 'Push Day')
    expect(fitted).toHaveLength(2)               // beside the as-written one, not over it
    expect(fitted[1].ex.map(e => e.id)).not.toContain('0025')
  })

  it('the button names the plan', () => {
    view.render(<PlanPreview id="full-body" />)
    expect(loadButton().textContent).toBe('Load Full Body')
  })
})
