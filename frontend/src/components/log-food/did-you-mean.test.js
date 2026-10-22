import { describe, expect, it } from 'vitest'
import { didYouMean } from './did-you-mean.js'

const NAMES = ['Sarmale in foi de varza', 'Greek yogurt 2%', 'Mămăligă cu brânză', 'Oats']

describe('did you mean', () => {
  it('swaps a mistyped word for the nearest word of your foods', () => {
    expect(didYouMean('sarmalle', NAMES)).toBe('sarmale')
    expect(didYouMean('greek yoghurt', NAMES)).toBe('greek yogurt')
  })

  it('keeps the rest of the query as it was typed', () => {
    expect(didYouMean('sarmalle cu mamaliga', NAMES)).toBe('sarmale cu mamaliga')
  })

  it('has nothing to say when every word is spelled as a name spells it, accents aside', () => {
    expect(didYouMean('sarmale', NAMES)).toBeNull()
    expect(didYouMean('mamaliga branza', NAMES)).toBeNull()
  })

  it('has nothing to say when nothing is near, or there are no names', () => {
    expect(didYouMean('zzzzzz', NAMES)).toBeNull()
    expect(didYouMean('sarmalle', [])).toBeNull()
  })

  it('leaves short words alone: they cannot be told from other words', () => {
    expect(didYouMean('oat', NAMES)).toBeNull()
  })
})
