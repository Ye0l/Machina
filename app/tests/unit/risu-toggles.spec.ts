import { describe, expect, it } from 'vitest'
import {
  parseRisuToggleSyntax,
  renderRisuPreset,
  renderRisuToggleMacros,
  withRisuToggleConfig,
} from '/common/risu-toggles'

describe('RisuAI prompt toggles', () => {
  const source = [
    '=Options=group',
    '=Options=divider',
    'mode=Mode=select=Default,Verbose,OOC',
    'style=Style=text',
    'header=Header',
  ].join('\n')

  it('parses groups, selects, text inputs and checkboxes', () => {
    expect(parseRisuToggleSyntax(source)).toEqual([
      { kind: 'group', label: 'Options' },
      { kind: 'divider', label: 'Options' },
      {
        kind: 'select',
        key: 'mode',
        label: 'Mode',
        options: ['Default', 'Verbose', 'OOC'],
        defaultValue: '0',
      },
      { kind: 'text', key: 'style', label: 'Style', defaultValue: '' },
      { kind: 'boolean', key: 'header', label: 'Header', defaultValue: '0' },
    ])
  })

  it('renders nested Risu conditions but preserves Agnai conditions', () => {
    const template = [
      '{{#if_pure {{all::{{not_equal::{{getglobalvar::toggle_mode}}::0}}::{{? {{getglobalvar::toggle_header}}}}}}}}',
      'Mode={{getglobalvar::toggle_mode}} Style={{getglobalvar::toggle_style}}',
      '{{/if}}',
      '{{#if system_prompt}}Agnai={{system_prompt}}{{/if}}',
    ].join('\n')

    const rendered = renderRisuToggleMacros(template, source, {
      mode: '1',
      style: 'serious',
      header: '1',
    })

    expect(rendered).toContain('Mode=1 Style=serious')
    expect(rendered).toContain('{{#if system_prompt}}Agnai={{system_prompt}}{{/if}}')
    expect(rendered).not.toContain('getglobalvar')
    expect(rendered).not.toContain('#if_pure')
  })

  it('evaluates negated Risu question expressions', () => {
    const template =
      '{{#if_pure {{? !{{getglobalvar::toggle_mode}}=0}}}}selected{{#else}}default{{/if}}'

    expect(renderRisuToggleMacros(template, source, { mode: '0' })).toBe('default')
    expect(renderRisuToggleMacros(template, source, { mode: '2' })).toBe('selected')
  })

  it('creates a generation-only preset without modifying its source', () => {
    const template = '{{#if_pure {{? {{getglobalvar::toggle_mode}}=2}}}}OOC{{/if}}{{history}}'
    const preset = withRisuToggleConfig(
      { name: 'Imported', gaslight: template } as any,
      source,
      template
    )
    const rendered = renderRisuPreset(preset, { mode: '2' })

    expect(rendered?.gaslight).toBe('OOC{{history}}')
    expect(preset.gaslight).toBe(template)
    expect(rendered?.promptTemplateId).toBeUndefined()
  })
})
