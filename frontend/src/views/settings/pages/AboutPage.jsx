import { useEffect, useState, forwardRef } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { IS_ANDROID } from '../../../lib/api.js'
import { MOBILE, isAndroid } from '../../../lib/mobile.js'
import { checkForUpdate, downloadAndInstall, fetchChecksum, RELEASES_PAGE } from '../../../lib/update.js'
import { confirmSheet } from '../../../sheets.jsx'
import { SheetHeader } from '../../../components/sheet-layout.jsx'
import { Section, Row } from '../../../components/ui.jsx'
import { BRAND, LINKS } from '../../../brand.js'
import { useSettingsCtx, standalone } from '../use-settings-ctx.js'

// Download progress sheet — receives a ref callback that exposes a (received, total) setter.
// Uses forwardRef so the caller can push byte counts in without re-rendering the whole page.
const DownloadProgress = forwardRef(function DownloadProgress(_, ref) {
  const [pct, setPct] = useState(0)
  const [text, setText] = useState(t('Starting download…'))
  // Expose a setter the caller can invoke directly
  if (ref) ref(function update(received, total) {
    if (total > 0) {
      const p = Math.min(100, Math.round((received / total) * 100))
      setPct(p)
      setText(t('{0} %', p))
    } else {
      setText(t('{0} MB', (received / 1_000_000).toFixed(1)))
    }
  })
  return (
    <div className="ta-center" style={{ padding: '8px 0' }}>
      <SheetHeader title={t('Downloading update…')} />
      <div style={{ margin: '16px 0', height: 6, borderRadius: 3, background: 'var(--fill-3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: 'var(--acc)', borderRadius: 3, transition: 'width .2s' }} />
      </div>
      <div className="muted small">{text}</div>
    </div>
  )
})

export default function AboutPage() {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const { android } = useSettingsCtx()
  const [updateInfo, setUpdateInfo] = useState(null) // { hasUpdate, latestVersion, apkUrl, hashUrl } | null
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    // The in-app updater installs an .apk, so it only applies to the native Android build.
    // On iOS and the web this check is skipped and the update row never appears. isAndroid()
    // already answers false off the mobile build; the MOBILE check on top keeps the web bundle
    // from even asking (and from calling GitHub on every Settings visit).
    if (!MOBILE) return
    isAndroid().then(ok => { if (ok) checkForUpdate().then(setUpdateInfo).catch(() => {}) })
  }, [])

  // The same check, on demand: the automatic one is silent when it finds nothing or cannot
  // reach GitHub, and a person who taps "Check for updates" deserves an answer either way.
  const checkNow = async () => {
    if (checking) return
    setChecking(true)
    try {
      const info = await checkForUpdate()
      setUpdateInfo(info)
      if (!info.hasUpdate) toast(t('You have the latest version.'))
    } catch {
      toast(t('Couldn’t check for updates. Are you online?'))
    }
    setChecking(false)
  }

  const onUpdateRowClick = () => {
    if (!updateInfo?.hasUpdate) return
    if (updateInfo.apkUrl) {
      // Start download & install
      const version = updateInfo.latestVersion
      confirmSheet({
        title: t('Update to {0}?', version),
        message: t('The latest version will be downloaded and the installer will open.'),
        confirmText: t('Download & Install'),
        onConfirm: async () => {
          // Open a progress sheet
          let closeProgress = null
          let setProgress = null
          useUI.getState().openSheet(close => {
            closeProgress = close
            return <DownloadProgress ref={fn => { setProgress = fn }} />
          }, { locked: true })
          try {
            // The release always publishes the checksum next to the APK. Without it the file is
            // not installed — a sideloaded binary is exactly the thing that should be verified.
            let expectedHash = null
            try { expectedHash = await fetchChecksum(updateInfo.hashUrl) } catch (e) { /* reported below */ }
            if (!/^[0-9a-f]{64}$/i.test(expectedHash || '')) throw new Error(t('Checksum not available, so not installing'))
            await downloadAndInstall(updateInfo.apkUrl, expectedHash, (received, total) => {
              if (setProgress) setProgress(received, total)
            })
            if (closeProgress) closeProgress()
          } catch (e) {
            if (closeProgress) closeProgress()
            toast(t('Update failed: {0}', e.message))
          }
        },
      })
    } else {
      // Update available but no APK asset — open the releases page
      window.open(RELEASES_PAGE, '_blank', 'noopener')
    }
  }

  return <>
    {/* Updates. On Android the row is always there: it checks on demand and installs when a
        release is newer (checksum verified, see onUpdateRowClick). Gains ships no APK, so the
        web build shows only the version: it updates together with its server. */}
    <Section footer={MOBILE && android ? t('Releases are checked on GitHub. The download is verified against its checksum before the installer opens.') : null}>
      <Row icon="info" iconTint="var(--grey)" title={t('Version')} value={'v' + BRAND.version} />
      {MOBILE
        ? android && <Row icon="download" iconTint="var(--green)"
            title={updateInfo?.hasUpdate ? t('Update to Gains v{0}', updateInfo.latestVersion) : t('Check for updates')}
            subtitle={checking ? t('Checking…') : t('You have v{0}', __APP_VERSION__)}
            accessory="chevron"
            onClick={() => (updateInfo?.hasUpdate ? onUpdateRowClick() : checkNow())} />
        : null}
    </Section>
    {/* "Add to Home screen": not inside the phone app, and not once it is installed. */}
    {!MOBILE && !standalone() && <Section title={t('Tip')}>
      <Row icon="share" iconTint="var(--blue)"
        title={IS_ANDROID ? t('In Chrome: ⋮ menu → Add to Home screen') : t('In Safari: Share → Add to Home Screen')}
        subtitle={t('to install Gains as a full-screen app.') + ' ' + (user ? t('Your data syncs with your profile. Sign in anywhere and it’s there.') : t('Guest data stays on this device, so export a backup now and then!'))} />
    </Section>}
    {/* The version, where the support template tells people to look for it. On the phone
        build there is no address bar and no about box, so without this there is no way to tell
        which build you are running, or whether an update actually installed. */}
    <div className="dim small sp-version">
      {BRAND.name} v{BRAND.version} · {t('free & open source (AGPL v3)')}<br />
      <a href={LINKS.source[0].url} target="_blank" rel="noopener">{t('Source code')}</a><br />
      {/* Attribution the media licence asks for word for word (agreement §8c), so it is not translated:
          it names the project the media were licensed to, on purpose. */}
      Exercise media © Aliaksandr Makatserchyk, <a href={LINKS.media.url} target="_blank" rel="noopener">Gym visual</a>, gymvisual.com.
      Media licensed for use in {LINKS.upstream.name} only; see <a href={LINKS.upstream.notice} target="_blank" rel="noopener">NOTICE.md</a>
    </div>
  </>
}
