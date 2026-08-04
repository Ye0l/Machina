import { assertValid } from '/common/valid'
import { PERSONA_FORMATS } from '../../../common/adapters'
import { store } from '../../db'
import { NewMessage } from '../../db/messages'
import { errors, handle, StatusError } from '../wrap'
import { optional } from '/common/valid/types'
import { isDefaultPreset } from '/common/default-preset'

export const createChat = handle(async ({ body, user, authed, userId }) => {
  assertValid(
    {
      genPreset: 'string?',
      characterId: 'string',
      name: 'string',
      mode: ['standard', 'adventure', 'companion', null],
      greeting: 'string?',
      scenario: 'string?',
      sampleChat: 'string?',
      overrides: optional({ kind: PERSONA_FORMATS, attributes: 'any' }),
      useOverrides: 'boolean?',
      scenarioId: 'string?',
      impersonating: 'string?',
      imageSource: 'string?',
    },
    body
  )

  if (body.scenarioId) {
    const scenario = await store.scenario.getScenario(body.scenarioId)
    if (scenario?.userId !== userId)
      throw new StatusError('You do not have access to this scenario', 403)
  }

  const presets = await store.presets.getUserPresets(userId).then((p) => p.sort(sortPresets))
  const character = await store.characters.getCharacter(userId, body.characterId)
  const profile = await store.users.getProfile(userId)
  const impersonating = body.impersonating
    ? await store.characters.getCharacter(userId, body.impersonating)
    : undefined

  let genPreset = body.genPreset || authed?.defaultPreset || ''

  const method = genPreset
    ? isDefaultPreset(genPreset)
      ? 'default-preset'
      : 'user-preset'
    : 'no-preset'

  switch (method) {
    case 'default-preset': {
      break
    }

    case 'user-preset': {
      const match = presets.find((p) => p._id === genPreset)
      if (match) break

      const userDefault = authed?.defaultPreset
        ? presets.find((p) => p._id === authed.defaultPreset)
        : undefined
      const recent = presets[0]

      genPreset = userDefault?._id || recent?._id || 'agnaistic'
      break
    }

    case 'no-preset': {
      const userDefault = authed?.defaultPreset
        ? presets.find((p) => p._id === authed.defaultPreset)
        : undefined

      const recent = presets[0]
      genPreset = userDefault?._id || recent?._id || 'agnaistic'
      break
    }
  }

  const chat = await store.chats.create(
    body.characterId,
    {
      ...body,
      genPreset,
      imageSource: body.imageSource as any,
      greeting: body.greeting ?? character?.greeting,
      userId: user?.userId!,
      scenarioIds: body.scenarioId ? [body.scenarioId] : [],
    },
    profile!,
    impersonating
  )
  return chat
})

export const branchChat = handle(async ({ body, params, userId }) => {
  assertValid({ messageId: 'string', name: 'string?' }, body)

  const source = await store.chats.getChatOnly(params.id)
  if (!source) throw errors.NotFound
  if (source.userId !== userId) throw errors.Forbidden

  const allMessages = await store.msgs.getChatMessages(source)
  const byId = new Map(allMessages.map((message) => [message._id, message]))
  let current = byId.get(body.messageId)
  if (!current) throw new StatusError('Branch point was not found in this chat', 404)

  const path = [] as typeof allMessages
  const seen = new Set<string>()
  while (current && !seen.has(current._id)) {
    seen.add(current._id)
    path.unshift(current)
    current = current.parent ? byId.get(current.parent) : undefined
  }

  const profile = await store.users.getProfile(userId)
  if (!profile) throw errors.NotFound

  const created = await store.chats.create(
    source.characterId,
    {
      name: body.name?.trim() || source.name + ' · branch',
      greeting: undefined,
      scenario: source.scenario,
      scenarioIds: source.scenarioIds || [],
      sampleChat: source.sampleChat,
      userId,
      overrides: source.overrides,
      genPreset: source.genPreset,
      mode: source.mode,
      imageSource: source.imageSource,
      treeLeafId: undefined,
    },
    profile
  )

  const cloned = await store.msgs.cloneMessagesToChat(path, created._id)
  const summaryUpTo = source.summaryUpTo ? cloned.idMap.get(source.summaryUpTo) : undefined
  const copied: Record<string, unknown> = {
    treeLeafId: cloned.messages.at(-1)?._id || '',
    messageCount: cloned.messages.length,
    greeting: source.greeting,
    memoryId: source.memoryId,
    userEmbedId: source.userEmbedId,
    characters: source.characters,
    tempCharacters: source.tempCharacters,
    systemPrompt: source.systemPrompt,
    postHistoryInstructions: source.postHistoryInstructions,
    genSettings: source.genSettings,
    imageSettings: source.imageSettings,
    imageProviderId: source.imageProviderId,
    background: source.background,
    localSettings: source.localSettings,
  }

  if (summaryUpTo) {
    copied.summaries = source.summaries
    copied.summary = source.summary
    copied.summaryUpTo = summaryUpTo
    copied.summaryCount = Math.min(source.summaryCount || 0, cloned.messages.length)
    copied.summaryUpdatedAt = source.summaryUpdatedAt
  }

  const update = Object.fromEntries(
    Object.entries(copied).filter(([, value]) => value !== undefined)
  )
  const chat = await store.chats.update(created._id, update)
  return { chat, messages: cloned.messages }
})

export const importChat = handle(async ({ body, userId }) => {
  assertValid(
    {
      characterId: 'string',
      name: 'string',
      greeting: 'string?',
      scenario: 'string?',
      scenarioId: 'string?',
      treeLeafId: 'string?',
      messages: [
        {
          _id: 'string?',
          msg: 'string',
          parent: 'string?',
          characterId: 'string?',
          userId: 'string?',
          handle: 'string?',
          ooc: 'boolean?',
          retries: ['string?'],
          createdAt: 'string?',
          json: 'any?',
          values: 'any?',
          state: 'string?',
          name: 'string?',
          extras: 'any?',
        },
      ],
    },
    body
  )

  /** Do not throw on a bad scenario import */
  if (body.scenarioId) {
    const scenario = await store.scenario.getScenario(body.scenarioId)
    if (scenario?.userId !== userId) {
      body.scenarioId = undefined
    }
  }

  const character = await store.characters.getCharacter(userId!, body.characterId)
  if (!character) {
    throw new StatusError(`Character not found`, 404)
  }

  const profile = await store.users.getProfile(userId)

  const chat = await store.chats.create(
    body.characterId,
    {
      name: body.name,
      scenario: body.scenario,
      overrides: character.persona,
      sampleChat: '',
      userId,
      scenarioIds: body.scenarioId ? [body.scenarioId] : [],
      treeLeafId: body.treeLeafId,
    },
    profile!
  )

  const messages = body.messages.map<NewMessage>((msg) => ({
    chatId: chat._id,
    message: msg.msg,
    adapter: 'import',
    characterId: msg.characterId === 'imported' ? character._id : msg.characterId,
    senderId: msg.userId ? msg.userId : undefined,
    handle: msg.handle,
    ooc: msg.ooc ?? false,
    parent: msg.parent,
    retries: character.alternateGreetings,
    event: undefined,
    name: msg.name,
    json: msg.json,
    values: msg.values,
  }))

  await store.msgs.importMessages(userId, messages)

  return chat
})

function sortPresets(l: { updatedAt?: string }, r: { updatedAt?: string }) {
  return (r.updatedAt || '')?.localeCompare(l.updatedAt || '')
}
