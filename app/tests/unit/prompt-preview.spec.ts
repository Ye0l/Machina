import { describe, expect, it } from 'vitest'
import { renderPromptPreview } from '/app/lib/prompt-preview'
import type { AppSchema } from '/common/types'

/** Stands in for the real tokenizer, which the preview takes as a parameter for this reason. */
const words: (text: string) => Promise<number> = async (text) =>
  text.split(/\s+/).filter(Boolean).length

const render = (template: string, settings?: Partial<AppSchema.GenSettings>) =>
  renderPromptPreview(template, settings, words)

describe('renderPromptPreview', () => {
  it('fills placeholders from the sample cast', async () => {
    const { text } = await render('{{char}} talks to {{user}}.')
    expect(text).toBe('Robot talks to Author.')
  })

  it('renders the sample conversation into the history placeholder', async () => {
    const { text } = await render('{{history}}')
    expect(text).toContain('Rory: Hi, nice to meet you!')
    expect(text).toContain('Author: Nice to meet you too.')
  })

  it('renders the sample persona and scenario', async () => {
    const { text } = await render('{{personality}}\n{{scenario}}')
    expect(text).toContain('Robot likes coffee')
    expect(text).toContain('Rory is strolling in the park')
  })

  it('resolves conditional blocks the way generation does', async () => {
    const { text } = await render('{{#if scenario}}HAS-SCENARIO{{/if}}')
    expect(text).toContain('HAS-SCENARIO')
  })

  it('substitutes the instruct tags of the chosen model format', async () => {
    const plain = await render('<user>ask</user>')
    const chatml = await render('<user>ask</user>', { modelFormat: 'ChatML' })

    expect(chatml.text).not.toBe(plain.text)
    expect(chatml.text).toContain('<|im_start|>user')
  })

  it('counts the tokens of what it rendered, not of the template', async () => {
    const { text, tokens } = await render('{{char}} talks to {{user}}.')
    expect(tokens).toBe(await words(text))
  })
})
