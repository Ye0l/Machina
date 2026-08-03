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
  'common/risu-toggles.ts',
  `      result.push({
        kind: 'select',
        key,
        label,
        options: options.length ? options : [''],
        defaultValue: '0',
      })`,
  `      const normalisedOptions = options.length ? options : ['']
      const markedDefault = normalisedOptions.findIndex((option) =>
        /(?:\\(|\\[|【)\\s*(?:기본|default)\\s*(?:\\)|\\]|】)/i.test(option)
      )
      result.push({
        kind: 'select',
        key,
        label,
        options: normalisedOptions,
        // Risu does not export the live global toggle state with a preset. Prefer an option
        // explicitly marked as the default, otherwise use the first option just as Risu does.
        defaultValue: String(markedDefault >= 0 ? markedDefault : 0),
      })`,
  'select default inference'
)

replaceOnce(
  'common/risu-toggles.ts',
  `function topLevelEquality(
  expression: string
): { left: string; right: string; negate: boolean } | undefined {
  let depth = 0
  for (let index = 0; index < expression.length; index++) {
    if (expression.startsWith('{{', index)) {
      depth++
      index++
      continue
    }
    if (expression.startsWith('}}', index)) {
      depth = Math.max(0, depth - 1)
      index++
      continue
    }
    if (depth !== 0 || expression[index] !== '=') continue

    const isNotEqual = expression[index - 1] === '!'
    return {
      left: expression.slice(0, isNotEqual ? index - 1 : index),
      right: expression.slice(index + 1),
      negate: isNotEqual,
    }
  }
}

function evaluateQuestion(expression: string, values: Record<string, string>): boolean {
  let body = expression.trim()
  let negateResult = false
  if (body.startsWith('!')) {
    negateResult = true
    body = body.slice(1).trim()
  }

  const comparison = topLevelEquality(body)
  const result = comparison
    ? comparison.negate !==
      equal(
        evaluateRisuExpression(comparison.left, values),
        evaluateRisuExpression(comparison.right, values)
      )
    : truthy(evaluateRisuExpression(body, values))

  return negateResult ? !result : result
}`,
  `type ComparisonOperator = '=' | '==' | '===' | '!=' | '!==' | '<' | '>' | '<=' | '>=' | '≤' | '≥'

function topLevelComparison(
  expression: string
): { left: string; right: string; operator: ComparisonOperator } | undefined {
  const operators: ComparisonOperator[] = ['!==', '===', '!=', '==', '<=', '>=', '≤', '≥', '<', '>', '=']
  let depth = 0
  for (let index = 0; index < expression.length; index++) {
    if (expression.startsWith('{{', index)) {
      depth++
      index++
      continue
    }
    if (expression.startsWith('}}', index)) {
      depth = Math.max(0, depth - 1)
      index++
      continue
    }
    if (depth !== 0) continue

    const operator = operators.find((candidate) => expression.startsWith(candidate, index))
    if (!operator) continue
    return {
      left: expression.slice(0, index),
      right: expression.slice(index + operator.length),
      operator,
    }
  }
}

function evaluateQuestion(expression: string, values: Record<string, string>): boolean {
  let body = expression.trim()
  let negateResult = false
  if (body.startsWith('!') && !body.startsWith('!=')) {
    negateResult = true
    body = body.slice(1).trim()
  }

  const comparison = topLevelComparison(body)
  let result: boolean
  if (!comparison) {
    result = truthy(evaluateRisuExpression(body, values))
  } else {
    const left = evaluateRisuExpression(comparison.left, values)
    const right = evaluateRisuExpression(comparison.right, values)
    switch (comparison.operator) {
      case '!=':
      case '!==':
        result = !equal(left, right)
        break
      case '<':
        result = numeric(left) < numeric(right)
        break
      case '>':
        result = numeric(left) > numeric(right)
        break
      case '<=':
      case '≤':
        result = numeric(left) <= numeric(right)
        break
      case '>=':
      case '≥':
        result = numeric(left) >= numeric(right)
        break
      default:
        result = equal(left, right)
    }
  }

  return negateResult ? !result : result
}`,
  'symbolic Risu comparisons'
)

