import type { AppSchema } from './types'

/**
 * The prefix that lets a persona ride the `impersonate` field.
 *
 * `impersonate` is typed as a `Character`, and `ensureBotMembership`
 * (`srv/api/chat/message.ts`) looks the id up in the character collection and rejects the send
 * with a 403 when it does not belong to the caller. A persona is not a character, so it would
 * always fail that check -- except the same function deliberately skips it for ids prefixed
 * `temp-`, which is the seam a persona travels through.
 *
 * The prefix is kept parseable so a stored message can be traced back to the persona that
 * wrote it: the server stamps `characterId` with whatever id it is given.
 */
export const PERSONA_ID_PREFIX = 'temp-persona-'

export const toImpersonateId = (personaId: string) => `${PERSONA_ID_PREFIX}${personaId}`

export const fromImpersonateId = (id: string) =>
  id.startsWith(PERSONA_ID_PREFIX) ? id.slice(PERSONA_ID_PREFIX.length) : undefined

/**
 * A persona in the character shape the send endpoint and the prompt assembler expect. Only
 * the fields either of them reads are populated: the name that replaces the user's handle and
 * the persona text that becomes `{{impersonating}}`.
 */
export function toImpersonate(persona: AppSchema.UserPersona): AppSchema.Character {
  return {
    _id: toImpersonateId(persona._id),
    kind: 'character',
    userId: persona.userId,
    name: persona.name,
    persona: persona.persona,
    avatar: persona.avatar,
    description: '',
    greeting: '',
    scenario: '',
    sampleChat: '',
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
    favorite: false,
  }
}
