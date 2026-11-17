// The results listbox's options (fitness-eval ux-search.md §6): the header's field is the
// combobox and keeps the focus; each row is an option, out of the tab order, which the arrow keys
// make the active one (the field's aria-activedescendant, session.js `active`) and Enter clicks.

/** The DOM id of a row, for the field's aria-activedescendant. */
export const rowId = key => 'sr-' + String(key).replace(/[^\w-]/g, '_')

/** What a stage row (ds/SearchRow, ds/BestMatch `optionProps`) takes to be the option `key`, with
 *  `active` the id the arrow keys are on. */
export const optionProps = (key, active) => {
  const id = rowId(key)
  return { role: 'option', id, 'aria-selected': active === id, tabIndex: -1 }
}
