import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'
import SearchSection from './SearchSection.jsx'

// The search's Go to row (boards Sh0Search, Sh0SearchTrain, Sh0SearchEat): glass chips with a
// glyph, scrolling sideways, under their uppercase heading. `items` are { id, label (translated),
// icon, href | onClick } (lib/search/start.js shortcutsFor gives them, labels to translate). The
// chips are actions, not choices: plain links or buttons in the tab order.
export default function GoToChips({ items, title }) {
  return (
    <SearchSection title={title || t('Go to')} card={false}>
      <div className="g-goto-row">
        {items.map(c => (
          <Act key={c.id} href={c.href} onClick={c.onClick} className="g-goto-chip" data-glass="flat">
            {c.icon && <Icon name={c.icon} className="g-icon" />}
            {c.label}
          </Act>
        ))}
      </div>
    </SearchSection>
  )
}
