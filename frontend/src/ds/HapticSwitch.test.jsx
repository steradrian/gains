// @vitest-environment happy-dom
// HapticSwitch: the invisible native switch that gives iOS its tick, and what the controls that carry
// it must keep doing (their own click, their keyboard activation, disabled), plus Android's vibrate.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { Check, Switch, Button as LegacyButton } from '../components/ui.jsx'
import { HAPTIC_PATTERNS, haptic, hapticsSupported, setHapticsEnabled } from '../lib/use-haptic.js'
import Button from './Button.jsx'
import HapticSwitch, { isHapticSwitchTarget } from './HapticSwitch.jsx'
import { click, useView } from './render.test-util.js'

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

const view = useView()
const pretend = ua => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
const overlay = () => view.host.querySelector('input[data-slot="haptic-switch"]')

beforeEach(() => {
  setHapticsEnabled(true)
})
afterEach(() => {
  delete navigator.userAgent
  delete navigator.vibrate
  vi.restoreAllMocks()
})

describe('HapticSwitch', () => {
  it('renders nothing off iOS', () => {
    view.render(<HapticSwitch />)
    expect(overlay()).toBeNull()
  })

  it('is an invisible native switch on iOS, out of the tab order and the accessibility tree', () => {
    pretend(IOS_UA)
    view.render(<HapticSwitch />)
    const input = overlay()
    expect(input.type).toBe('checkbox')
    expect(input.hasAttribute('switch')).toBe(true)
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
    expect(input.className).toBe('g-hsw')
  })

  it('mirrors the host\'s disabled state', () => {
    pretend(IOS_UA)
    view.render(<HapticSwitch disabled />)
    expect(overlay().disabled).toBe(true)
  })

  it('is gone with Settings → Haptics off, and back when it is on again', () => {
    pretend(IOS_UA)
    view.render(<HapticSwitch />)
    act(() => setHapticsEnabled(false))
    expect(overlay()).toBeNull()
    act(() => setHapticsEnabled(true))
    expect(overlay()).not.toBeNull()
  })

  it('knows its own click target', () => {
    pretend(IOS_UA)
    view.render(<HapticSwitch />)
    expect(isHapticSwitchTarget(overlay())).toBe(true)
    expect(isHapticSwitchTarget(document.body)).toBe(false)
    expect(isHapticSwitchTarget(null)).toBe(false)
  })
})

