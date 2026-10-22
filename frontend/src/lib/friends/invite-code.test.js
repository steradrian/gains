import { describe, expect, it } from 'vitest'
import { parseInviteInput } from './invite-code.js'

describe('parseInviteInput', () => {
  it('takes a bare code, trimmed', () => {
    expect(parseInviteInput('  k7Qp9x2Lm  ')).toBe('k7Qp9x2Lm')
    expect(parseInviteInput('abc-DEF_123')).toBe('abc-DEF_123')
  })

  it('takes the group link a friend sent, with or without a query or a trailing slash', () => {
    expect(parseInviteInput('https://gains.example.com/g/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
    expect(parseInviteInput('https://gains.example.com/app/g/k7Qp9x2Lm/')).toBe('k7Qp9x2Lm')
    expect(parseInviteInput('https://gains.example.com/g/k7Qp9x2Lm?utm=chat')).toBe('k7Qp9x2Lm')
  })

  it('takes the app\'s own join address', () => {
    expect(parseInviteInput('https://gains.example.com/#/me/groups/join/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
    expect(parseInviteInput('#/me/groups/join/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
  })

  it('rejects junk, empty text, a code that is too short or has spaces, and an app invite link', () => {
    for (const bad of ['', '   ', null, undefined, 'hello world', 'abc', 'two words here', 'https://example.com', 'https://gains.example.com/join/k7Qp9x2Lm', 'https://gains.example.com/g/', '<script>alert(1)</script>']) {
      expect(parseInviteInput(bad), String(bad)).toBeNull()
    }
  })
})
