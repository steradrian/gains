// @vitest-environment happy-dom
// The Coach's "coming soon" page (lib/coach-availability.js): a pushed page with the scene and a
// labelled preview that cannot be focused or pressed, and the Train card that leads to it.
import { describe, expect, it, vi } from 'vitest'
import { useView } from '../ds/render.test-util.js'
import { moreOf } from './train/use-train.js'
import CoachSoon from './CoachSoon.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const view = useView()
const S = { workouts: [], equipProfiles: [], checkIn: true }

describe('Coach coming soon', () => {
  it('is a pushed page with the warm headline, the line and the scene', () => {
    view.render(<CoachSoon />)
    expect(view.host.querySelector('.g-screen-pushed')).not.toBeNull()
    expect(view.host.querySelector('.g-spage-title').textContent).toBe('Your coach is still warming up')
    expect(view.host.querySelector('.g-spage-sub').textContent).toContain('Nothing moves until you approve it.')
    expect(view.host.querySelector('.g-ill svg')).not.toBeNull()
  })

  it('labels the preview and makes all three cards inert', () => {
    view.render(<CoachSoon />)
    expect(view.host.querySelector('.g-ssec-act').textContent).toBe('Preview')
    const cards = view.host.querySelector('.tcs-cards')
    expect(cards.hasAttribute('inert')).toBe(true)
    expect(cards.textContent).toContain('Three of four sessions done this week.')
    expect(cards.textContent).toContain('Move Legs to Thursday')
    expect(cards.textContent).toContain('You’ve missed Mondays three weeks running')
    expect(cards.textContent).toContain('How the week felt')
  })

  it('has no control outside the inert preview but the nav bar', () => {
    view.render(<CoachSoon />)
    const live = [...view.host.querySelectorAll('button, a[href], input, [tabindex]')].filter(el => !el.closest('[inert]') && !el.closest('.g-snav'))
    expect(live).toEqual([])
  })
})

describe('the Train card', () => {
  it('says Coming soon and leads to the page; the Gym card stays', () => {
    const more = moreOf(S, { coach: false, soon: true })
    expect(more.find(r => r.key === 'coach')).toMatchObject({ title: 'Coach', sub: 'Coming soon', to: '/train/coach' })
    expect(more.find(r => r.key === 'checkin')).toBeTruthy()
  })

  it('is unchanged with the switch off: no card without Coach, the working card with it', () => {
    expect(moreOf(S, { coach: false }).find(r => r.key === 'coach')).toBeUndefined()
    expect(moreOf(S, { coach: true, suggestions: 2 }).find(r => r.key === 'coach').sub).toBe('2 suggestions this week')
    expect(moreOf(S, { coach: true }).find(r => r.key === 'checkin')).toBeUndefined()
  })
})
