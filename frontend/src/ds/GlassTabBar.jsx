import { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'

// Today · Train · + · Eat · Me on frosted chrome glass (bundle.js `GlassTabBar`, board PartTabBar).
// Slot 2 is the +, which is never a tab and never lit.
const TABS = [['today', () => t('Today'), 'lucideHouse'], ['train', () => t('Train'), 'lucideDumbbell'], null, ['eat', () => t('Eat'), 'eat'], ['me', () => t('Me'), 'user']]
const slotOf = key => TABS.findIndex(tab => tab?.[0] === key)

// The pill glides only once its first paint is two frames behind it, so it never slides in on a
// launch or a deep link: it mounts where it belongs.
function useSlideReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setReady(true)) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [])
  return ready
}

// The lit tab's accent-tint pill, moved by transform only. With no tab lit (`current` null: a page
// every tab can open) it fades out where it is and comes back from there, so the last slot is kept
// as state, adjusted while rendering (React's "storing information from previous renders").
function TabPill({ current }) {
  const ready = useSlideReady()
  const lit = slotOf(current)
  const [slot, setSlot] = useState(Math.max(0, lit))
  if (lit >= 0 && lit !== slot) setSlot(lit)
  return <span className={cx('g-tab-ind', ready && 'g-tab-ind-ready', lit < 0 && 'g-tab-ind-off')} aria-hidden="true" style={{ '--i': lit >= 0 ? lit : slot }} />
}

// Module scope, not GlassTabBar's body: a component declared inside it would be a new type on every
// render, and the bar re-renders on store writes (once a second through a rest).
function Tab({ name, label, icon, lit, running, href, onClick }) {
  const props = {
    className: 'g-tab', onClick, 'aria-current': lit ? 'page' : undefined,
    'aria-label': running ? t('{0}, workout in progress', label) : undefined,
  }
  const kids = <><Icon name={icon} className="g-icon" />{label}{running && <i className="g-tab-dot" aria-hidden="true" />}</>
  return href ? <a href={href} {...props}>{kids}</a> : <button type="button" {...props}>{kids}</button>
}

/**
 * current: 'today' | 'train' | 'eat' | 'me', or null for none lit. With `onChange` it is controlled
 * (every tap, the lit tab's too, calls it); without, the bar lights what is tapped itself.
 * running: the dot on Train. onPlus: the +, which opens Add to Today. hrefs: links instead.
 */
export default function GlassTabBar({ current = 'today', running, onChange, onPlus, hrefs = {} }) {
  const [own, setOwn] = useState(current)
  const cur = onChange ? current : own
  return (
    <nav className="g-gtabbar" aria-label={t('Main navigation')}>
      <TabPill current={cur} />
      {TABS.map(tab => {
        if (!tab) {
          return hrefs.plus
            ? <a key="plus" href={hrefs.plus} className="g-plus" aria-label={t('Add to Today')}><Icon name="plus" className="g-icon" /></a>
            : <button key="plus" type="button" className="g-plus" aria-label={t('Add to Today')} aria-haspopup="dialog" onClick={onPlus}><Icon name="plus" className="g-icon" /></button>
        }
        const [name, label, icon] = tab
        return <Tab key={name} name={name} label={label()} icon={icon} lit={cur === name} running={running && name === 'train'} href={hrefs[name]}
          onClick={() => { setOwn(name); onChange?.(name) }} />
      })}
    </nav>
  )
}
