#!/usr/bin/env node
// Drawer geometry on an installed iPhone app, in WebKit (Playwright), against the real app.
//
//   node scripts/drawer-viewport-check.mjs          # exit 1 when a check fails
//
// Needs Playwright's WebKit once: npx playwright install webkit
//
// An iPhone 15 Pro Max (430 x 932, safe areas 59 top, 34 bottom) on the Home Screen, with the
// exercise config drawer of a routine open (Walking On Incline Treadmill). env() cannot be faked,
// so the insets come in through --native-sat/--native-sab, which the app takes as a floor;
// visualViewport, screen.height and navigator.standalone are stubbed. Four viewports:
//
//   vv-short   the layout viewport whole (932), the visual viewport 59 short: the first guess at
//              the band. The drawer must still stand on the bottom edge (--kb 0).
//   stuck      WebKit bug 301994 and kin: once a keyboard has been up, innerHeight, the visual
//              viewport and 100dvh stay at 873. Every fixed box ends 59 above the screen's edge and
//              WebKit fills the strip below with the page's background (the beige band on device,
//              rgb(245, 244, 241)). No box can draw there, so the page's background must be the
//              drawer's while it is up, and the foot must not keep the inset that is now below it.
//   keyboard   a 336px keyboard: the drawer stands flush on it.
//   clip       the drawer body must not be wider inside than out, nor stay scrolled sideways (its
//              content was cut off at the left edge on device).
import { fileURLToPath } from 'node:url'
import { webkit } from 'playwright'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const SCREEN = 932, SAT = 59, SAB = 34, KEYBOARD = 336
const SCENARIOS = {
  'vv-short': { innerHeight: SCREEN, vv: SCREEN - SAT },
  stuck: { innerHeight: SCREEN - SAT, vv: SCREEN - SAT },
  keyboard: { innerHeight: SCREEN, vv: SCREEN - KEYBOARD },
  clip: { innerHeight: SCREEN, vv: SCREEN },
}

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const STATE = { lang: 'en', theme: 'light', onboarded: true }

// Silent: every API call is answered here, and the dev proxy's complaints about a request that
// slips past (a beacon as the page goes) are not this check's business.
const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
await server.listen()
const base = server.resolvedUrls.local[0]
const browser = await webkit.launch()
let failed = false
const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`); if (!ok) failed = true }

async function open(scenario) {
  const { innerHeight, vv } = SCENARIOS[scenario]
  const ctx = await browser.newContext({ viewport: { width: 430, height: innerHeight }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await ctx.route(url => url.pathname.startsWith('/api/'), route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/me') return json(route, { user: { id: 'u1', name: 'Maria', synced: true } })
    if (p === '/api/config') return json(route, {})
    if (p === '/api/data/rev') return json(route, { rev: 1, wid: 'check' })
    if (p === '/api/data') return json(route, { state: STATE, rev: 1, wid: 'check' })
    return json(route, {}, 404)
  })
  await ctx.addInitScript(({ vv, sat, sab, screenH, state }) => {
    const viewport = Object.assign(new EventTarget(), { offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 })
    Object.defineProperty(viewport, 'height', { get: () => vv })
    Object.defineProperty(viewport, 'width', { get: () => window.innerWidth })
    Object.defineProperty(window, 'visualViewport', { get: () => viewport, configurable: true })
    Object.defineProperty(window.screen, 'height', { get: () => screenH, configurable: true })
    Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true })
    const insets = () => {
      document.documentElement.style.setProperty('--native-sat', sat + 'px')
      document.documentElement.style.setProperty('--native-sab', sab + 'px')
    }
    if (document.documentElement) insets()
    else new MutationObserver((_, o) => { if (document.documentElement) { insets(); o.disconnect() } }).observe(document, { childList: true })
    localStorage.setItem('gym_state_v1', JSON.stringify(state))
  }, { vv, sat: SAT, sab: SAB, screenH: SCREEN, state: STATE })
  const page = await ctx.newPage()
  await page.goto(base)
  await page.waitForSelector('#app', { timeout: 90000 })
  await page.evaluate(async () => {
    const { exConfigSheet } = await import('/src/sheets.jsx')
    const { exOr } = await import('/src/lib/exercises.js')
    const { defaultConfig } = await import('/src/lib/history.js')
    const slot = { ...defaultConfig('3666'), id: '3666' }
    exConfigSheet(exOr('3666'), slot, () => {}, () => {}, { id: 'r1', name: 'New routine', ex: [slot] }, null, () => {}, undefined,
      { removeUndo: true, part: 'warmup', onPartChange: () => {} })
  })
  await page.waitForSelector('#modal-root .g-bs')
  await page.waitForTimeout(800)
  return { ctx, page }
}

const measure = page => page.evaluate(() => {
  const html = document.documentElement
  const sheet = document.querySelector('#modal-root .g-bs')
  const body = sheet.querySelector('.g-bs-body')
  const box = el => el.getBoundingClientRect()
  return {
    innerHeight, vvHeight: visualViewport.height,
    kb: html.style.getPropertyValue('--kb'), vpShort: html.style.getPropertyValue('--vp-short'),
    modalRoot: box(document.getElementById('modal-root')).height,
    sheetTop: box(sheet).top, sheetBottom: box(sheet).bottom, sheetPad: getComputedStyle(sheet).paddingBottom,
    sheetBg: getComputedStyle(sheet).backgroundColor, pageBg: getComputedStyle(html).backgroundColor,
    bodyScrollWidth: body.scrollWidth, bodyClientWidth: body.clientWidth,
  }
})

try {
  {
    const { ctx, page } = await open('vv-short')
    const m = await measure(page)
    check('vv-short', m.modalRoot === SCREEN && m.sheetBottom === SCREEN && m.kb === '0px',
      `#modal-root ${m.modalRoot}, drawer ${m.sheetTop}..${m.sheetBottom}, gap to the screen's edge ${SCREEN - m.sheetBottom}, --kb ${m.kb}`)
    await ctx.close()
  }
  {
    const { ctx, page } = await open('stuck')
    const m = await measure(page)
    check('stuck', m.pageBg === m.sheetBg && m.vpShort === `${SAT}px` && m.sheetPad === '30px',
      `#modal-root ${m.modalRoot}, drawer ${m.sheetTop}..${m.sheetBottom}, strip under it ${SCREEN - m.sheetBottom}px in ${m.pageBg} (drawer ${m.sheetBg}), foot padding ${m.sheetPad}, --vp-short ${m.vpShort || 'unset'}`)
    await ctx.close()
  }
  {
    const { ctx, page } = await open('keyboard')
    const m = await measure(page)
    check('keyboard', m.sheetBottom === m.vvHeight && m.kb === `${KEYBOARD}px`,
      `drawer bottom ${m.sheetBottom}, keyboard top ${m.vvHeight}, gap ${m.vvHeight - m.sheetBottom}, --kb ${m.kb}`)
    await ctx.close()
  }
  {
    const { ctx, page } = await open('clip')
    const m = await measure(page)
    const after = await page.evaluate(async () => {
      const body = document.querySelector('#modal-root .g-bs-body')
      body.scrollLeft = 999
      await new Promise(r => setTimeout(r, 100))
      return body.scrollLeft
    })
    check('clip', m.bodyScrollWidth === m.bodyClientWidth && after === 0,
      `body scrollWidth ${m.bodyScrollWidth}, clientWidth ${m.bodyClientWidth}, scrollLeft after a sideways scroll ${after}`)
    await ctx.close()
  }
} finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)
