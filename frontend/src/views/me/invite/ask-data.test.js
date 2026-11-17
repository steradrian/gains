import { describe, expect, it } from 'vitest'
import { askFailure, askFailureText, askedLine, askedTitle, atOpenCap, openCapLine } from './ask-data.js'

describe('askedLine', () => {
  it('reads the day the ask was made, from ms or an ISO string', () => {
    const at = new Date(2026, 9, 22, 9, 0)
    expect(askedLine({ at: at.getTime() })).toBe('Asked Thu 22 Oct')
    expect(askedLine({ at: at.toISOString() })).toBe('Asked Thu 22 Oct')
  })
  it('is just "Asked" when the record has no time', () => {
    expect(askedLine({})).toBe('Asked')
  })
})

describe('askedTitle', () => {
  it('is the note, else a plain label', () => {
    expect(askedTitle({ note: 'Andrei' })).toBe('Andrei')
    expect(askedTitle({ note: '' })).toBe('Asked for an invite')
  })
})

describe('the open cap', () => {
  it('is reached at 3 and says so', () => {
    expect(atOpenCap([1, 2])).toBe(false)
    expect(atOpenCap([1, 2, 3])).toBe(true)
    expect(openCapLine()).toBe('You have 3 open asks. Withdraw one to ask again.')
  })
})

describe('askFailure', () => {
  it('reads the 429 reason and the seconds the server gave', () => {
    expect(askFailure({ status: 429, data: { reason: 'daily', retryAfter: 7200 } })).toEqual({ kind: 'daily', retryAfter: 7200 })
    expect(askFailure({ status: 429, data: { reason: 'open', retryAfter: 86400 } })).toEqual({ kind: 'open', retryAfter: null })
  })
  it('treats an error with no status as offline, retryable', () => {
    expect(askFailure(new Error('timeout')).kind).toBe('offline')
  })
  it('keeps the message of any other refusal', () => {
    expect(askFailure({ status: 400, message: 'Nope' })).toEqual({ kind: 'other', retryAfter: null, message: 'Nope' })
  })
})

describe('askFailureText', () => {
  it('names the daily cap and the wait', () => {
    expect(askFailureText({ kind: 'daily', retryAfter: 2 * 3600 })).toBe('You’ve asked 3 times today. Try again in 2h 0m.')
    expect(askFailureText({ kind: 'daily', retryAfter: 10 })).toBe('You’ve asked 3 times today. Try again in 1 min.')
    expect(askFailureText({ kind: 'daily', retryAfter: null })).toBe('You’ve asked 3 times today. Try again later.')
  })
  it('names the open cap without promising a time', () => {
    expect(askFailureText({ kind: 'open' })).toBe('You have 3 open asks. Withdraw one to ask again.')
  })
  it('asks to check the connection when offline', () => {
    expect(askFailureText({ kind: 'offline' })).toBe('Couldn’t send your ask. Check your connection and try again.')
  })
})
