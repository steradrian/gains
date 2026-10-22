// @vitest-environment happy-dom
// /g/:code, the address a group link opens, goes straight on to the join page for that code.
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useView } from '../../ds/render.test-util.js'
import GroupLinkRedirect from './GroupLinkRedirect.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const view = useView()
let here = null
function Probe() { here = useLocation(); return null }

describe('/g/:code', () => {
  it('redirects (replacing the entry) to the join page for the code', () => {
    view.render(
      <MemoryRouter initialEntries={['/g/k7Qp9x2Lm']}>
        <Routes><Route path="/g/:code" element={<GroupLinkRedirect />} /><Route path="*" element={null} /></Routes>
        <Probe />
      </MemoryRouter>,
    )
    expect(here.pathname).toBe('/me/groups/join/k7Qp9x2Lm')
  })
})
