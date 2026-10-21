import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { effectiveLang } from '../../lib/default-lang.js'
import { DEMO } from '../../lib/demo.js'
import { MOBILE } from '../../lib/mobile.js'
import { remoteServer } from '../../lib/api.js'
import { cancelDeletion } from '../../lib/account-deletion.js'
import { BRAND } from '../../brand.js'
import { connectionView, useOnline } from '../../components/ServerSync.jsx'
import { usePasskeys } from '../../components/Passkeys.jsx'
import { manageMeasurementsSheet } from '../Measurements.jsx'
import { PAGES, searchSettings } from '../settings-pages.js'
import SettingsRootScreen from './SettingsRootScreen.jsx'
import { settingsPath } from './paths.js'
import { rootGroups, rowPath, ROOT_ROW_SLOTS } from './root-groups.js'
import { accountLine, deletionDate, deviceOnly, deviceWord, rowValues, syncPill, syncRowWord } from './row-values.js'
import { hitRows } from './search-hits.js'
import { useAccountActions } from './use-account-actions.js'
import { useFlashRow } from './use-flash-row.js'
import { useSettingsCtx } from './use-settings-ctx.js'

// What was typed into the search, kept while you step into a hit and back out again: tied to
// the history entry it was typed on, so Back (in the app, the browser's or Android's) brings the
// results back, while Settings opened afresh from anywhere (the gear, a tab) starts at the root.
let lastQuery = { q: '', key: null }

// The server's address as the Sync and backup row says it: the paired server on the phone app,
// this app's own origin in a browser.
function serverHost() {
  try { return new URL(MOBILE ? remoteServer() : window.location.href).host || null } catch { return null }
}

/**
 * The Settings root (/me): SettingsRootScreen fed from the store. `find`/`via` are a search hit
 * for a row on the root itself (Sign out), scrolled to and flashed.
 */
export default function SettingsRoot({ find = null, via = null }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  const coachLocal = useStore(s => s.coachLocal)
  const config = useStore(s => s.config)
  const unsynced = useStore(s => s.unsyncedChanges)
  const online = useOnline()
  const body = useRef(null)
  useFlashRow(body, find, via)
  const ctx = useSettingsCtx()
  const { disconnect, signOutHere } = useAccountActions()
  const passkeys = usePasskeys(!!user && !MOBILE && !DEMO)
  const lang = effectiveLang(S, config)
  const [cancelling, setCancelling] = useState(false)

  // The router's key for this history entry (what useLocation().key reads), taken once.
  const [key] = useState(() => window.history.state?.key || null)
  const [q, setQ] = useState(() => (key && lastQuery.key === key ? lastQuery.q : ''))
  const [searching, setSearching] = useState(() => !!(key && lastQuery.key === key && lastQuery.q))
  const setQuery = v => { lastQuery = { q: v, key }; setQ(v) }

  // A page of Settings, a page that lives in a tab, or the measurement chooser's sheet.
  const openPage = id => {
    if (PAGES[id]?.sheet) { manageMeasurementsSheet(); return }
    nav(PAGES[id]?.to || settingsPath(id))
  }

  const view = user && !DEMO && sync ? connectionView(sync, { online }) : null
  const pill = user && !DEMO ? syncPill({
    view, lastSynced: sync?.lastSynced, waiting: typeof unsynced === 'function' ? unsynced().count : 0, deletion: user.deletion,
  }) : null
  const values = rowValues({ S, ctx, lang, coachLocal, host: user && !DEMO ? serverHost() : null, synced: syncRowWord(pill) })
  const groups = rootGroups(ctx, ROOT_ROW_SLOTS).map(g => ({
    key: g.key,
    title: g.title,
    rows: g.rows.map(r => ({
      key: r.id,
      icon: r.icon,
      title: t(r.title),
      sub: values[r.id]?.sub !== undefined ? values[r.id].sub : r.sub ? t(r.sub) : null,
      value: values[r.id]?.value ?? null,
      onClick: () => nav(rowPath(r)),
    })),
  }))

  const device = deviceWord(navigator.userAgent)
  const account = {
    initial: user && !DEMO ? String(user.name || '?').trim().charAt(0).toUpperCase() : null,
    name: DEMO ? t('Demo') : user ? user.name || t('Account') : MOBILE ? t('This phone') : t('Guest'),
    line: accountLine({ user, demo: DEMO, mobile: MOBILE, passkeys: passkeys.st?.passkeys.length ?? null, device }),
    onOpen: () => openPage('account'),
  }

  const cancel = async () => {
    setCancelling(true)
    const ok = await cancelDeletion()
    setCancelling(false)
    useUI.getState().toast(ok ? t('Deletion cancelled. Your account stays.') : t('Could not cancel the deletion. Try again.'),
      ok ? { action: t('OK'), onAction: () => {} } : undefined)
  }

  const go = hit => {
    if (!hit.isPage && hit.page == null) setQuery('')
    setSearching(false)
    if (hit.isPage) { openPage(hit.page); return }
    nav(settingsPath(hit.page), { state: hit.via ? { find: hit.title, via: hit.via } : { find: hit.title } })
  }
  const hits = q.trim() ? searchSettings(q, ctx) : null

  const signOut = DEMO || !user ? null
    : MOBILE ? { title: t('Disconnect'), sub: null, onClick: disconnect }
      : { title: t('Sign out'), sub: deviceOnly(navigator.userAgent), onClick: signOutHere }
  const footer = user && !DEMO
    ? t('{0} · settings sync to every device you sign in on.', BRAND.name + ' ' + BRAND.version)
    : BRAND.name + ' ' + BRAND.version

  return <SettingsRootScreen
    bodyRef={body}
    banner={user?.deletion ? { date: deletionDate(user.deletion.at), busy: cancelling, onCancel: cancel } : null}
    account={account}
    pill={pill}
    onPill={() => openPage('backup')}
    groups={groups}
    search={{
      open: searching,
      query: q,
      rows: hits ? hitRows(hits.slice(0, 40), S, { ...ctx, lang }, go) : [],
      onOpen: () => setSearching(true),
      onQuery: setQuery,
      onClose: () => { setQuery(''); setSearching(false) },
    }}
    signOut={signOut}
    footer={footer} />
}
