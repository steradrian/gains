import { dateLocale, t } from '../../../lib/i18n.js'
import { OFF_COUNTRIES, OFF_LANGUAGES } from '../../../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'
import NtSettingsPage, { NtSwitchSetting } from '../nt-setting-rows.jsx'
import { openChoiceSheet } from './choice-sheet.jsx'

// A language or country by name in the app's language; the code itself where the platform has no
// name for it.
function displayName(type, code) {
  try { return new Intl.DisplayNames([dateLocale()], { type }).of(code) || code } catch { return code }
}
const countryName = code => (OFF_COUNTRIES[code] ? displayName('region', OFF_COUNTRIES[code]) : t('Worldwide'))

const line = data => (settingOf(data, 'offEnabled')
  ? `${t('Open Food Facts on')} · ${countryName(settingOf(data, 'offSearchCountry'))}`
  : t('Open Food Facts off'))

// Food sources (board St1Sources, A1.23): whether the Open Food Facts search is on (the food
// search, the Foods page's Online tab and barcode lookups), and the language and country it uses
// (names, and which products come first). Logins and keys are not settings the hub lets through,
// USDA cannot be used through it (no key can be saved), and Gains imports every product per 100 g,
// so none of those has a row.
export default function SourcesPage() {
  return <NtSettingsPage title={t('Food sources')} line={line}><SourcesBody /></NtSettingsPage>
}

function SourcesBody() {
  const { data, save } = useNtSettings()
  const language = settingOf(data, 'offSearchLanguage')
  const country = settingOf(data, 'offSearchCountry')
  const languages = OFF_LANGUAGES.map(code => ({ value: code, label: displayName('language', code) }))
  const countries = Object.keys(OFF_COUNTRIES).map(name => ({ value: name, label: countryName(name) }))
  return <>
    <div className="g-glist g-glass">
      <NtSwitchSetting k="offEnabled" icon="globe" title={t('Search Open Food Facts')} sub={t('Online results when you add a food, and barcode lookups.')} />
      {settingOf(data, 'offEnabled') && <>
        <SettingRow icon="chat" title={t('Search language')} sub={t('Product names in results')} value={displayName('language', language)}
          onClick={() => openChoiceSheet({ title: t('Search language'), options: languages, value: language, onPick: v => save('offSearchLanguage', v) })} />
        <SettingRow icon="flag" title={t('Search country')} sub={t('Products sold here come first')} value={countryName(country)}
          onClick={() => openChoiceSheet({ title: t('Search country'), options: countries, value: country, searchLabel: t('Search…'), onPick: v => save('offSearchCountry', v) })} />
      </>}
    </div>
    <StageNote>{t('Open Food Facts is a free, open database built by volunteers (ODbL). Foods you save become yours and stop changing.')}</StageNote>
  </>
}