describe('Button haptic on iOS', () => {
  beforeEach(() => pretend(IOS_UA))

  it('lays the switch inside the button, and the tap on it still runs onClick', () => {
    const onClick = vi.fn()
    view.render(<Button haptic onClick={onClick}>Save weigh-in</Button>)
    const button = view.host.querySelector('button')
    expect(button.classList.contains('g-haptic')).toBe(true)
    expect(overlay().parentElement).toBe(button)
    click(overlay())
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(overlay().checked).toBe(true)
  })

  it('keyboard and assistive-tech activation land on the button itself and still work', () => {
    const onClick = vi.fn()
    view.render(<Button haptic onClick={onClick}>Save weigh-in</Button>)
    click(view.host.querySelector('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(overlay().checked).toBe(false)
  })

  it('the switch keeps the button\'s name: it adds no text and no role to the accessibility tree', () => {
    view.render(<Button haptic>Save weigh-in</Button>)
    expect(view.host.querySelector('button').textContent).toBe('Save weigh-in')
    expect(overlay().closest('[aria-hidden="true"]')).toBe(overlay())
  })

  it('a disabled button has a disabled switch: nothing runs, nothing ticks', () => {
    const onClick = vi.fn()
    view.render(<Button haptic disabled onClick={onClick}>Log</Button>)
    expect(view.host.querySelector('button').disabled).toBe(true)
    expect(overlay().disabled).toBe(true)
    click(view.host.querySelector('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('a busy button does not tick either', () => {
    view.render(<Button haptic busy>Saving</Button>)
    expect(overlay().disabled).toBe(true)
  })

  it('has no switch by default, and none on a link (it gets the vibration only)', () => {
    view.render(<Button>Plain</Button>)
    expect(overlay()).toBeNull()
    view.render(<Button haptic href="/x">Link</Button>)
    expect(overlay()).toBeNull()
  })

  it('forwards a submit tapped through the switch to the form, unless the handler cancelled it', () => {
    const onSubmit = vi.fn(e => e.preventDefault())
    view.render(<form onSubmit={onSubmit}><Button haptic type="submit">Send</Button></form>)
    click(overlay())
    expect(onSubmit).toHaveBeenCalledTimes(1)

    onSubmit.mockClear()
    view.render(<form onSubmit={onSubmit}><Button haptic type="submit" onClick={e => e.preventDefault()}>Send</Button></form>)
    click(overlay())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('the other controls that carry it', () => {
  beforeEach(() => pretend(IOS_UA))

  it('a switch ticks by default and flips through a tap on the overlay', () => {
    const onChange = vi.fn()
    view.render(<Switch aria-label="Precise" checked={false} onChange={onChange} />)
    expect(overlay().parentElement.getAttribute('role')).toBe('switch')
    click(overlay())
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('a switch can opt out, and a disabled one mirrors disabled', () => {
    view.render(<Switch aria-label="Preview" checked={false} onChange={() => {}} haptic={false} />)
    expect(overlay()).toBeNull()
    view.render(<Switch aria-label="Off" checked={false} onChange={() => {}} disabled />)
    expect(overlay().disabled).toBe(true)
  })

  it('a set\'s check is silent unless it opts in', () => {
    const onChange = vi.fn()
    view.render(<Check label="Set 1 done" checked={false} onChange={onChange} />)
    expect(overlay()).toBeNull()
    view.render(<Check haptic label="Set 1 done" checked={false} onChange={onChange} />)
    click(overlay())
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('the app\'s own button takes the same opt-in', () => {
    const onClick = vi.fn()
    view.render(<LegacyButton haptic variant="primary" onClick={onClick}>Log</LegacyButton>)
    click(overlay())
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Android vibration', () => {
  beforeEach(() => {
    pretend(ANDROID_UA)
    navigator.vibrate = vi.fn(() => true)
  })

  it('maps each style to its pattern', () => {
    expect(HAPTIC_PATTERNS).toMatchObject({ light: 10, medium: 20, heavy: 50, success: [10, 50, 10], warning: [20, 100, 20] })
    haptic('heavy')
    haptic('success')
    expect(navigator.vibrate.mock.calls).toEqual([[50], [[10, 50, 10]]])
  })

  it('a haptic Button vibrates once per tap, in its style, and renders no switch', () => {
    const onClick = vi.fn()
    view.render(<Button haptic hapticStyle="medium" onClick={onClick}>Finish workout</Button>)
    expect(overlay()).toBeNull()
    click(view.host.querySelector('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledWith(20)
  })

  it('a button that does not opt in is silent, and so is a disabled one', () => {
    view.render(<Button>Plain</Button>)
    click(view.host.querySelector('button'))
    view.render(<Button haptic disabled>Off</Button>)
    click(view.host.querySelector('button'))
    expect(navigator.vibrate).not.toHaveBeenCalled()
  })

  it('stays silent with Settings → Haptics off', () => {
    setHapticsEnabled(false)
    view.render(<Button haptic>Save</Button>)
    click(view.host.querySelector('button'))
    expect(navigator.vibrate).not.toHaveBeenCalled()
  })

  it('does nothing on a desktop browser, even one that has navigator.vibrate', () => {
    pretend('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Chrome/130.0')
    haptic('light')
    expect(navigator.vibrate).not.toHaveBeenCalled()
    expect(hapticsSupported()).toBe(false)
  })

  it('is offered where the phone can vibrate', () => {
    expect(hapticsSupported()).toBe(true)
  })
})
