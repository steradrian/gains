// @vitest-environment happy-dom
// The Friends card on Today (T1.16): between the actions and Up next with its New tag, the line and
// the group line, a Cheer pill that turns into Cheered, the options button, a tap on the body that
// opens the group, nothing while the day loads, and Today unchanged without it.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'
import { both } from '../../dev/screens/states/today-fixture.js'
import TodayScreen from './TodayScreen.jsx'

const view = useView()
const friends = (over = {}) => ({
  avatars: [{ initial: 'Mara', tone: 'sky' }, { initial: 'Radu', tone: 'iris' }],
  line: 'Mara finished Legs · Radu set a new best',
  groupLine: 'Iron Sunday · 17 of 22 this week',
  cheered: false,
  labels: { cheer: 'Cheer', cheered: 'Cheered', menu: 'Friends card options' },
  onCheer: vi.fn(), onOpen: vi.fn(), onMenu: vi.fn(),
  ...over,
})
const show = props => act(async () => { view.root.render(<TodayScreen {...both} {...props} />) })
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)

describe('the Friends card', () => {
  it('sits between the actions and Up next, with a New tag, the line and the group line', async () => {
    await show({ friends: friends() })
    const section = view.host.querySelector('.today-friends')
    expect(section).not.toBeNull()
    expect(text()).toContain('Friends')
    expect(view.host.querySelector('.g-tag').textContent).toBe('New')
    expect(section.textContent).toContain('Mara finished Legs · Radu set a new best')
    expect(section.textContent).toContain('Iron Sunday · 17 of 22 this week')
    const upNext = [...view.host.querySelectorAll('.g-grow')].find(row => !section.contains(row))
    const lastAction = [...view.host.querySelectorAll('.g-gact')].at(-1)
    expect(lastAction.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(section.compareDocumentPosition(upNext) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Cheer cheers, the body opens the group and the options button opens the menu, each once', async () => {
    const props = friends()
    await show({ friends: props })
    click(button('Cheer'))
    expect(props.onCheer).toHaveBeenCalledTimes(1)
    click(button('Friends card options'))
    expect(props.onMenu).toHaveBeenCalledTimes(1)
    click(button('Mara finished Legs · Radu set a new best'))
    expect(props.onOpen).toHaveBeenCalledTimes(1)
    expect(props.onCheer).toHaveBeenCalledTimes(1)
  })

  it('after a cheer the pill says Cheered and is no button to press again', async () => {
    await show({ friends: friends({ cheered: true }) })
    expect(button('Cheer')).toBeUndefined()
    expect(view.host.querySelector('.today-friends').textContent).toContain('Cheered')
  })

  it('is no card at all without `friends`, and Today has the same parts in the same order', async () => {
    await show({ friends: null })
    expect(view.host.querySelector('.today-friends')).toBeNull()
    expect(text()).not.toContain('Friends')
    expect(text()).toContain('Up next')
  })

  it('draws nothing while the day is still loading (no flash)', async () => {
    await show({ friends: friends(), status: 'pending', rings: [] })
    expect(view.host.querySelector('.today-friends')).toBeNull()
  })
})
