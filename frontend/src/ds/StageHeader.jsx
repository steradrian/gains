import { lazy, Suspense, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import { StageArt } from './StageBackground.jsx'

// The magnifier's sweep loads with the search chunk; until then the glyph stands still.
const MotionMagnifier = lazy(() => import('../components/search/header-motion.jsx').then(m => ({ default: m.MotionMagnifier })))

// The header on every tab root, on glass (bundle.js `StageHeader`, board PartHeader): the avatar
// opens Settings, the search pill opens the search and the bell opens Notifications; while the
// search is open the bell turns into its close ×. Each of the three is a link with its `*Href`
// and a button with its handler. `placeholder` is the scoped pill text ("Search food"), already
// translated. `searching` + `onSearch` control the open state; without `onSearch` it keeps its
// own. Any `unread` above 0 shows the dot, the count is only in the bell's name.
// `alert` (already translated, "Connection problem") puts a dot on the avatar and says why in its
// name: the app's connection and hub-sync warnings live there.
//
// The search field (owner direction for PR-07: the bearmenu header). With `onQuery` the pill is the
// search's real input and stays where it is: focusing it opens the search (`onSearch(true)`),
// typing calls `onQuery(text)` with `query` the text, and the header owns the query, so the
// results panel under it never has an input of its own. The bell turns into × in its place; ×
// closes. Nothing else in the header moves. Scoped to one kind, `scope` (its name, translated)
// sits in the field as a chip whose × calls `onClearScope`. `onScan` adds the barcode button in
// the field while it is open. `inputRef` reaches the input; `inputProps` go onto it (a combobox's
// aria-controls, aria-activedescendant, onKeyDown). Without `onQuery` the pill is a link or a
// button that opens the search, as on a screen that hands the search to another header.
//
// `pinned`: the app's header, fixed to the top of the window on the stage. Its height and top
// padding take the status bar (--sat) and the connection row (--conn) once, so its own ground
// paints under the notch in the installed app and what scrolls goes under it. That ground is the
// stage's own art, anchored where the page's stage starts, so at rest the header and the stage under
// it are one surface with no edge. `action` is a tab's one context readout, between the pill and
// the bell; it steps out while searching so the field keeps its width on a 375px phone. `title` is
// the page's name for a screen reader only (its h1): the tab bar already names the tab.
export default function StageHeader({
  initial, placeholder, unread = 0, alert, searching, onSearch, settingsHref, searchHref, bellHref, onSettings, onBell,
  query, onQuery, scope, onClearScope, onScan, inputRef, inputProps, pinned = false, action, title,
}) {
  const [own, setOwn] = useState(!!searching)
  // Bumped on the press, not on the open, so the magnifier answers the finger.
  const [replay, setReplay] = useState(0)
  const open = onSearch ? !!searching : own
  const set = v => { setOwn(v); onSearch?.(v) }
  const letter = ([...(initial || '')][0] || 'A').toUpperCase()
  const bellName = open ? t('Close search') : unread > 0 ? t('Notifications, {0} new', unread) : t('Notifications')
  const text = placeholder || t('Search')
  const glyph = <Icon name="magnifier" className="g-icon" />
  return (
    <header className={cx('g-shdr', open && 'g-shdr-open', pinned && 'g-shdr-pin')}>
      {pinned && <span className="g-shdr-bg"><StageArt /></span>}
      {title && <h1 className="sr-only">{title}</h1>}
      <Act href={settingsHref} onClick={onSettings} ariaLabel={alert ? t('Settings') + ', ' + alert : t('Settings')} className="g-sbtn g-glass">
        {letter}
        {alert && <span className="g-sdot" aria-hidden="true" />}
      </Act>
      {onQuery
        ? <label className="g-spill g-spill-field g-glass" role="search" onPointerDown={() => setReplay(n => n + 1)}>
          <Suspense fallback={glyph}><MotionMagnifier active={open} replayToken={replay} className="g-icon" /></Suspense>
          {open && scope && <span className="g-ssf-scope">
            {scope}
            <button type="button" className="g-ssf-scope-x" onClick={onClearScope} aria-label={t('Remove the {0} scope', scope)}>
              <Icon name="xmark" className="g-icon" />
            </button>
          </span>}
          <input {...inputProps} ref={inputRef} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            aria-label={text} placeholder={text} value={open ? query ?? '' : ''}
            onFocus={e => { inputProps?.onFocus?.(e); if (!open) set(true) }} onChange={e => onQuery(e.target.value)} />
          {open && onScan && <button type="button" className="g-ssf-scan" onClick={onScan} aria-label={t('Scan barcode')}>
            <Icon name="scanBarcode" className="g-icon" />
          </button>}
        </label>
        : <Act href={open ? undefined : searchHref} onClick={() => set(true)} className="g-spill g-glass">
          {glyph}
          <span>{text}</span>
        </Act>}
      {action && !open && <span className="g-shdr-act">{action}</span>}
      <Act href={open ? undefined : bellHref} onClick={() => (open ? set(false) : onBell?.())} ariaLabel={bellName} className={cx('g-sbtn g-glass g-bell', open && 'g-bell-close')}>
        <span className="g-bell-a" aria-hidden="true"><Icon name="bell" className="g-icon" /></span>
        <span className="g-bell-b" aria-hidden="true"><Icon name="xmark" className="g-icon" /></span>
        {unread > 0 && !open && <span className="g-sdot" aria-hidden="true" />}
      </Act>
    </header>
  )
}
