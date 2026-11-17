import { t } from '../../../lib/i18n.js'

// A built export, as use-data-actions buildJson / buildZip hand it back: `{ name, json }` or
// `{ name, blob }`. These are the bits of the "Backup exported" toast: the size it names and the
// Share it offers where the browser can hand a file to the share sheet (the native build always
// can: saveFile goes through it).
const MB = 1024 * 1024

const blobOf = file => file.blob || new Blob([file.json], { type: 'application/json' })

export const fileSize = file => blobOf(file).size

/** "2.4 MB", "312 KB": one decimal for megabytes, whole kilobytes, never "0 KB". */
export function fmtSize(bytes) {
  if (bytes >= MB) return t('{0} MB', (bytes / MB).toFixed(1))
  return t('{0} KB', Math.max(1, Math.round(bytes / 1024)))
}

const toFile = file => new File([blobOf(file)], file.name, { type: blobOf(file).type })

/** Whether this browser can share the file itself (Web Share level 2). */
export function canShareFile(file) {
  try { return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [toFile(file)] }) } catch { return false }
}

/** Opens the browser's share sheet with the file; a dismissed sheet is not an error. */
export async function shareFile(file) {
  try { await navigator.share({ files: [toFile(file)], title: file.name }) } catch { /* share sheet dismissed */ }
}
