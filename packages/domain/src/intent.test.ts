import { describe, it, expect } from 'vitest'
import { classifyHighIntentDeterministic, DEMO_HIGH_INTENT_PHRASE } from './intent'

describe('classifyHighIntentDeterministic', () => {
  it('marks the exact demo phrase as high intent', () => {
    expect(classifyHighIntentDeterministic(DEMO_HIGH_INTENT_PHRASE)).toBe(true)
  })

  it('is case- and whitespace-insensitive for the demo phrase', () => {
    expect(classifyHighIntentDeterministic('  I CAN pay   cash this week!!  ')).toBe(true)
  })

  it('does not flag ordinary browsing questions', () => {
    expect(classifyHighIntentDeterministic('How many bedrooms does 101 Palm Ave have?')).toBe(false)
  })

  it('recognizes a Spanish immediate-cash statement', () => {
    expect(classifyHighIntentDeterministic('Puedo pagar al contado esta semana')).toBe(true)
  })

  it('returns false for empty input', () => {
    expect(classifyHighIntentDeterministic('')).toBe(false)
  })
})
