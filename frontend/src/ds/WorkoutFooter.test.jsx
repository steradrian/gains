// @vitest-environment happy-dom
// WorkoutFooter (boards W1.0, W1.3, W1.5, W1.24): ‹ prev · position · next ›, the rest ring and its
// row while resting, Ready and Go after. Every spoken and visible string is the caller's.
import { describe, expect, it, vi } from 'vitest'
import WorkoutFooter from './WorkoutFooter.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const nav = () => view.host.querySelector('nav')
const row = () => view.host.querySelector('.g-wf-restrow')
const rowButtons = () => [...view.host.querySelectorAll('.g-wf-rb')]
const centre = () => view.host.querySelector('.g-wf-c')
const label = el => el.getAttribute('aria-label')

const LABELS = {
  navLabel: 'Exercises', mapLabel: 'All exercises', prevLabel: 'Previous: Band pull-apart', nextLabel: 'Next: Dumbbell seated shoulder press',
  clockLabel: 'Rest, 1:42 left. Change', minusLabel: '15 seconds less', plusLabel: '15 seconds more', pauseLabel: 'Pause rest', resumeLabel: 'Resume rest',
  skipLabel: 'Skip rest', skipText: 'Skip', stepText: '15 s',
  goText: 'Go · set 2', goLabel: 'Start the next set', readyTitle: 'Ready', readyLabel: 'Rest is over',
}
const foot = (props = {}) => (
  <WorkoutFooter
    {...LABELS}
    prev={{ image: 'data:image/svg+xml,a', onClick: () => {} }} next={{ image: 'data:image/svg+xml,b', onClick: () => {} }}
    position="4 of 12" phase="Workout" onMap={() => {}} {...props}
  />
)
const rest = (props = {}) => ({ left: '1:42', label: 'Rest', progress: 0.25, ...props })

