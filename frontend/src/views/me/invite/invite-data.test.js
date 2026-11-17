import { describe, expect, it } from 'vitest'
import { fmtDate, isoOf } from '../../../lib/format.js'
import { askLine, askTitle, createdMessage, expiredLine, inviteTitle, joinedLine, joinedTitle, waitingLine } from './invite-data.js'

const at = (m, d) => new Date(2026, m - 1, d, 12, 0).getTime()
const D = ms => fmtDate(isoOf(new Date(ms)), true)

describe('titles', () => {
  it('use the name from the record, else "Invite" and four characters of the code', () => {
    expect(inviteTitle({ code: 'A1B2C3D4E5F60718', name: 'Mara' })).toBe('Mara')
    expect(inviteTitle({ code: 'A1B2C3D4E5F60718' })).toBe('Invite A1B2…')
  })

  it('name who joined first, then who it was made for', () => {
    expect(joinedTitle({ code: 'AAAA1111', name: 'Mara', usedByName: 'Radu' })).toBe('Radu')
    expect(joinedTitle({ code: 'AAAA1111', name: 'Mara' })).toBe('Mara')
  })
})

describe('the lines under a row', () => {
  it('Waiting reads "Waiting · expires" and the day', () => {
    expect(waitingLine({ expiresAt: new Date(at(10, 22)).toISOString() })).toBe(`Waiting · expires ${D(at(10, 22))}`)
    expect(waitingLine({})).toBe('Waiting')
  })

  it('an invite made in this visit reads created now, and where the link went', () => {
    expect(waitingLine({}, 'copied')).toBe('Waiting · created now · link copied')
    expect(waitingLine({}, 'shared')).toBe('Waiting · created now · link shared')
    expect(waitingLine({}, 'none')).toBe('Waiting · created now')
  })

  it('Joined and Expired name the day, and say no more than the record knows', () => {
    expect(joinedLine({ usedAt: new Date(at(10, 5)).toISOString() })).toBe(`Joined ${D(at(10, 5))}`)
    expect(joinedLine({})).toBe('Joined')
    expect(expiredLine({ expiresAt: new Date(at(10, 12)).toISOString() })).toBe(`Expired ${D(at(10, 12))}`)
    expect(expiredLine({})).toBe('Expired')
  })

  it('an ask shows the note, else the day it was made', () => {
    expect(askTitle({ name: 'Dana' })).toBe('Dana')
    expect(askTitle({ name: null })).toBe('A member')
    expect(askLine({ note: 'My training partner' })).toBe('My training partner')
    expect(askLine({ note: '', at: new Date(at(10, 20)).toISOString() })).toBe(`Asked ${D(at(10, 20))}`)
    expect(askLine({ note: '' })).toBe('Asked for an invite')
  })
})

describe('createdMessage', () => {
  it('names the invitee and says what happened to the link', () => {
    expect(createdMessage('Andrei', 'copied')).toBe('Invite for Andrei created and link copied')
    expect(createdMessage(undefined, 'copied')).toBe('Invite created and invite link copied')
    expect(createdMessage('Andrei', 'shared')).toBe('Invite for Andrei created')
    expect(createdMessage(undefined, 'shared')).toBe('Invite created')
  })

  it('sends the admin to the list when the link went nowhere', () => {
    expect(createdMessage('Andrei', null)).toBe('Invite created. Copy its invite link from the list.')
  })
})
