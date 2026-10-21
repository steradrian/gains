import { afterEach, describe, expect, it } from 'vitest'
import { t, tn, tnShown, _setLangState } from './i18n-core.js'
import ru from '../locales/ru.js'
import uk from '../locales/uk.js'
import pl from '../locales/pl.js'
import de from '../locales/de.js'

// tnShown (Train finding 21): a count shown formatted ("6.6", "1,200") still picks its plural form
// from the number. t('{0} sets', fmtNum(n)) handed t() a string, so no form was chosen: "2 подходов".
describe('tnShown()', () => {
  afterEach(() => _setLangState('en', {}, null, null))
  const sets = (n, shown = String(n)) => tnShown('{0} set', '{0} sets', n, shown)

  it('is tn() for a plain count', () => {
    _setLangState('ru', ru, null, null)
    for (const n of [1, 2, 5, 11, 21]) expect(sets(n)).toBe(tn('{0} set', '{0} sets', n))
  })

  it('splits English one / other on the number and prints the shown text', () => {
    expect(sets(1, '1')).toBe('1 set')
    expect(sets(6.6, '6.6')).toBe('6.6 sets')
    expect(sets(1200, '1,200')).toBe('1,200 sets')
    expect(sets(0, '0')).toBe('0 sets')
  })

  it('picks the Russian, Ukrainian and Polish forms from the number, not from the string', () => {
    _setLangState('ru', ru, null, null)
    expect([1, 2, 5, 22].map(n => sets(n))).toEqual(['1 подход', '2 подхода', '5 подходов', '22 подхода'])
    _setLangState('uk', uk, null, null)
    expect([1, 2, 5].map(n => sets(n))).toEqual(['1 підхід', '2 підходи', '5 підходів'])
    _setLangState('pl', pl, null, null)
    expect([1, 2, 5].map(n => sets(n))).toEqual(['1 seria', '2 serie', '5 serii'])
  })

  it('shows a formatted count (a thousands separator) under the form the number picks', () => {
    _setLangState('ru', ru, null, null)
    expect(sets(1200, '1 200')).toBe('1 200 подходов')
    expect(sets(21, '21,0')).toBe('21,0 подход')
  })

  it('fills later placeholders after the shown text', () => {
    _setLangState('ru', ru, null, null)
    expect(tnShown('{0} set · {1} work', '{0} sets · {1} work', 2, '2,0', 3)).toBe('2,0 подхода · 3 рабочих')
  })

  it('leaves a two-form language on its plain strings', () => {
    _setLangState('de', de, null, null)
    expect(sets(1)).toBe(de['{0} set'].replace('{0}', '1'))
    expect(sets(3)).toBe(de['{0} sets'].replace('{0}', '3'))
  })

  it('plain t() with a formatted string is what picked no form, which tnShown replaces', () => {
    _setLangState('ru', ru, null, null)
    expect(t('{0} sets', '2')).not.toBe('2 подхода')
  })
})
