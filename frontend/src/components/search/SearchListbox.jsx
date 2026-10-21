import { t } from '../../lib/i18n.js'
import { SEARCH_LIST_ID } from '../../lib/search/session.js'

// The results listbox the header's field controls (fitness-eval ux-search.md §6): the one element
// every option of the panel sits in, directly or in a group named by its heading. What is not a
// choice (the Go to chips, the count chips, a scoped kind's line, "nothing matches") stays outside
// it. Exactly one is on screen at a time, whichever state the panel shows.
export default function SearchListbox({ children }) {
  return <div role="listbox" id={SEARCH_LIST_ID} aria-label={t('Search results')} className="search-list">{children}</div>
}
