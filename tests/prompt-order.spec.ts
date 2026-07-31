import './init'
import { expect } from 'chai'
import { build, botMsg, toMsg, entities, toChar, toPersona } from './util'

/**
 * Covers the configurable prompt behaviour the Svelte preset editor exposes:
 * section ordering, section disabling, and the character system prompt / UJB overrides.
 */
describe('prompt ordering and overrides', () => {
  const history = [botMsg('First message'), toMsg('User response')]

  const basic = (order: Array<{ placeholder: string; enabled: boolean }>) => ({
    useAdvancedPrompt: 'basic' as const,
    modelFormat: 'None' as const,
    promptOrder: order,
  })

  it('emits sections in the configured order', async () => {
    const scenarioFirst = await build(history, {
      settings: basic([
        { placeholder: 'scenario', enabled: true },
        { placeholder: 'personality', enabled: true },
        { placeholder: 'history', enabled: true },
      ]),
    })

    const parsed = scenarioFirst.template.parsed
    const scenarioAt = parsed.indexOf('scenario of the conversation')
    const personalityAt = parsed.indexOf("'s personality")
    expect(scenarioAt).to.be.greaterThan(-1)
    expect(personalityAt).to.be.greaterThan(-1)
    expect(scenarioAt).to.be.lessThan(personalityAt)

    const personalityFirst = await build(history, {
      settings: basic([
        { placeholder: 'personality', enabled: true },
        { placeholder: 'scenario', enabled: true },
        { placeholder: 'history', enabled: true },
      ]),
    })

    const swapped = personalityFirst.template.parsed
    expect(swapped.indexOf("'s personality")).to.be.lessThan(
      swapped.indexOf('scenario of the conversation')
    )
  })

  it('omits a disabled section', async () => {
    const enabled = await build(history, {
      settings: basic([
        { placeholder: 'example_dialogue', enabled: true },
        { placeholder: 'history', enabled: true },
      ]),
    })
    expect(enabled.template.parsed).to.include('SAMPLECHAT')

    const disabled = await build(history, {
      settings: basic([
        { placeholder: 'example_dialogue', enabled: false },
        { placeholder: 'history', enabled: true },
      ]),
    })
    expect(disabled.template.parsed).to.not.include('SAMPLECHAT')
  })

  it('uses the character system prompt by default and honours the global override', async () => {
    const replyAs = toChar('SystemBot', {
      persona: toPersona('SystemBot replies'),
      systemPrompt: 'CHARACTER-SYSTEM-PROMPT',
      postHistoryInstructions: 'CHARACTER-UJB',
    })

    const settings = basic([
      { placeholder: 'system_prompt', enabled: true },
      { placeholder: 'history', enabled: true },
    ])

    const inherited = await build(history, { replyAs, settings })
    expect(inherited.template.parsed).to.include('CHARACTER-SYSTEM-PROMPT')
    expect(inherited.template.parsed).to.include('CHARACTER-UJB')

    const overridden = await build(history, {
      replyAs,
      settings: {
        ...settings,
        systemPrompt: 'GLOBAL-SYSTEM-PROMPT',
        ultimeJailbreak: 'GLOBAL-UJB',
        ignoreCharacterSystemPrompt: true,
        ignoreCharacterUjb: true,
      },
    })
    expect(overridden.template.parsed).to.include('GLOBAL-SYSTEM-PROMPT')
    expect(overridden.template.parsed).to.not.include('CHARACTER-SYSTEM-PROMPT')
    expect(overridden.template.parsed).to.include('GLOBAL-UJB')
    expect(overridden.template.parsed).to.not.include('CHARACTER-UJB')
  })

  it('uses a saved raw template verbatim in advanced mode', async () => {
    const gaslight = 'RAW-TEMPLATE-MARKER {{personality}} ||| {{history}}'
    const result = await build(history, {
      settings: { useAdvancedPrompt: 'no-validation', gaslight },
    })

    expect(result.template.parsed).to.include('RAW-TEMPLATE-MARKER')
    expect(result.template.parsed).to.include('|||')
    // The raw template is authoritative: nothing outside it is injected.
    expect(result.template.parsed).to.not.include('scenario of the conversation')
  })

  after(() => {
    void entities
  })
})
