from pathlib import Path

p=Path('app/src/routes/Settings.svelte'); s=p.read_text()
s=s.replace('    CircleX,', '    CircleX,\n    Copy,')
pos=s.index('  function cancelProvider() {',s.index('  function startEditProvider'))
s=s[:pos]+"""  function startDuplicateProvider(provider: AppSchema.Provider) {
    startEditProvider(provider)
    providerForm = { ...providerForm, _id: undefined, name: i18n.t('{name} (copy)', { name: provider.name }), key: '', keySet: false }
    editingProvider = 'new'
  }

"""+s[pos:]
pos=s.index('  function cancelPreset() {')
s=s[:pos]+"""  function startDuplicatePreset(preset: AppSchema.UserGenPreset) {
    startEditPreset(preset)
    presetForm = { ...presetForm, _id: undefined, name: i18n.t('{name} (copy)', { name: preset.name }) }
    editingPreset = 'new'
  }

"""+s[pos:]
old='''                    <button
                      class="icon-button"
                      type="button"
                      aria-label={`Edit ${provider.name}`}
                      onclick={() => startEditProvider(provider)}
                    >'''
new='''                    <button class="icon-button" type="button" aria-label={i18n.t('Duplicate {name}', { name: provider.name })} title={i18n.t('Duplicate')} onclick={() => startDuplicateProvider(provider)}><Copy size={17} /></button>
'''+old
if old not in s: raise SystemExit('provider list marker missing')
s=s.replace(old,new,1)
old='''                    <button
                      class="icon-button"
                      type="button"
                      aria-label={`Edit ${preset.name}`}
                      onclick={() => startEditPreset(preset)}
                    >'''
new='''                    <button class="icon-button" type="button" aria-label={i18n.t('Duplicate {name}', { name: preset.name })} title={i18n.t('Duplicate')} onclick={() => startDuplicatePreset(preset)}><Copy size={17} /></button>
'''+old
if old not in s: raise SystemExit('preset list marker missing')
s=s.replace(old,new,1)
s=s.replace("i18n.t('AI Settings')", "i18n.t('Settings')").replace("i18n.t('AI settings')", "i18n.t('Settings')")
p.write_text(s)

p=Path('app/src/shared/Sidebar.svelte'); s=p.read_text().replace("i18n.t('AI Settings')","i18n.t('Settings')").replace("i18n.t('AI settings')","i18n.t('Settings')"); p.write_text(s)
p=Path('app/src/lib/i18n.svelte.ts'); s=p.read_text(); anchor="  'Delete message': '메시지 삭제',"
add="\n  'Duplicate': '복제',\n  'Duplicate {name}': '{name} 복제',\n  '{name} (copy)': '{name} (복사본)',"
if "'Duplicate': '복제'" not in s: s=s.replace(anchor,anchor+add,1)
s=s.replace("'AI Settings': 'AI 설정'", "'Settings': '설정'").replace("'AI settings': 'AI 설정'", "'Settings': '설정'")
p.write_text(s)
p=Path('package.json'); p.write_text(p.read_text().replace('"version": "1.0.37"','"version": "1.0.38"',1))
