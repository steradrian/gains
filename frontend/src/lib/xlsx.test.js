import { describe, expect, it } from 'vitest'
import { readXlsx } from './xlsx.js'
import { makeXlsx } from './xlsx.test-util.js'

describe('reading an .xlsx', () => {
  it('gives every sheet, in workbook order, as rows of strings', async () => {
    const book = makeXlsx([
      { name: 'First', rows: [['Name', 'Count'], ['Bench Press, Close Grip', 3]] },
      { name: 'Second', rows: [['Only']] },
    ])
    expect(await readXlsx(book)).toEqual([
      { name: 'First', rows: [['Name', 'Count'], ['Bench Press, Close Grip', '3']] },
      { name: 'Second', rows: [['Only']] },
    ])
  })

  it('writes a date-formatted number as the day it stands for', async () => {
    const book = makeXlsx([{ name: 'S', rows: [['Date'], [{ date: 46316 }], [{ date: 46316.75 }]] }])
    const [sheet] = await readXlsx(book)
    expect(sheet.rows).toEqual([['Date'], ['2026-10-21'], ['2026-10-21 18:00']])
  })

  it('keeps a skipped cell in its column and reads inline strings and escapes', async () => {
    const book = makeXlsx([{ name: 'S', rows: [['a', '', 'c'], [{ inline: 'x & <y>' }, '', 'Chin-Up ∈ SS1']] }])
    const [sheet] = await readXlsx(book)
    expect(sheet.rows).toEqual([['a', '', 'c'], ['x & <y>', '', 'Chin-Up ∈ SS1']])
  })

  it('reads entries stored without compression too', async () => {
    const [sheet] = await readXlsx(makeXlsx([{ name: 'S', rows: [['ok']] }], { stored: true }))
    expect(sheet.rows).toEqual([['ok']])
  })

  it('reads a workbook whose tags carry a namespace prefix', async () => {
    const book = makeXlsx([{ name: 'S', rows: [['Date', 'Weight (kg)'], [{ date: 46316 }, 81.4]] }], { prefix: 'x' })
    const [sheet] = await readXlsx(book)
    expect(sheet).toEqual({ name: 'S', rows: [['Date', 'Weight (kg)'], ['2026-10-21', '81.4']] })
  })

  it('keeps shared-string indices right past an empty, self-closed string', async () => {
    const book = makeXlsx([{ name: 'S', rows: [['A', '', 'Z']] }], { emptySharedString: true })
    const [sheet] = await readXlsx(book)
    expect(sheet.rows).toEqual([['A', '', 'Z']])
  })

  it('refuses something that is not a spreadsheet', async () => {
    await expect(readXlsx(new TextEncoder().encode('Date,Exercise\n'))).rejects.toThrow()
    await expect(readXlsx(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).rejects.toThrow()
  })
})
