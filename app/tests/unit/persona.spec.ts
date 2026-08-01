import { describe, expect, it } from 'vitest'
import {
  PERSONA_ID_PREFIX,
  fromImpersonateId,
  toImpersonate,
  toImpersonateId,
} from '/common/persona'
import type { AppSchema } from '/common/types'

const persona: AppSchema.UserPersona = {
  kind: 'persona',
  _id: 'persona-1',
  userId: 'user-1',
  name: 'Wren',
  persona: { kind: 'text', attributes: { text: ['A tired courier.'] } },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('persona to impersonate', () => {
  /*
   * The prefix is load-bearing. `ensureBotMembership` (srv/api/chat/message.ts) looks the
   * impersonate id up in the character collection and answers 403 when it is not the caller's
   * character -- which a persona never is. It skips that check for `temp-` ids only.
   */
  it('produces a temp id, which is what skips the character ownership check', () => {
    expect(toImpersonateId('persona-1').startsWith('temp-')).toBe(true)
    expect(toImpersonate(persona)._id.startsWith('temp-')).toBe(true)
  })

  it('round-trips the persona id, so a stored message can be traced back', () => {
    expect(fromImpersonateId(toImpersonateId('persona-1'))).toBe('persona-1')
  })

  it('yields nothing for an id that is not a persona', () => {
    expect(fromImpersonateId('char-1')).toBeUndefined()
    expect(fromImpersonateId('temp-something-else')).toBeUndefined()
  })

  it('carries the name and persona the prompt reads', () => {
    const impersonate = toImpersonate(persona)
    expect(impersonate.name).toBe('Wren')
    expect(impersonate.persona).toEqual(persona.persona)
  })

  it('is a character as far as every consumer is concerned', () => {
    const impersonate = toImpersonate(persona)
    expect(impersonate.kind).toBe('character')
    // The send endpoint reads `userId` when it does look a character up.
    expect(impersonate.userId).toBe('user-1')
  })

  it('does not smuggle a greeting or scenario into the chat', () => {
    const impersonate = toImpersonate(persona)
    expect(impersonate.greeting).toBe('')
    expect(impersonate.scenario).toBe('')
    expect(impersonate.sampleChat).toBe('')
  })

  it('exports the prefix rather than leaving callers to spell it', () => {
    expect(toImpersonateId('x')).toBe(`${PERSONA_ID_PREFIX}x`)
  })
})
