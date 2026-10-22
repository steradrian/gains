import { describe, expect, it } from 'vitest'
import { groupLink, parseGroupLink } from './group-link.js'

describe('parseGroupLink', () => {
  it('takes a bare code, trimmed, in any case', () => {
    expect(parseGroupLink('  k7Qp9x2Lm  ')).toBe('k7Qp9x2Lm')
    expect(parseGroupLink('K7QP9X2LM')).toBe('K7QP9X2LM')
    expect(parseGroupLink('abc-DEF_123')).toBe('abc-DEF_123')
  })

  it('takes a full group link, with or without a query or a trailing slash', () => {
    expect(parseGroupLink('https://gains.example.com/g/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
    expect(parseGroupLink('HTTPS://gains.example.com/app/g/k7Qp9x2Lm/')).toBe('k7Qp9x2Lm')
    expect(parseGroupLink('https://gains.example.com/g/k7Qp9x2Lm?utm=chat')).toBe('k7Qp9x2Lm')
  })

  it('takes a hash link and the app\'s own join address', () => {
    expect(parseGroupLink('https://gains.example.com/#/g/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
    expect(parseGroupLink('#/g/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
    expect(parseGroupLink('/#/g/k7Qp9x2Lm/')).toBe('k7Qp9x2Lm')
    expect(parseGroupLink('#/me/groups/join/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
  })

  it('rejects junk, empty text, short codes, spaces and an app invite link', () => {
    for (const bad of ['', '   ', null, undefined, 'hello world', 'abc', 'two words here', 'https://example.com', 'https://gains.example.com/join/k7Qp9x2Lm', 'https://gains.example.com/g/', '<script>alert(1)</script>']) {
      expect(parseGroupLink(bad), String(bad)).toBeNull()
    }
  })
})

describe('groupLink', () => {
  it('builds <base>/g/<code> from where the app is served', () => {
    expect(groupLink('k7Qp9x2Lm', { remote: null, loc: { origin: 'https://gains.example.com', pathname: '/gym/index.html' } }))
      .toBe('https://gains.example.com/gym/g/k7Qp9x2Lm')
  })

  it('uses the paired server in the phone app', () => {
    expect(groupLink('k7Qp9x2Lm', { remote: 'https://srv.example.com/', loc: { origin: 'capacitor://localhost', pathname: '/' } }))
      .toBe('https://srv.example.com/g/k7Qp9x2Lm')
  })

  it('round-trips through the parser', () => {
    expect(parseGroupLink(groupLink('k7Qp9x2Lm', { remote: null, loc: { origin: 'https://a.b', pathname: '/' } }))).toBe('k7Qp9x2Lm')
  })
})
