// @vitest-environment happy-dom
// Ready-made plans (T10.0, /train/plans): the four starters with their blurbs and day counts (no
// minutes: nothing estimates them), a tap opens the plan's preview, Import a plan file hands the
// chosen file to the existing import, and Ask Coach shows only when Coach is available.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../../ds/render.test-util.js'
import { importPlanFile } from '../../../sheets.jsx'
import PlansScreen from './PlansScreen.jsx'

const nav = vi.hoisted(() => vi.fn())
const coach = vi.hoisted(() => ({ on: false }))
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../../../lib/coach.js', () => ({ coachAvailable: () => coach.on }))
vi.mock('../../../sheets.jsx', () => ({ importPlanFile: vi.fn() }))

const view = useView()
beforeEach(() => {
  vi.clearAllMocks()
  coach.on = false
})

const rows = () => [...view.host.querySelectorAll('.g-glist-row')]
const row = title => rows().find(r => r.querySelector('b').textContent === title)

describe('Ready-made plans', () => {
  it('is a pushed page titled Ready-made plans, with its line', () => {
    view.render(<PlansScreen />)
    expect(view.host.querySelector('.g-screen-pushed')).not.toBeNull()
    expect(view.host.querySelector('.g-spage-title').textContent).toBe('Ready-made plans')
    expect(view.host.querySelector('.g-spage-sub').textContent).toBe('Starters you can edit afterwards')
  })

  it('lists the four plans in order with their blurb and day count, and no minutes', () => {
    view.render(<PlansScreen />)
    const plans = rows().slice(0, 4)
    expect(plans.map(r => r.querySelector('b').textContent)).toEqual(['Push / Pull / Legs', 'Upper / Lower', 'Full Body', '5×5'])
    expect(row('Upper / Lower').textContent).toContain('Upper body twice, lower body twice.')
    expect(row('Upper / Lower').textContent).toContain('4 days per week')
    expect(row('Full Body').textContent).toContain('3 days per week')
    for (const r of plans) expect(r.textContent).not.toMatch(/\bmin\b/)
  })

  it('opens the plan\'s preview on a tap', () => {
    view.render(<PlansScreen />)
    click(row('Upper / Lower'))
    expect(nav).toHaveBeenCalledWith('/train/plans/upper-lower')
    click(row('5×5'))
    expect(nav).toHaveBeenLastCalledWith('/train/plans/5x5')
  })

  it('Import a plan file opens the file chooser, and the chosen file goes to the import', () => {
    view.render(<PlansScreen />)
    const input = view.host.querySelector('input[type="file"]')
    expect(input.hidden).toBe(true)
    input.click = vi.fn()
    click(row('Import a plan file'))
    expect(input.click).toHaveBeenCalledTimes(1)
    const file = new File(['{}'], 'plan.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(importPlanFile).toHaveBeenCalledWith(file)
  })

  it('shows Ask Coach only with Coach on, and it goes to the Coach', () => {
    view.render(<PlansScreen />)
    expect(row('Ask Coach to design one')).toBeUndefined()
    coach.on = true
    view.render(<PlansScreen />)
    click(row('Ask Coach to design one'))
    expect(nav).toHaveBeenCalledWith('/train/coach')
  })
})
