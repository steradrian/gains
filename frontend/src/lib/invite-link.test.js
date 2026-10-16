// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api.js', () => ({ remoteServer: () => '' }))

const { inviteLink, canShareLink, shareLink } = await import('./invite-link.js')

afterEach(() => { vi.unstubAllGlobals(); delete navigator.share })

describe('inviteLink', () => {
  it('is the app origin plus /join/<code>', () => {
    expect(inviteLink('ABCD1234', { remote: '', loc: { origin: 'https://gym.example.com', pathname: '/' } }))
      .toBe('https://gym.example.com/join/ABCD1234')
  })

  it('keeps a subpath install under its base, dropping index.html', () => {
    expect(inviteLink('ABCD1234', { remote: '', loc: { origin: 'https://example.com', pathname: '/myGym/index.html' } }))
      .toBe('https://example.com/myGym/join/ABCD1234')
  })

  it('uses the paired server in the mobile app, not the shell origin', () => {
    expect(inviteLink('ABCD1234', { remote: 'https://gym.example.com/', loc: { origin: 'capacitor://localhost', pathname: '/' } }))
      .toBe('https://gym.example.com/join/ABCD1234')
  })
})

describe('sharing', () => {
  it('reports the share sheet as unavailable without navigator.share', () => {
    expect(canShareLink()).toBe(false)
  })

  it('shares the link through navigator.share when it exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    navigator.share = share
    expect(canShareLink()).toBe(true)
    expect(await shareLink('https://x/join/A', 'Gains')).toBe(true)
    expect(share).toHaveBeenCalledWith({ title: 'Gains', url: 'https://x/join/A' })
  })

  it('treats a dismissed sheet as not an error and rethrows real failures', async () => {
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    expect(await shareLink('https://x/join/A', 'Gains')).toBe(false)
    navigator.share = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(shareLink('https://x/join/A', 'Gains')).rejects.toThrow('boom')
  })
})
