import { readFileSync, writeFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const write = (path, content) => writeFileSync(path, content)

function replaceOnce(path, before, after, label) {
  const source = read(path)
  if (source.includes(after)) return
  if (!source.includes(before)) throw new Error(`${path}: missing ${label}`)
  write(path, source.replace(before, after))
}

replaceOnce(
  'app/src/lib/generation-debug.ts',
  `export type GenerationSummary = {
  model: string
  outputTokens: number
}`,
  `export type GenerationSummary = {
  model: string
  outputTokens: number
  inputTokens?: number
  contextLimit?: number
}`,
  'generation summary type'
)

replaceOnce(
  'app/src/lib/generation-debug.ts',
  `  if (typeof model !== 'string' || typeof outputTokens !== 'number') return undefined
  return { model, outputTokens }
}`,
  `  if (typeof model !== 'string' || typeof outputTokens !== 'number') return undefined
  const inputTokens = (value as { inputTokens?: unknown }).inputTokens
  const contextLimit = (value as { contextLimit?: unknown }).contextLimit
  return {
    model,
    outputTokens,
    ...(typeof inputTokens === 'number' ? { inputTokens } : {}),
    ...(typeof contextLimit === 'number' ? { contextLimit } : {}),
  }
}`,
  'summary parser'
)

replaceOnce(
  'app/src/lib/generation-debug.ts',
  `export const generationSummary = (debug: GenerationDebug): GenerationSummary => ({
  model: debug.model,
  outputTokens: debug.outputTokens,
})`,
  `export const generationSummary = (debug: GenerationDebug): GenerationSummary => ({
  model: debug.model,
  outputTokens: debug.outputTokens,
  inputTokens: debug.inputTokens,
  contextLimit: debug.contextLimit,
})`,
  'summary writer'
)

replaceOnce(
  'app/src/lib/generate.ts',
  `): Promise<GenerationDebug> {
  return {
    model: resolveGenerationModel(settings),
    outputTokens: await countTokens(text),
    request: {`,
  `): Promise<GenerationDebug> {
  // Structured messages are what chat adapters consume; completion adapters fall back to the
  // flat prompt. Role labels approximate the small framing overhead while keeping the count
  // tied to the same tokenizer that assembled and trimmed this request.
  const inputText = request.messages.length
    ? request.messages
        .map(({ role, content }) => role + ': ' + content)
        .join(String.fromCharCode(10))
    : request.prompt

  return {
    model: resolveGenerationModel(settings),
    outputTokens: await countTokens(text),
    inputTokens: await countTokens(inputText),
    contextLimit: settings?.maxContextLength,
    request: {`,
  'debug token counts'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `                {generation.model} · {i18n.t('{count} tokens', { count: generation.outputTokens })}
              </span>`,
  `                {generation.model} · {i18n.t('{count} tokens', { count: generation.outputTokens })}
                {#if generation.inputTokens !== undefined && generation.contextLimit}
                  · {i18n.t('{used} / {limit} context ({percent}%)', {
                    used: generation.inputTokens.toLocaleString(),
                    limit: generation.contextLimit.toLocaleString(),
                    percent: Math.min(
                      999,
                      Math.round((generation.inputTokens / generation.contextLimit) * 100)
                    ),
                  })}
                {/if}
              </span>`,
  'message context label'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `              {generationDebug.summary.model} · {i18n.t('{count} tokens', {
                count: generationDebug.summary.outputTokens,
              })}
            </p>`,
  `              {generationDebug.summary.model} · {i18n.t('{count} tokens', {
                count: generationDebug.summary.outputTokens,
              })}
              {#if generationDebug.summary.inputTokens !== undefined &&
                generationDebug.summary.contextLimit}
                · {i18n.t('{used} / {limit} context ({percent}%)', {
                  used: generationDebug.summary.inputTokens.toLocaleString(),
                  limit: generationDebug.summary.contextLimit.toLocaleString(),
                  percent: Math.min(
                    999,
                    Math.round(
                      (generationDebug.summary.inputTokens /
                        generationDebug.summary.contextLimit) *
                        100
                    )
                  ),
                })}
              {/if}
            </p>`,
  'modal context label'
)

const i18nPath = 'app/src/lib/i18n.svelte.ts'
let i18n = read(i18nPath)
if (!i18n.includes(`'{used} / {limit} context ({percent}%)'`)) {
  i18n = i18n.replace(
    `  'Streaming output': '스트리밍 출력',\n`,
    `  'Streaming output': '스트리밍 출력',\n  '{used} / {limit} context ({percent}%)': '컨텍스트 {used} / {limit} ({percent}%)',\n`
  )
  write(i18nPath, i18n)
}

replaceOnce(
  'app/tests/e2e/reroll-debug.spec.ts',
  `      maxTokens: 777,
`,
  `      maxTokens: 777,
      maxContextLength: 16384,
`,
  'test context limit'
)

replaceOnce(
  'app/tests/e2e/reroll-debug.spec.ts',
  `  await expect(debug).toContainText(/\\d+ tokens/)
`,
  `  await expect(debug).toContainText(/\\d+ tokens/)
  await expect(debug).toContainText('16,384 context')
`,
  'context usage assertion'
)

console.log('Context usage metadata patch applied')
