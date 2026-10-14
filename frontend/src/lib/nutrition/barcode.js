import { NtApi } from './api.js'
import { offProduct } from './off.js'
import { useNutrition } from './store.js'

// A scanned or typed barcode, to the food it names. NutriTrace's order (Foods.svelte handleScan):
// your own foods first (a saved barcode needs no lookup), then Open Food Facts.

/** The code as a product code: 8 to 14 digits once spaces are gone, or null (a QR card, a word).
 *  A UPC-A (12 digits) becomes the EAN-13 Open Food Facts files it under, as NutriTrace does. */
export function normalizeBarcode(raw) {
  const code = String(raw ?? '').replace(/\s+/g, '')
  if (!/^\d{8,14}$/.test(code)) return null
  return /^\d{12}$/.test(code) ? '0' + code : code
}

// A UPC saved as "0036000291452" matches a scan of "36000291452", and the other way round.
const stripZeros = code => String(code || '').trim().replace(/^0+/, '')

/** One of your foods with this barcode, or undefined. */
export function ownFoodWith(foods, code) {
  const want = stripZeros(code)
  return foods.find(f => f.barcode && stripZeros(f.barcode) === want)
}

/**
 * What a barcode is. Resolves to
 *   { kind: 'own', food }       one of your foods (logs without a lookup)
 *   { kind: 'online', food }    an Open Food Facts product, unsaved
 *   { kind: 'no-nutrition' }    Open Food Facts knows it but has no energy value to log
 *   { kind: 'miss' }            nobody knows this code
 * and throws an NtError when the lookup itself failed (offline, the proxy refused, ...), which is
 * not a miss: the caller says so and offers a retry.
 * @param {string} code a normalizeBarcode result
 */
export async function findByBarcode(code, { lang = 'en', signal } = {}) {
  const store = useNutrition.getState()
  if (store.foods.status !== 'ready') await store.loadFoods()
  const own = ownFoodWith(useNutrition.getState().foods.list, code)
  if (own) return { kind: 'own', food: own }
  let data
  try {
    data = await NtApi.lookupProduct(code, { lang, signal })
  } catch (e) {
    if (e?.status === 404) return { kind: 'miss' }
    throw e
  }
  const food = offProduct(data, code, lang)
  if (food === undefined) return { kind: 'miss' }
  if (food === null) return { kind: 'no-nutrition' }
  return { kind: 'online', food }
}
