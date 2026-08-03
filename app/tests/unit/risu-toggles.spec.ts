import { describe, expect, it } from 'vitest'
import type { AppSchema } from '/common/types'
import {
  getRisuToggleConfig,
  parseRisuToggleSyntax,
  renderRisuPreset,
  renderRisuToggleMacros,
  withRisuToggleConfig,
  withRisuToggleDefaults,
} from '/common/risu-toggles'

describe('RisuAI prompt toggles', () => {
  const source = [
    '=Options=group',
    '=Options=divider',
    'mode=Mode=select=Default,Verbose,OOC',
    'style=Style=text',
    'header=Header',
  ].join('\n')

  const basePreset: Partial<AppSchema.GenSettings> = { name: 'Imported' }
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
    const preset = withRisuToggleConfig({ ...basePreset, gaslight: template }, source, template)
    const rendered = renderRisuPreset(preset, { mode: '2' })

    expect(rendered?.gaslight).toBe('OOC{{history}}')
    expect(preset.gaslight).toBe(template)
    expect(rendered?.promptTemplateId).toBeUndefined()
  })

  it('uses saved preset defaults until a chat overrides them', () => {
    const template = '{{#if_pure {{? {{getglobalvar::toggle_mode}}=2}}}}OOC{{/if}}{{history}}'
    const configured = withRisuToggleConfig({ ...basePreset, gaslight: template }, source, template)
    const preset = withRisuToggleDefaults(configured, {
      mode: '2',
      style: 'direct',
      header: '1',
    })

    expect(renderRisuPreset(preset)?.gaslight).toBe('OOC{{history}}')
    expect(renderRisuPreset(preset, { mode: '0' })?.gaslight).toBe('{{history}}')
  })

  it('preserves saved defaults when the toggle source is edited', () => {
    const configured = withRisuToggleConfig(basePreset, source, '{{history}}')
    const preset = withRisuToggleDefaults(configured, { mode: '2' })
    const updated = withRisuToggleConfig(preset, `${source}\nextra=Extra`, '{{history}}')

    expect(getRisuToggleConfig(updated)?.defaults).toEqual({ mode: '2' })
  })
})
