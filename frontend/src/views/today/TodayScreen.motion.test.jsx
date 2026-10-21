// @vitest-environment happy-dom
/* Not now (or Weigh in) on Today's welcome back used to take the card away on the tap, and the
 * rings jumped up into its place. The card now stays while it fades and its row closes, then goes. */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import TodayScreen from './TodayScreen.jsx'
import { PRESETS, setMotionDriver } from '../../lib/motion.js'
import { fakeMotionDriver } from '../../lib/motion.test-util.js'
import { both } from '../../dev/screens/states/today-fixture.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const AWAY = { title: 'Welcome back', body: '8 days since your last log.', actions: [{ label: 'Not now', onClick: () => {} }] }

let host, root, driver
const render = props => act(async () => { root.render(<TodayScreen {...both} {...props} />) })
const card = () => host.querySelector('.g-away')

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  driver = fakeMotionDriver()
  setMotionDriver(driver)
  root = createRoot(host)
})
afterEach(async () => {
  setMotionDriver(null)
  await act(async () => { root.unmount() })
  host.remove()
  delete document.documentElement.dataset.motion
})

describe('Today\'s welcome back, put away', () => {
  it('stays, out of reach, while it fades and its row closes, then unmounts', async () => {
    await render({ away: AWAY })
    const el = card()
    expect(el).not.toBeNull()

    await render({ away: null })
    expect(card()).toBe(el)
    expect(el.textContent).toContain('Welcome back')
    expect(el.closest('[inert]')).not.toBeNull()
    expect(driver.on(el).map(a => a.keyframes)).toEqual([PRESETS.foldAway.exit.keyframes])
    const rowClose = driver.on(el.parentElement)
    expect(rowClose).toHaveLength(1)
    expect(rowClose[0].keyframes.at(-1)).toEqual({ height: '0px' })

    await act(async () => { for (const a of driver.running()) a.finish() })
    expect(card()).toBeNull()
  })

  it('goes at once when the app keeps still', async () => {
    document.documentElement.dataset.motion = 'reduce'
    await render({ away: AWAY })
    await render({ away: null })
    expect(card()).toBeNull()
  })
})
