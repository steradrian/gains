import { describe, expect, it } from 'vitest'
import { editorRouteKey } from './editor-routes.js'

describe('editorRouteKey', () => {
  it('gives the three editors one key whatever the id', () => {
    for (const kind of ['foods', 'meals', 'recipes']) {
      expect(editorRouteKey(`/food/my-foods/${kind}/new`)).toBe(`/food/my-foods/${kind}/:id`)
      expect(editorRouteKey(`/food/my-foods/${kind}/12`)).toBe(`/food/my-foods/${kind}/:id`)
    }
  })

  it('leaves every other path as it is', () => {
    for (const p of ['/food', '/food/my-foods', '/food/my-foods/foods', '/food/trends', '/train/exercises', '/food/my-foods/foods/12/extra']) {
      expect(editorRouteKey(p)).toBe(p)
    }
  })

  it('keeps one editor kind apart from another', () => {
    expect(editorRouteKey('/food/my-foods/foods/3')).not.toBe(editorRouteKey('/food/my-foods/meals/3'))
  })
})
