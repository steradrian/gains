import { fold, nearest } from '../../lib/search/match.js'

const wordsOf = text => fold(text).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4)

/**
 * "Did you mean": the typed query with its first mistyped word swapped for the nearest word of
 * `names` (food, saved meal and recipe names), or null when every word is spelled as a name
 * spells it or none is near one. Only words of four letters or more can be mistyped (search/match.js
 * nearest keeps its own typo allowance), and a word that is a name's word already is never changed.
 */
export function didYouMean(query, names) {
  const known = new Set(names.flatMap(wordsOf))
  if (!known.size) return null
  const pool = [...known]
  const words = String(query).trim().split(/\s+/).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    if (known.has(fold(words[i]))) continue
    const hit = nearest(words[i], pool)
    if (hit) return words.map((w, j) => (j === i ? hit : w)).join(' ')
  }
  return null
}
