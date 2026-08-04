import type { AppSchema } from './types'

/**
 * Character assets: images a character can show mid-reply.
 *
 * The model never sees a URL. It is told the asset names and asked to emit a tag, which is
 * swapped for an image when the message is rendered. That keeps the model from inventing
 * paths, and keeps a stored message portable -- it holds the name, not a URL that may move.
 *
 * RisuAI uses `{{asset::name}}`; older Agnai prompts used `{{asset:name}}`. Both forms are
 * accepted so imported cards and existing chats render identically.
 */

/** Global and case-insensitive: models are inconsistent about capitalising a tag. */
export const ASSET_TAG_PATTERN = /\{\{\s*asset\s*::?\s*([^{}]+?)\s*\}\}/gi

const normalise = (name: string) => name.trim().toLowerCase()

export function findAsset(assets: AppSchema.CharacterAsset[] | undefined, name: string) {
  if (!assets?.length) return undefined
  const wanted = normalise(name)
  return assets.find((asset) => normalise(asset.name) === wanted)
}

/**
 * The block appended to the prompt when the replying character has assets. Injected
 * automatically rather than through a placeholder: an asset the model was never told about is
 * an asset it can never show, so this must not depend on the user editing a template.
 */
export function assetInstruction(
  assets: AppSchema.CharacterAsset[] | undefined,
  characterName = '{{char}}'
): string {
  const names = (assets ?? []).map((asset) => asset.name.trim()).filter(Boolean)
  if (!names.length) return ''

  return [
    `${characterName} can show an image by writing {{asset::name}} on its own line, using one of these names exactly:`,
    names.map((name) => `- ${name}`).join('\n'),
    'Only these names exist. Do not invent a name, describe the image in the tag, or write a URL.',
  ].join('\n')
}

/** Appends the instruction to an assembled prompt, nearest the reply. */
export function withAssetInstruction(
  prompt: string,
  assets: AppSchema.CharacterAsset[] | undefined,
  characterName?: string
) {
  const instruction = assetInstruction(assets, characterName)
  return instruction ? `${prompt}\n\n${instruction}` : prompt
}

export type AssetInstructionMessage = { role: string; content: string }

/**
 * Adds the same mandatory asset instruction to structured chat messages. Chat adapters consume
 * these messages instead of the flat prompt, so updating only `prompt` silently drops the list.
 * Merge into the first system message when possible; otherwise create one before the conversation.
 */
export function withAssetInstructionMessages<T extends AssetInstructionMessage>(
  messages: T[],
  assets: AppSchema.CharacterAsset[] | undefined,
  characterName?: string
): T[] {
  const instruction = assetInstruction(assets, characterName)
  if (!instruction) return messages

  const systemIndex = messages.findIndex((message) => message.role === 'system')
  if (systemIndex === -1) {
    return [{ role: 'system', content: instruction } as T, ...messages]
  }

  return messages.map((message, index) =>
    index === systemIndex
      ? ({ ...message, content: `${message.content}\n\n${instruction}` } as T)
      : message
  )
}

/**
 * Replaces every asset tag in `text`. `toMarkup` receives the matched asset, or undefined
 * when the model named one that does not exist -- the caller decides what an unknown tag
 * should look like rather than this module guessing.
 */
export function replaceAssetTags(
  text: string,
  assets: AppSchema.CharacterAsset[] | undefined,
  toMarkup: (asset: AppSchema.CharacterAsset | undefined, name: string) => string
): string {
  return text.replace(ASSET_TAG_PATTERN, (_match, rawName: string) => {
    const name = rawName.trim()
    return toMarkup(findAsset(assets, name), name)
  })
}

/** True when the text contains at least one asset tag. */
export function hasAssetTag(text: string) {
  // `test` on a global regex is stateful, so a fresh one is used rather than the shared const.
  return new RegExp(ASSET_TAG_PATTERN.source, 'i').test(text)
}
