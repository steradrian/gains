// Read the sheets of an .xlsx into rows of strings, the shape parseCSV gives, so a spreadsheet
// export goes through the same importer as a CSV one. MacroFactor only exports .xlsx.
//
// An .xlsx is a zip of XML files. The zip is read from its central directory (the sizes there are
// right even when the writer streamed the entries), entries are inflated with the platform's
// DecompressionStream, and the few XML shapes a sheet uses are scanned rather than parsed into a
// DOM — the same approach parseBodyweight takes with Apple Health's export.

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50

/** Is this the start of a zip (and so possibly an .xlsx)? */
export const looksLikeZip = bytes => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4

// name -> the entry's compressed bytes and method, from the central directory.
function zipEntries(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  // The end record sits in the last 22 bytes plus a comment of at most 64 KB.
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === EOCD) { end = i; break }
  }
  if (end < 0) throw new Error('not a zip')
  const count = v.getUint16(end + 10, true)
  let p = v.getUint32(end + 16, true)
  const out = new Map()
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== CENTRAL) throw new Error('broken zip')
    const method = v.getUint16(p + 10, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const skip = nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    if (v.getUint32(local, true) !== LOCAL) throw new Error('broken zip')
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    out.set(name, { method, data: bytes.subarray(start, start + size) })
    p += 46 + skip
  }
  return out
}

async function inflate({ method, data }) {
  if (method === 0) return data
  if (method !== 8) throw new Error('unsupported zip method')
  const stream = new Response(data).body.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
const unescape = s => s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => (
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]
))
const attr = (tag, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag); return m ? unescape(m[1]) : null }
// The text of a string item: its <t> runs, without the phonetic guide some writers add (<rPh>).
const textOf = xml => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => unescape(m[1])).join('')

// Which cell styles show a date. A date is a plain number in the file; only its format says so.
// Built-in formats 14–22 and 45–47 are dates and times; a custom one is when its code has a day,
// month or year in it outside quoted text and [colour]/[locale] brackets.
function dateStyles(xml) {
  const custom = new Map([...xml.matchAll(/<numFmt\b[^>]*>/g)].map(m => [+attr(m[0], 'numFmtId'), attr(m[0], 'formatCode') || '']))
  const isDate = id => (id >= 14 && id <= 22) || (id >= 45 && id <= 47)
    || (custom.has(id) && /[dmy]/i.test(custom.get(id).replace(/"[^"]*"|\[[^\]]*\]/g, '')))
  const xfs = /<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(xml)?.[0] || ''
  return [...xfs.matchAll(/<xf\b[^>]*>/g)].map(m => isDate(+attr(m[0], 'numFmtId')))
}

const p2 = n => String(n).padStart(2, '0')
// A spreadsheet date is days since 30 Dec 1899 (or 1 Jan 1904 in the Mac system), with the time
// of day as the fraction. Written back as text parseWhen reads.
function serialDate(n, mac) {
  const ms = Math.round((n + (mac ? 1462 : 0) - 25569) * 86400000)
  const d = new Date(ms)
  if (!isFinite(ms)) return ''
  const day = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
  return n % 1 ? `${day} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` : day
}

const colIndex = ref => {
  const letters = /^[A-Z]+/.exec(ref || '')?.[0]
  if (!letters) return -1
  let n = 0
  for (const c of letters) n = n * 26 + c.charCodeAt(0) - 64
  return n - 1
}

function sheetRows(xml, strings, dates, mac) {
  const rows = []
  for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = []
    for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = colIndex(attr(c[1], 'r'))
      const i = at < 0 ? row.length : at
      const type = attr(c[1], 't')
      const body = c[2] || ''
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      let val = ''
      if (type === 's') val = strings[+raw] ?? ''
      else if (type === 'inlineStr') val = textOf(body)
      else if (type === 'str' || type === 'b') val = raw != null ? unescape(raw) : ''
      else if (type !== 'e' && raw != null) {
        const n = parseFloat(raw)
        val = dates[+attr(c[1], 's') || 0] && isFinite(n) ? serialDate(n, mac) : raw
      }
      while (row.length < i) row.push('')
      row[i] = val
    }
    if (row.some(x => x !== '')) rows.push(row)
  }
  return rows
}

/** An .xlsx file's bytes -> its sheets in workbook order, each as `{ name, rows }`. */
export async function readXlsx(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (!looksLikeZip(bytes)) throw new Error('not an xlsx')
  const zip = zipEntries(bytes)
  const dec = new TextDecoder()
  // Some generators prefix every tag (<x:row>, <x:c>); dropped once here so the scans see one shape.
  const read = async path => { const e = zip.get(path); return e ? dec.decode(await inflate(e)).replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1') : '' }

  const book = await read('xl/workbook.xml')
  if (!book) throw new Error('not an xlsx')
  const rels = new Map([...(await read('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b[^>]*>/g)]
    .map(m => [attr(m[0], 'Id'), attr(m[0], 'Target') || '']))
  const strings = [...(await read('xl/sharedStrings.xml')).matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map(m => textOf(m[1] || ''))
  const dates = dateStyles(await read('xl/styles.xml'))
  const mac = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(book)

  const sheets = []
  for (const m of book.matchAll(/<sheet\b[^>]*>/g)) {
    const target = rels.get(attr(m[0], 'r:id'))
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target
    sheets.push({ name: attr(m[0], 'name') || '', rows: sheetRows(await read(path), strings, dates, mac) })
  }
  return sheets
}
