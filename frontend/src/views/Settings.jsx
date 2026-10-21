import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF } from '../store/useStore.js'
import { PROGRESS_ROOT } from '../lib/tab-route.js'
import { weekStartOf, SUNDAY } from '../lib/format.js'
import { scheduleModeOf } from '../lib/rotation.js'
import { t, tn, LANGS, dateLocale } from '../lib/i18n.js'
import { effectiveLang } from '../lib/default-lang.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { accentLabel } from '../lib/accent.js'
import { fmtRest } from '../lib/duration.js'
import Icon from '../components/Icon.jsx'
import { Page } from '../components/layout.jsx'
import { EmptyState } from '../components/blocks.jsx'
import SyncStatusCard from '../components/SyncStatusCard.jsx'
import { Section, Row, SearchField } from '../components/ui.jsx'
import { manageMeasurementsSheet } from './Measurements.jsx'
import { PAGES, ROOT_GROUPS, pageVisible, searchSettings } from './settings-pages.js'
import { BRAND } from '../brand.js'
import SettingsPageHost from './settings/SettingsPageHost.jsx'
import { settingsPath } from './settings/paths.js'
import { PAGE_COMPONENTS } from './settings/pages/index.js'
import { useAccountActions } from './settings/use-account-actions.js'
import { useFlashRow } from './settings/use-flash-row.js'
import { useSettingsCtx } from './settings/use-settings-ctx.js'

/* Profile (ia-proposal §5). The root is one screen: the account card, the sync status, one group
   of rows per domain that each open a page (/me/<page>, or a page in a tab), Log out, and a search
   over every row. Every page goes back to Profile (§6). settings-pages.js says which page holds
   what, and is what the search reads. `page` is the open page (null for the root), `find` a row a
   search hit asked for, which is scrolled to and flashed. The route is settings/SettingsRoute.jsx;
   each page is a file in settings/pages/. */

// What was typed into the search, kept while you step into a hit and back out again: tied to
// the history entry it was typed on, so Back (in the app, the browser's or Android's) brings the
// results back, while Settings opened afresh from anywhere (the gear, a tab) starts at the root.
let lastQuery = { q: '', key: null }

// "Mon" / "Sun" in the app's language, for the Schedule defaults row's preview.
const shortWeekday = day => {
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short' }).format(new Date(2024, 0, day === 0 ? 7 : 1)) } catch { return day === 0 ? 'Sun' : 'Mon' }
}

export default function Settings({ page = null, find = null, via = null }) {
  if (page && PAGE_COMPONENTS[page]) return <SettingsPageHost page={page} find={find} via={via} />
  return <SettingsRootHost find={find} via={via} />
}

