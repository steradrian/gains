import { categoryLabel, categoryName } from './settings-lists.js'

// A category is drawn as a coloured dot (board St1Categories), not an emoji. What is stored is
// still the hub's `label` (up to 16 characters, shown before the name by NutriTrace and by the
// food list), so the eight colours are the eight round "coloured circle" characters: any place
// that prints the label shows a dot of that colour, and nothing in the hub's shape changes.
// The escapes are the characters themselves (red, orange, yellow, green, blue, purple, brown, black).
export const CATEGORY_COLORS = [
  { id: 'red', dot: '\u{1F534}' },
  { id: 'orange', dot: '\u{1F7E0}' },
  { id: 'yellow', dot: '\u{1F7E1}' },
  { id: 'green', dot: '\u{1F7E2}' },
  { id: 'blue', dot: '\u{1F535}' },
  { id: 'purple', dot: '\u{1F7E3}' },
  { id: 'brown', dot: '\u{1F7E4}' },
  { id: 'black', dot: '⚫' },
]

const hash = s => {
  let h = 0
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return h
}

/**
 * The colour a category is drawn in. A stored colour dot is its colour. Any other label (an emoji
 * from before the dots, such as a steak) keeps working: it stands for the colour its characters
 * hash to, the same one every time. A category with no label hashes its name.
 */
export function categoryColor(category) {
  const label = categoryLabel(category)
  const hit = CATEGORY_COLORS.find(c => c.dot === label)
  if (hit) return hit.id
  return CATEGORY_COLORS[hash(label || categoryName(category)) % CATEGORY_COLORS.length].id
}

/** The label to store for a colour id. */
export const dotOf = id => (CATEGORY_COLORS.find(c => c.id === id) || CATEGORY_COLORS[0]).dot

/** Whether a label is one of the eight dots (and so already the colour it draws). */
export const isDot = label => CATEGORY_COLORS.some(c => c.dot === label)
