import { readFileSync, writeFileSync } from 'node:fs'

const replaceOnce = (path, before, after, label) => {
  const source = readFileSync(path, 'utf8')
  if (source.includes(after)) return
  if (!source.includes(before)) throw new Error(`${path}: missing ${label}`)
  writeFileSync(path, source.replace(before, after))
}

replaceOnce(
  'common/prompt.ts',
  `export const HOLDERS = {
  chatAge: /{{chat_age}}/gi,
  idleDuration: /{{idle_duration}}/gi,
  ujb: /{{ujb}}/gi,
  sampleChat: /{{example_dialogue}}/gi,
  scenario: /{{scenario}}/gi,
  memory: /{{memory}}/gi,
  summary: /{{summary}}/gi,
  summaryWorld: /{{summary_world}}/gi,
  summaryPlot: /{{summary_plot}}/gi,
  summaryChars: /{{summary_chars}}/gi,
  persona: /{{personality}}/gi,
  allPersonas: /{{all_personalities}}/gi,
  post: /{{post}}/gi,
  history: /{{history}}/gi,
  systemPrompt: /{{system_prompt}}/gi,
  linebreak: /{{(br|linebreak|newline)}}/gi,
  impersonating: /{{impersonating}}/gi,
  chatEmbed: /{{chat_embed}}/gi,
  userEmbed: /{{user_embed}}/gi,
}
`,
  `export const HOLDERS = {
  chatAge: /{{chat_age}}/gi,
  idleDuration: /{{idle_duration}}/gi,
  ujb: /{{ujb}}/gi,
  sampleChat: /{{example_dialogue}}/gi,
  scenario: /{{scenario}}/gi,
  memory: /{{memory}}/gi,
  summary: /{{summary}}/gi,
  summaryWorld: /{{summary_world}}/gi,
  summaryPlot: /{{summary_plot}}/gi,
  summaryChars: /{{summary_chars}}/gi,
  persona: /{{personality}}/gi,
  allPersonas: /{{all_personalities}}/gi,
  post: /{{post}}/gi,
  history: /{{history}}/gi,
  systemPrompt: /{{system_prompt}}/gi,
  linebreak: /{{(br|linebreak|newline)}}/gi,
  impersonating: /{{impersonating}}/gi,
  chatEmbed: /{{chat_embed}}/gi,
  userEmbed: /{{user_embed}}/gi,
}

const AUTO_MEMORY_BLOCK = \`{{#if memory}}<system>Relevant memory:\n{{memory}}</system>{{/if}}\`

/**
 * Memory books are data attached to a chat, not an optional presentation section. Imported
 * and hand-written templates frequently omit {{memory}}, which previously discarded a fully
 * assembled memory prompt. Prefix a system block only for templates that have no memory slot;
 * the conditional renders nothing when no entry matched.
 */
export function ensureMemoryPlaceholder(template: string) {
  if (template.match(HOLDERS.memory)) return template
  return \`\${AUTO_MEMORY_BLOCK}\n\${template}\`.trim()
}
`,
  'memory placeholder helper'
)

replaceOnce(
  'common/prompt.ts',
  `  const template = getTemplate(opts)

  const lines = history || (await getPromptHistory(opts, encoder))`,
  `  const template = ensureMemoryPlaceholder(getTemplate(opts))

  const lines = history || (await getPromptHistory(opts, encoder))`,
  'client template normalization'
)

replaceOnce(
  'common/prompt.ts',
  `  const post = createPostPrompt(opts)
  const template = getTemplate(opts)
`,
  `  const post = createPostPrompt(opts)
  const template = ensureMemoryPlaceholder(getTemplate(opts))
`,
  'server template normalization'
)

replaceOnce(
  'app/tests/e2e/memory.spec.ts',
  `import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
`,
  `import { presetDefaults } from '../../../common/default-preset'
import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
`,
  'preset defaults import'
)

replaceOnce(
  'app/tests/e2e/memory.spec.ts',
  `  test('an always-included entry reaches the prompt with no keyword at all', async ({
    app,
    stub,
  }) => {`,
  `  test('injects memory when a custom template omits the memory slot', async ({ app, stub }) => {
    stub.state.chatPreset = 'preset-without-memory-slot'
    stub.state.presets = [
      {
        ...presetDefaults,
        _id: 'preset-without-memory-slot',
        kind: 'gen-setting',
        userId: 'user-1',
        name: 'Custom template without memory',
        service: 'openai',
        useAdvancedPrompt: 'no-validation',
        gaslight: '<system>Custom roleplay instructions.</system>\\n{{history}}\\n{{post}}',
      },
    ]

    await createBook(app)
    await app.goto('/chat/chat-1')
    await app.waitForSelector('select[aria-label="Memory book"]')
    await app.selectOption('select[aria-label="Memory book"]', stub.state.memoryBooks[0]._id)
    await expect.poll(() => stub.state.chatUpdates.length).toBe(1)

    const prompt = await sendAndCapturePrompt(app, stub.state, 'Tell me about the dragon.')
    expect(prompt).toContain('Relevant memory:')
    expect(prompt).toContain('MEMORY-DRAGON-FACT')
  })

  test('an always-included entry reaches the prompt with no keyword at all', async ({
    app,
    stub,
  }) => {`,
  'custom template regression test'
)

console.log('Memory template hotfix applied')
