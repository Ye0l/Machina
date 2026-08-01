import type { ImportedCharacter } from './character-port'

/**
 * Hand-off slot between the character library and the editor.
 *
 * Importing routes to `/character/new` rather than creating the character outright, so the
 * user reviews and saves it like any other draft. The parsed card is passed through here
 * because the editor is reached by navigation, not by a prop.
 */
class PendingImport {
  private value: ImportedCharacter | undefined

  set(character: ImportedCharacter) {
    this.value = character
  }

  /** Single-use: consuming clears the slot so a later `/character/new` opens empty. */
  take() {
    const value = this.value
    this.value = undefined
    return value
  }
}

export const pendingImport = new PendingImport()
