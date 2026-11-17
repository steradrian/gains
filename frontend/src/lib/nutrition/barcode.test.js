// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { barcodeProblem, formatBarcode, normalizeBarcode, upcEToUpcA } from './barcode.js'

describe('normalizeBarcode', () => {
  it('keeps an EAN-13 and an EAN-8 as they are', () => {
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003')
    expect(normalizeBarcode('96385074')).toBe('96385074')
  })

  it('files a UPC-A under its EAN-13', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
  })

  it('refuses what is not 8 to 14 digits', () => {
    expect(normalizeBarcode('1234567')).toBeNull()
    expect(normalizeBarcode('hello')).toBeNull()
  })

  it('expands a UPC-E to the UPC-A it compresses, then to its EAN-13', () => {
    expect(upcEToUpcA('01234565')).toBe('012345000065')
    expect(normalizeBarcode('01234565')).toBe('0012345000065')
  })

  it.each([
    ['04252614', '042100005264'], // last digit 4
    ['01234537', '012300000457'], // last digit 3
    ['01234565', '012345000065'], // last digit 5-9
  ])('expands every UPC-E form (%s)', (e, a) => {
    expect(upcEToUpcA(e)).toBe(a)
  })

  it('leaves an 8-digit code whose UPC-A check fails as an EAN-8', () => {
    expect(normalizeBarcode('01234560')).toBe('01234560')
  })
})

describe('barcodeProblem', () => {
  it.each(['3017620422003', '3017 6204 22003', '96385074', '036000291452', '01234565'])('lets %s through', raw => {
    expect(barcodeProblem(raw)).toBeNull()
  })

  it('says length for what is not 8 to 14 digits', () => {
    expect(barcodeProblem('')).toBe('length')
    expect(barcodeProblem('30176')).toBe('length')
    expect(barcodeProblem('hello')).toBe('length')
  })

  it('says check when the digits are there but the last one does not match the others', () => {
    expect(barcodeProblem('3017620422004')).toBe('check')
    expect(barcodeProblem('96385075')).toBe('check')
  })
})

describe('formatBarcode', () => {
  it('writes an EAN-13 as 1-6-6 and an EAN-8 as 4-4, and leaves anything else', () => {
    expect(formatBarcode('5941234567899')).toBe('5 941234 567899')
    expect(formatBarcode('96385074')).toBe('9638 5074')
    expect(formatBarcode('12345678901234')).toBe('12345678901234')
  })
})