describe('WorkoutFooter', () => {
  describe('between sets', () => {
    it('is a nav named by the caller with the position and phase in the centre', () => {
      view.render(foot())
      expect(label(nav())).toBe('Exercises')
      expect(centre().querySelector('b').textContent).toBe('4 of 12')
      expect(centre().textContent).toBe('4 of 12Workout')
      expect(label(centre())).toBe('All exercises')
      expect(row()).toBeNull()
    })

    it('the bar is on the glass material', () => {
      view.render(foot())
      expect(nav().getAttribute('data-glass')).toBe('bar')
    })

    it('the centre opens the map, and the neighbours are named by the caller', () => {
      const onMap = vi.fn()
      const onPrev = vi.fn()
      const onNext = vi.fn()
      view.render(foot({ onMap, prev: { image: 'a', onClick: onPrev }, next: { image: 'b', onClick: onNext } }))
      const [prev, , next] = nav().children
      expect(label(prev)).toBe('Previous: Band pull-apart')
      expect(label(next)).toBe('Next: Dumbbell seated shoulder press')
      click(centre())
      click(prev)
      click(next)
      expect(onMap).toHaveBeenCalledTimes(1)
      expect(onPrev).toHaveBeenCalledTimes(1)
      expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('a neighbour or the centre with an href is a link', () => {
      view.render(foot({ mapHref: '#/map', prev: { image: 'a', href: '#/prev' } }))
      expect(centre().tagName).toBe('A')
      expect(nav().children[0].tagName).toBe('A')
    })

    it('puts a neighbour\'s picture beside its chevron, in the order the arrow points', () => {
      view.render(foot())
      const [prev, , next] = nav().children
      expect(prev.firstElementChild.classList.contains('g-wf-chev')).toBe(true)
      expect(prev.lastElementChild.classList.contains('g-wkimg')).toBe(true)
      expect(next.firstElementChild.classList.contains('g-wkimg')).toBe(true)
      expect(next.lastElementChild.classList.contains('g-wf-chev')).toBe(true)
    })

    it('leaves the side empty at the first and the last exercise', () => {
      view.render(foot({ prev: undefined }))
      expect(nav().children[0].classList.contains('g-wf-empty')).toBe(true)
      expect(nav().children[0].tagName).toBe('SPAN')
      expect(nav().children[2].tagName).toBe('BUTTON')
      view.render(foot({ next: undefined }))
      expect(nav().children[2].classList.contains('g-wf-empty')).toBe(true)
    })
  })

  describe('resting', () => {
    it('turns the centre into the ring with the time and the caller\'s name for it', () => {
      const onClock = vi.fn()
      view.render(foot({ rest: rest({ onClock }) }))
      expect(label(centre())).toBe('Rest, 1:42 left. Change')
      expect(centre().querySelector('b').textContent).toBe('1:42')
      expect(centre().textContent).toBe('1:42Rest')
      click(centre())
      expect(onClock).toHaveBeenCalledTimes(1)
    })

    it('runs the ring down with the share of the rest gone', () => {
      view.render(foot({ rest: rest({ progress: 0 }) }))
      const arc = () => view.host.querySelector('.g-wf-arc')
      const full = Number(arc().style.getPropertyValue('--c'))
      expect(full).toBeCloseTo(2 * Math.PI * 20, 5)
      expect(Number(arc().style.getPropertyValue('--o'))).toBe(0)
      view.render(foot({ rest: rest({ progress: 0.25 }) }))
      expect(Number(arc().style.getPropertyValue('--o'))).toBeCloseTo(full * 0.25, 5)
    })

    it('raises one row: less, more, pause, Skip, each named by the caller', () => {
      view.render(foot({ rest: rest() }))
      expect(rowButtons().map(label)).toEqual(['15 seconds less', '15 seconds more', 'Pause rest', 'Skip rest'])
      expect(rowButtons().map(b => b.textContent)).toEqual(['15 s', '15 s', '', 'Skip'])
    })

    it('every button calls its own handler', () => {
      const h = { onMinus: vi.fn(), onPlus: vi.fn(), onPause: vi.fn(), onSkip: vi.fn() }
      view.render(foot({ rest: rest(h) }))
      rowButtons().forEach(click)
      expect(h.onMinus).toHaveBeenCalledTimes(1)
      expect(h.onPlus).toHaveBeenCalledTimes(1)
      expect(h.onPause).toHaveBeenCalledTimes(1)
      expect(h.onSkip).toHaveBeenCalledTimes(1)
    })

    it('a paused rest names the button for resuming', () => {
      view.render(foot({ rest: rest({ paused: true }) }))
      expect(label(rowButtons()[2])).toBe('Resume rest')
    })

    it('Skip is a link with skipHref', () => {
      view.render(foot({ rest: rest({ skipHref: '#/skip' }) }))
      expect(rowButtons()[3].tagName).toBe('A')
    })

    it('the row sits before the bar so it rises above it', () => {
      view.render(foot({ rest: rest() }))
      expect(row().nextElementSibling).toBe(nav())
    })
  })

  describe('after the rest', () => {
    it('says Ready in the centre, with nothing to press there', () => {
      view.render(foot({ ready: true }))
      expect(centre().tagName).toBe('SPAN')
      expect(centre().textContent).toBe('ReadyRest is over')
    })

    it('shows +15 s and the white Go with the caller\'s words, and Go calls onGo', () => {
      const onPlus = vi.fn()
      const onGo = vi.fn()
      view.render(foot({ ready: true, rest: { onPlus }, onGo }))
      const [plus, go] = rowButtons()
      expect(label(plus)).toBe('15 seconds more')
      expect(plus.textContent).toBe('15 s')
      expect(go.textContent).toBe('Go · set 2')
      expect(label(go)).toBe('Start the next set')
      click(plus)
      click(go)
      expect(onPlus).toHaveBeenCalledTimes(1)
      expect(onGo).toHaveBeenCalledTimes(1)
    })

    it('draws only Go when there is no +15 s to give, and wins over a rest still passed in', () => {
      view.render(foot({ ready: true, rest: rest() }))
      expect(rowButtons()).toHaveLength(1)
      expect(rowButtons()[0].classList.contains('g-wf-go')).toBe(true)
      expect(centre().textContent).toBe('ReadyRest is over')
    })
  })
})