function SettingsRootHost({ find, via }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  const coachLocal = useStore(s => s.coachLocal)
  const config = useStore(s => s.config)
  const body = useRef(null)
  useFlashRow(body, find, via)
  const ctx = useSettingsCtx()
  const { disconnect, signOutHere } = useAccountActions()
  const lang = effectiveLang(S, config)
  const { ntSettings, canVibrate } = ctx

  const mode = scheduleModeOf(S)
  const layout = ['list', 'compact', 'focus'].includes(S.workoutView) ? S.workoutView : 'cards'
  const layoutLabel = { cards: t('Cards'), list: t('List'), compact: t('Compact') }[layout]
  const activeProfile = (S.equipProfiles || []).find(p => p.id === S.activeEquipId)
  const themeLabel = { dark: t('Dark'), light: t('Light'), system: t('System') }[S.theme || 'dark'] || t('Dark')
  // The value a root row shows, so most questions are answered without opening the page.
  const preview = {
    workout: () => (S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer')) + ' · ' + layoutLabel,
    alerts: () => [S.sound ? t('Sound') : null, canVibrate && S.vibrate !== false ? t('Vibrate') : null, S.timerFlash ? t('Flash') : null].filter(Boolean).join(' · ') || t('Silent'),
    reminders: () => (S.reminder?.on ? (S.reminder.time || DEF.reminder?.time || '') : t('Off')),
    schedule: () => (mode === 'rotation' ? t('Rotation') : t('Fixed Week')) + ' · ' + shortWeekday(weekStartOf(S) === SUNDAY ? 0 : 1),
    units: () => (S.unit || 'kg') + ' · ' + (LANGS[lang] || lang),
    equipment: () => (S.equipFilterOn && activeProfile ? activeProfile.name : t('Everything')),
    appearance: () => themeLabel + ' · ' + accentLabel(S),
    coach: () => (coachLocal?.mode === 'server' ? t('Your server') : coachLocal?.mode === 'byok' ? t('Your API key') : t('Off')),
    about: () => 'v' + BRAND.version,
    goals: () => (ntSettings ? ({ adaptive: t('Adaptive'), dynamic: t('Dynamic') })[ntSettings.calorieGoalMode] || t('Fixed') : null),
  }

  // A page of Profile, a page that lives in a tab, or the measurement chooser's sheet.
  const open = id => {
    if (PAGES[id].sheet) { manageMeasurementsSheet(); return }
    nav(PAGES[id].to || settingsPath(id))
  }

  // Log out (§5): the browser signs out, a paired phone disconnects. A guest and a phone kept
  // local have nothing to leave.
  const logOut = DEMO || !user ? null
    : MOBILE ? <Row icon="signOut" iconTint="var(--red)" title={t('Disconnect')} danger onClick={disconnect} />
    : <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={signOutHere} />
  return <SettingsRoot bodyRef={body} ctx={ctx} preview={preview} open={open} user={user} sync={sync} logOut={logOut}
    go={hit => {
      if (hit.isPage) { open(hit.page); return }
      nav(settingsPath(hit.page), { state: hit.via ? { find: hit.title, via: hit.via } : { find: hit.title } })
    }} />
}

function SettingsRoot({ bodyRef, ctx, preview, open, user, sync, logOut, go }) {
  // The router's key for this history entry (what useLocation().key reads), taken once.
  const [key] = useState(() => window.history.state?.key || null)
  const nav = useNavigate()
  const [q, setQ] = useState(() => (key && lastQuery.key === key ? lastQuery.q : ''))
  const set = v => { lastQuery = { q: v, key }; setQ(v) }
  const hits = q.trim() ? searchSettings(q, ctx) : null
  // The account card: who this is, and the one line that matters about it.
  const acct = DEMO ? { title: t('Demo'), sub: t('Example data, only in this browser.') }
    : user ? {
      title: user.name || t('Account'),
      sub: sync && sync.status && sync.status !== 'ok' ? t('Sync needs a look') : MOBILE ? t('Synced with your server') : t('Account, devices and sync'),
    }
    : MOBILE ? { title: t('This phone'), sub: t('All data stays on this phone') }
    : { title: t('Guest'), sub: t('Your data lives on this device. Sign in to sync.') }
  const initial = user && !DEMO ? String(user.name || '?').trim().charAt(0).toUpperCase() : null
  return <div ref={bodyRef}>
    {/* Profile is the Me tab's root: like every tab root it has no back (the bar is the way out). */}
    <Page title={t('Profile')} onBack={false} />
    <div className="sp-search">
      <SearchField value={q} onChange={e => set(e.target.value)} onClear={() => set('')}
        placeholder={t('Search…')} aria-label={t('Search settings')} inputMode="search" enterKeyHint="search" autoComplete="off" />
    </div>
    {hits ? (hits.length ? <Section title={tn('{0} result', '{0} results', hits.length)}>
      {hits.slice(0, 40).map(h => (
        <Row key={h.page + ':' + h.title} icon={h.icon} iconTint={h.tint} title={h.label} subtitle={h.trail} accessory="chevron"
          onClick={() => { if (!h.isPage && h.page == null) set(''); go(h) }} />
      ))}
    </Section> : <EmptyState illustration="search" title={t('No setting matches “{0}”.', q.trim())} />) : <>
      <Section>
        <button className="lrow tap sp-acct" onClick={() => open('account')}>
          <span className={'sp-avatar' + (initial ? ' on' : '')} aria-hidden="true">{initial || <Icon name="personCircle" />}</span>
          <span className="lrow-m"><span className="lrow-t">{acct.title}</span><span className="lrow-s">{acct.sub}</span></span>
          <Icon name="chevronRight" className="lrow-c" />
        </button>
      </Section>
      <SyncStatusCard />
      {/* Progress is not a tab any more: Me is Profile, and this is the way into Progress. */}
      <Section>
        <Row icon="chart" iconTint="var(--teal)" title={t('Progress')} accessory="chevron" onClick={() => nav(PROGRESS_ROOT)} className="sp-root-row" />
      </Section>
      {ROOT_GROUPS.map(g => ({ ...g, ids: g.ids.filter(id => pageVisible(id, ctx)) })).filter(g => g.ids.length).map(g => (
        <Section key={g.title} title={t(g.title)}>
          {g.ids.map(id => <Row key={id} icon={PAGES[id].icon} iconTint={PAGES[id].tint} title={t(PAGES[id].title)}
            value={preview[id]?.() || null} accessory="chevron" onClick={() => open(id)} className="sp-root-row" />)}
        </Section>
      ))}
      {logOut && <Section>{logOut}</Section>}
      <div className="dim small sp-version">{BRAND.name} v{BRAND.version}</div>
    </>}
  </div>
}
