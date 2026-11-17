import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { IS_ANDROID } from '../../../lib/api.js'
import { BUILD_DATE } from '../../../lib/build-info.js'
import { fmtDate } from '../../../lib/format.js'
import { MOBILE, isAndroid } from '../../../lib/mobile.js'
import { checkForUpdate, downloadAndInstall, fetchChecksum, RELEASES_PAGE } from '../../../lib/update.js'
import { confirmSheet } from '../../../sheets.jsx'
import { openExternal } from '../../../components/CustomMedia.jsx'
import Logo from '../../../ds/Logo.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import { BRAND, LINKS } from '../../../brand.js'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { settingsPath } from '../paths.js'
import { standalone } from '../use-settings-ctx.js'
import DownloadProgress from './download-progress.jsx'
import ViewportReadout from './viewport-readout.jsx'

// About (board St1About, A1.36): the logo and version, the update check, how to install the web
// app, and where the credits are. On Android the row checks GitHub on demand and installs a newer
// release (checksum verified, see onUpdateRowClick). Gains ships no APK for the web or iOS builds,
// which update together with their server: the service worker's "A new version is ready" toast
// (lib/sw-update.js) is their update, so they have no check row.
export default function AboutPage() {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const user = useStore(s => s.user)
  const [android, setAndroid] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null) // { hasUpdate, latestVersion, apkUrl, hashUrl } | null
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    // The in-app updater installs an .apk, so it only applies to the native Android build.
    // On iOS and the web this check is skipped and the update row never appears. isAndroid()
    // already answers false off the mobile build; the MOBILE check on top keeps the web bundle
    // from even asking (and from calling GitHub on every Settings visit).
    if (!MOBILE) return
    isAndroid().then(ok => {
      setAndroid(ok)
      if (ok) checkForUpdate().then(setUpdateInfo).catch(() => {})
    })
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

  const installed = standalone()
  const showUpdate = MOBILE && android
  // The live viewport figures are a diagnostic for whoever runs the server, never anyone else's.
  const admin = !!user?.admin

  return (
    <SettingsPage title={t('About')} line={t('Made by Adrian, for a few friends')}>
      <div className="set-body">
        <div className="set-about-logo"><Logo variant="lockup" size={56} /></div>

        <div className="g-glist g-glass">
          <SettingRow icon="info" title={t('Version')} value={'v' + BRAND.version} sub={BUILD_DATE ? t('Built {0}', fmtDate(BUILD_DATE, false, true)) : undefined} />
          {showUpdate && (
            <SettingRow icon="download"
              title={updateInfo?.hasUpdate ? t('Update to Gains v{0}', updateInfo.latestVersion) : t('Check for updates')}
              sub={checking ? t('Checking…') : t('You have v{0}', __APP_VERSION__)}
              onClick={() => (updateInfo?.hasUpdate ? onUpdateRowClick() : checkNow())} />
          )}
        </div>
        {showUpdate && <StageNote>{t('Releases are checked on GitHub. The download is verified against its checksum before the installer opens.')}</StageNote>}

        {/* "Add to Home screen" is for the web app: not inside the phone app. */}
        {!MOBILE && (
          <div className="g-glist g-glass">
            <SettingRow icon={installed ? 'checkCircle' : 'share'} title={t('Install')}
              sub={installed ? t('Already installed on this device')
                : IS_ANDROID ? t('In Chrome: ⋮ menu → Add to Home screen') : t('In Safari: Share → Add to Home Screen')} />
          </div>
        )}

        <StageSection variant="label" title={t('Credits')} />
        <div className="g-glist g-glass">
          <SettingRow icon="shield" title={t('Licences')} sub={t('AGPL-3.0 · open source')} onClick={() => nav(settingsPath('licences'))} />
          <SettingRow icon="image" title={t('Exercise pictures')} sub={t('Licensed from {0}', LINKS.media.name)} onClick={() => openExternal(LINKS.media.url)} />
          <SettingRow icon="apple" title={t('Food data')} sub={t('{0}, ODbL', LINKS.openFoodFacts.name)} onClick={() => openExternal(LINKS.openFoodFacts.url)} />
          <SettingRow icon="arm" title={t('Muscle map')} sub={t('{0} by Melih Colpan, MIT', LINKS.muscleMap.name)} onClick={() => openExternal(LINKS.muscleMap.url)} />
        </div>

        {admin && <ViewportReadout />}
      </div>
    </SettingsPage>
  )
}
