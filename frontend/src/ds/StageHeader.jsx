import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

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
// closes. Scoped to one kind, `scope` (its name, translated) sits in the field as a chip whose ×
// calls `onClearScope`. `inputRef` reaches the input; `inputProps` go onto it (a combobox's
// aria-controls, aria-activedescendant, onKeyDown). Without `onQuery` the pill is a link or a
// button that opens the search, as on a screen that hands the search to another header.
export default function StageHeader({
  initial, placeholder, unread = 0, alert, searching, onSearch, settingsHref, searchHref, bellHref, onSettings, onBell,
  query, onQuery, scope, onClearScope, inputRef, inputProps,
}) {
  const [own, setOwn] = useState(!!searching)
  const open = onSearch ? !!searching : own
  const set = v => { setOwn(v); onSearch?.(v) }
  const letter = ([...(initial || '')][0] || 'A').toUpperCase()
  const bellName = open ? t('Close search') : unread > 0 ? t('Notifications, {0} new', unread) : t('Notifications')
  const text = placeholder || t('Search')
  return (
    <header className={cx('g-shdr', open && 'g-shdr-open')}>
      <Act href={settingsHref} onClick={onSettings} ariaLabel={alert ? t('Settings') + ', ' + alert : t('Settings')} className="g-sbtn g-glass">
        {letter}
        {alert && <span className="g-sdot" aria-hidden="true" />}
      </Act>
      {onQuery
        ? <label className="g-spill g-spill-field g-glass" role="search">
          <Icon name="magnifier" className="g-icon" />
          {open && scope && <span className="g-ssf-scope">
            {scope}
            <button type="button" className="g-ssf-scope-x" onClick={onClearScope} aria-label={t('Remove the {0} scope', scope)}>
              <Icon name="xmark" className="g-icon" />
            </button>
          </span>}
          <input {...inputProps} ref={inputRef} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            aria-label={text} placeholder={text} value={open ? query ?? '' : ''}
            onFocus={e => { inputProps?.onFocus?.(e); if (!open) set(true) }} onChange={e => onQuery(e.target.value)} />
        </label>
        : <Act href={open ? undefined : searchHref} onClick={() => set(true)} className="g-spill g-glass">
          <Icon name="magnifier" className="g-icon" />
          <span>{text}</span>
        </Act>}
      <Act href={open ? undefined : bellHref} onClick={() => (open ? set(false) : onBell?.())} ariaLabel={bellName} className={cx('g-sbtn g-glass g-bell', open && 'g-bell-close')}>
        <span className="g-bell-a" aria-hidden="true"><Icon name="bell" className="g-icon" /></span>
        <span className="g-bell-b" aria-hidden="true"><Icon name="xmark" className="g-icon" /></span>
        {unread > 0 && !open && <span className="g-sdot" aria-hidden="true" />}
      </Act>
    </header>
  )
}
