// Test helper: an .xlsx built in memory, the way Excel or MacroFactor writes one, so the tests do
// not carry someone's real export. `sheets` is [{ name, rows }], rows of strings or numbers; a
// `{ date: serial }` cell is written as a number with a date format, `{ inline: text }` as an
// inline string. Entries are deflated unless `stored`.
import { deflateRawSync } from 'node:zlib'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const col = i => (i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))

function zip(files, stored) {
  const enc = new TextEncoder()
  const locals = [], centrals = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text)
    const data = stored ? raw : new Uint8Array(deflateRawSync(raw))
    const n = enc.encode(name)
    const local = new Uint8Array(30 + n.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, stored ? 0 : 8, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, n.length, true)
    local.set(n, 30)
    const central = new Uint8Array(46 + n.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, stored ? 0 : 8, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, n.length, true)
    cv.setUint32(42, offset, true)
    central.set(n, 46)
    locals.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }
  const size = centrals.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, centrals.length, true)
  ev.setUint16(10, centrals.length, true)
  ev.setUint32(12, size, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + size + 22)
  let p = 0
  for (const part of [...locals, ...centrals, end]) { out.set(part, p); p += part.length }
  return out
}

const EMPTY = Symbol('empty shared string')

// `prefix` writes every tag as <prefix:tag>; `emptySharedString` puts a self-closed <si/> first in
// the shared strings, as some writers do.
export function makeXlsx(sheets, { stored = false, prefix = '', emptySharedString = false } = {}) {
  const strings = emptySharedString ? [EMPTY] : []
  const sst = s => { let i = strings.indexOf(s); if (i < 0) { i = strings.length; strings.push(s) } return i }
  const cell = (v, ref) => {
    if (v === '' || v == null) return `<c r="${ref}"/>`
    if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`
    if (v.date != null) return `<c r="${ref}" s="1"><v>${v.date}</v></c>`
    if (v.inline != null) return `<c r="${ref}" t="inlineStr"><is><t>${esc(v.inline)}</t></is></c>`
    return `<c r="${ref}" t="s"><v>${sst(v)}</v></c>`
  }
  const files = {}
  sheets.forEach((s, i) => {
    const rows = s.rows.map((r, y) => `<row r="${y + 1}">${r.map((v, x) => cell(v, col(x) + (y + 1))).join('')}</row>`).join('')
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
  })
  files['xl/workbook.xml'] = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${
    sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
  files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
    sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`
  files['xl/styles.xml'] = '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'
  files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map(s => (s === EMPTY ? '<si/>' : `<si><t>${esc(s)}</t></si>`)).join('')}</sst>`
  if (prefix) for (const k of Object.keys(files)) files[k] = files[k].replace(/<(\/?)(?=[A-Za-z])/g, `<$1${prefix}:`)
  return zip(files, stored)
}