replaceOnce(
  'common/risu-toggles.ts',
  `/** Returns a generation-only clone. The stored preset and source template are untouched. */
export function renderRisuPreset(`,
  `export function hasUnresolvedRisuMacros(template: string) {
  return /{{\\s*(?:#if_pure\\b|getglobalvar::)/i.test(template)
}

/**
 * Renders the supplied working template with a preset's Risu toggle definition. Unlike
 * renderRisuPreset, this is suitable for an editor preview where the text may have unsaved edits.
 */
export function renderRisuTemplate(
  template: string,
  preset: RisuPreset | undefined,
  values?: Record<string, string>
) {
  const config = getRisuToggleConfig(preset)
  if (!config) return template
  return renderRisuToggleMacros(template, config.source, {
    ...(config.defaults ?? {}),
    ...(values ?? {}),
  })
}

/** Returns a generation-only clone. The stored preset and source template are untouched. */
export function renderRisuPreset(`,
  'Risu template renderer'
)

replaceOnce(
  'common/risu-toggles.ts',
  `    gaslight: renderRisuToggleMacros(config.template, config.source, {
      ...(config.defaults ?? {}),
      ...(values ?? {}),
    }),`,
  `    gaslight: renderRisuTemplate(config.template, preset, values),`,
  'reuse runtime renderer'
)

replaceOnce(
  'app/src/lib/prompt-preview.ts',
  `import { replaceTags } from '/common/presets/templates'
import { getEncoder } from '/common/tokenize'`,
  `import { replaceTags } from '/common/presets/templates'
import { expandRisuHistoryRanges } from '/common/risu-import'
import { renderRisuTemplate } from '/common/risu-toggles'
import { getEncoder } from '/common/tokenize'`,
  'preview Risu imports'
)

replaceOnce(
  'app/src/lib/prompt-preview.ts',
  `  return { char, replyAs, sender, user, chat, characters, lines }
})()`,
  `  return { char, replyAs, sender, user, chat, characters, history, lines }
})()`,
  'preview history return'
)

replaceOnce(
  'app/src/lib/prompt-preview.ts',
  `  const { char, replyAs, sender, user, chat, characters, lines } = SAMPLE`,
  `  const { char, replyAs, sender, user, chat, characters, history, lines } = SAMPLE`,
  'preview history destructure'
)

replaceOnce(
  'app/src/lib/prompt-preview.ts',
  `  let { parsed } = await parseTemplate(template, {`,
  `  // The editor must show the same generation-time prompt as a real chat. Risu toggle
  // macros are resolved before the ordinary prompt parser, then Risu history ranges are
  // expanded against the sample conversation.
  const toggled = renderRisuTemplate(template, settings)
  const runtimeTemplate = expandRisuHistoryRanges(toggled, history, {
    user: sender.handle,
    bot: replyAs.name,
  })

  let { parsed } = await parseTemplate(runtimeTemplate, {`,
  'preview runtime template'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `      preview = await renderPromptPreview(template, {
        ...presetForm,
        maxContextLength: presetForm.maxContext,
      })`,
  `      const savedPreset = presets.find((preset) => preset._id === presetForm._id)
      preview = await renderPromptPreview(template, {
        // Risu toggle metadata is kept in the saved preset's temporary object rather than in
        // PresetForm. Preserve it while layering the editor's unsaved values on top.
        ...(savedPreset ?? {}),
        ...presetForm,
        maxContextLength: presetForm.maxContext,
      })`,
  'preview preserved temporary metadata'
)

replaceOnce(
  'app/src/lib/generate.ts',
  `import { renderRisuPreset } from '/common/risu-toggles'`,
  `import { hasUnresolvedRisuMacros, renderRisuPreset } from '/common/risu-toggles'`,
  'generation Risu validation import'
)

replaceOnce(
  'app/src/lib/generate.ts',
  `  const rendered = renderRisuPreset(preset, (chat as ChatWithRisuToggles).risuToggleValues)
  if (!rendered?.gaslight) return rendered
  return {
    ...rendered,
    gaslight: expandRisuHistoryRanges(rendered.gaslight, messages, names),
  }`,
  `  const rendered = renderRisuPreset(preset, (chat as ChatWithRisuToggles).risuToggleValues)
  if (!rendered?.gaslight) return rendered
  const gaslight = expandRisuHistoryRanges(rendered.gaslight, messages, names)
  if (hasUnresolvedRisuMacros(gaslight)) {
    throw new Error(
      'This preset still contains unresolved RisuAI macros. Re-import it or attach its Risu toggle definition in preset settings.'
    )
  }
  return { ...rendered, gaslight }`,
  'generation unresolved macro guard'
)

replaceOnce(
  'app/tests/unit/prompt-preview.spec.ts',
  `import type { AppSchema } from '/common/types'`,
  `import type { AppSchema } from '/common/types'
import { withRisuToggleConfig, withRisuToggleDefaults } from '/common/risu-toggles'`,
  'preview test imports'
)

