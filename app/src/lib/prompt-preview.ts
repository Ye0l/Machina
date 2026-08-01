import type { AppSchema, TokenCounter } from '/common/types'
import { toBotMsg, toChar, toChat, toPersona, toProfile, toUser, toUserMsg } from '/common/dummy'
import { buildPromptPlaceholders } from '/common/prompt'
import { parseTemplate } from '/common/template-parser'
import { replaceTags } from '/common/presets/templates'
import { getEncoder } from '/common/tokenize'

/**
 * Renders a prompt template against sample data, so the preset editor can show what a template
 * actually produces before it is used on a real chat.
 *
 * The sample cast mirrors the legacy previewer (`web/shared/PromptEditor/index.tsx`): the
 * settings screen is global and has no chat in scope, so every placeholder has to be fed from
 * invented data rather than the conversation the user happens to have open.
 */

const SAMPLE = (() => {
  const char = toChar('Rory', {
    scenario: 'Rory is strolling in the park',
    persona: toPersona('Rory is very talkative.'),
  })
  const replyAs = toChar('Robot', { persona: toPersona('Robot likes coffee') })
  const sender = toProfile('Author')
  const { user } = toUser('Author')
  const chat = toChat(char)
  const characters = Object.fromEntries([char, replyAs].map((item) => [item._id, item]))

  const history = [
    toBotMsg(char, 'Hi, nice to meet you!'),
    toUserMsg(sender, 'Nice to meet you too.'),
    toBotMsg(replyAs, 'I am also here.'),
    toUserMsg(sender, `I'm glad you're here.`),
  ]

  const lines = history.map((message) =>
    message.characterId
      ? `${characters[message.characterId].name}: ${message.msg}`
      : `${sender.handle}: ${message.msg}`
  )

  return { char, replyAs, sender, user, chat, characters, lines }
})()

export type PromptPreview = {
  text: string
  tokens: number
}

/**
 * `encoder` is injectable because the real one loads a tokenizer; tests supply a trivial
 * counter rather than standing that up.
 */
export async function renderPromptPreview(
  template: string,
  settings: Partial<AppSchema.GenSettings> | undefined,
  encoder?: TokenCounter
): Promise<PromptPreview> {
  const count = encoder ?? (await getEncoder())
  const { char, replyAs, sender, user, chat, characters, lines } = SAMPLE

  const parts = await buildPromptPlaceholders(
    {
      char,
      characters,
      chat,
      members: [sender],
      replyAs,
      user,
      sender,
      kind: 'send',
      chatEmbeds: [],
      userEmbeds: [],
      settings,
      resolvedScenario: char.scenario,
    },
    lines,
    count
  )

  let { parsed } = await parseTemplate(template, {
    char,
    replyAs,
    sender,
    characters,
    chat,
    lines,
    parts,
    jsonValues: {},
  })

  // The instruct tags a model family expects are substituted last, exactly as generation does.
  if (settings?.modelFormat) parsed = replaceTags(parsed, settings.modelFormat)

  return { text: parsed, tokens: await count(parsed) }
}
