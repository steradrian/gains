import { t, tn } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StageSearchField from '../../ds/StageSearchField.jsx'
import StageSection from '../../ds/StageSection.jsx'
import SettingsRows from './SettingsRows.jsx'

// The Settings search (boards St1Search, A1.1): the root's overlay state. The field becomes the
// overlay's head with the glass x beside it, the count of what matched, and the hits, each a row
// with its page and a hint of what is on it (`rows`: `[{ key, icon, title, sub, onClick }]`, drawn
// by SettingsRows). A hit opens its page and flashes the row; the container does that. Before a
// word is typed there is one line saying what the search finds. Nothing is held here.
//
// "Also matches" (a food, Ea8) is not drawn: foods live in Eat's own library and the app has no
// cheap local match for them from here.
export default function SettingsSearch({ query, onQuery, rows, onClose }) {
  const typed = query.trim()
  return (
    <div className="sroot">
      <div className="sroot-search">
        <StageSearchField autoFocus query={query} onChange={onQuery} placeholder={t('Search settings')} label={t('Search settings')}
          onClose={onClose} closeLabel={t('Close search')} />
      </div>
      {!typed
        ? <StageNote>{t('Finds every row on every settings page, in English and your language. A hit opens its page and flashes the row.')}</StageNote>
        : rows.length
          ? <>
            <StageSection variant="line" title={tn('{0} setting', '{0} settings', rows.length)} />
            <div className="sroot-gutter"><SettingsRows rows={rows} /></div>
          </>
          : <StageEmpty card={false} illustration="search" title={t('No setting matches “{0}”.', typed)} />}
    </div>
  )
}
