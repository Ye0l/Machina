import { Persona } from './library'

/**
 * A user persona: who *you* are in a conversation, as opposed to a character you talk to.
 *
 * The prompt layer has no notion of this. `impersonate` on a send is a `Character`, so a
 * persona is converted to a character shape on its way out (see `toImpersonate` in
 * `common/persona.ts`). Keeping the stored entity separate is the point: personas do not
 * belong in the character library and are not selectable as someone to chat with.
 */
export interface UserPersona {
  kind: 'persona'
  _id: string
  userId: string
  name: string
  /** Reuses the character persona shape so it reaches the prompt through the same path. */
  persona: Persona
  avatar?: string
  createdAt: string
  updatedAt: string
}

export type NewPersona = {
  name: string
  persona: Persona
}