replaceOnce(
  'app/tests/unit/prompt-preview.spec.ts',
  `  it('substitutes the instruct tags of the chosen model format', async () => {`,
  `  it('resolves Risu toggles and history ranges before rendering', async () => {
    const source = 'mode=Mode=select=Disabled,Enabled (기본)'
    const template = [
      '{{#if_pure {{? {{getglobalvar::toggle_mode}}=1}}}}RISU-ENABLED{{#else}}RISU-DISABLED{{/if}}',
      '{{history:0:-1}}',
    ].join('\\n')
    const configured = withRisuToggleDefaults(
      withRisuToggleConfig({ gaslight: template }, source, template),
      { mode: '1' }
    )

    const { text } = await render(template, configured)
    expect(text).toContain('RISU-ENABLED')
    expect(text).not.toContain('RISU-DISABLED')
    expect(text).toContain('Rory: Hi, nice to meet you!')
    expect(text).not.toContain('getglobalvar')
    expect(text).not.toContain('#if_pure')
    expect(text).not.toContain('{{history:')
  })

  it('substitutes the instruct tags of the chosen model format', async () => {`,
  'preview regression test'
)

replaceOnce(
  'app/tests/unit/risu-toggles.spec.ts',
  `  it('evaluates negated Risu question expressions', () => {`,
  `  it('uses an explicitly marked select option as the imported default', () => {
    const definitions = parseRisuToggleSyntax(
      'voice=Voice=select=Off,Normal (기본),Strong\\nlanguage=Language=select=기본,English'
    )
    expect(definitions[0]).toMatchObject({ defaultValue: '1' })
    expect(definitions[1]).toMatchObject({ defaultValue: '0' })
  })

  it('evaluates symbolic Risu comparisons including Unicode operators', () => {
    const template = [
      '{{#if_pure {{? {{getglobalvar::toggle_mode}}<2}}}}LT{{/if}}',
      '{{#if_pure {{? {{getglobalvar::toggle_mode}}≥1}}}}GE{{/if}}',
      '{{#if_pure {{? {{getglobalvar::toggle_mode}}!=2}}}}NE{{/if}}',
    ].join('|')
    expect(renderRisuToggleMacros(template, source, { mode: '1' })).toBe('LT|GE|NE')
  })

  it('evaluates negated Risu question expressions', () => {`,
  'Risu parser regression tests'
)

write(
  'app/tests/e2e/risu-runtime.spec.ts',
  `import { presetDefaults } from '../../../common/default-preset'
import { withRisuToggleConfig, withRisuToggleDefaults } from '../../../common/risu-toggles'
import { expect, test } from './fixtures'

test('resolves imported Risu macros in the actual inference request', async ({ app, stub }) => {
  const source = 'mode=Mode=select=Disabled,Enabled (기본)'
  const template = [
    '<system>',
    '{{#if_pure {{? {{getglobalvar::toggle_mode}}=1}}}}RISU-RUNTIME-ENABLED{{#else}}RISU-RUNTIME-DISABLED{{/if}}',
    '{{history:0:end}}',
    '</system>',
    '<bot>{{post}}</bot>',
  ].join('\\n')
  const configured = withRisuToggleDefaults(
    withRisuToggleConfig({ ...presetDefaults, gaslight: template }, source, template),
    { mode: '1' }
  )

  stub.state.chatPreset = 'preset-risu-runtime'
  stub.state.presets = [
    {
      ...configured,
      _id: 'preset-risu-runtime',
      kind: 'gen-setting',
      userId: 'user-1',
      name: 'Risu runtime',
      service: 'openai',
    },
  ]

  await app.goto('/chat/chat-1')
  await app.getByRole('button', { name: 'Resend last message' }).click()
  await expect.poll(() => stub.state.inferenceRequests.length).toBe(1)

  const request = stub.state.inferenceRequests[0]
  const serialized = JSON.stringify({ prompt: request.prompt, messages: request.messages })
  expect(serialized).toContain('RISU-RUNTIME-ENABLED')
  expect(serialized).not.toContain('RISU-RUNTIME-DISABLED')
  expect(serialized).not.toContain('getglobalvar')
  expect(serialized).not.toContain('#if_pure')
  expect(serialized).not.toContain('{{history:')
})
`
)

const pkgPath = 'package.json'
const pkg = JSON.parse(read(pkgPath))
pkg.version = '1.0.34'
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log('Risu runtime rendering patch applied')
// Trigger after workflow creation.
