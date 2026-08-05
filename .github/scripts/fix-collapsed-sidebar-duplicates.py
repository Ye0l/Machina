from pathlib import Path

root = Path('.')

# Detail updates within the same chat must not close header panels.
path = root / 'app/src/routes/Chat.svelte'
s = path.read_text(encoding='utf-8')
old = '''  $effect(() => {
    detail.chat._id
    wasAtBottom = true
    chatControls.closeAll()
  })'''
new = '''  let controlsChatId = ''
  $effect(() => {
    const chatId = detail.chat._id
    if (controlsChatId === chatId) return
    controlsChatId = chatId
    wasAtBottom = true
    chatControls.closeAll()
  })'''
if old not in s:
    raise SystemExit('chat control reset effect anchor not found')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')

# Address the action by its accessible name rather than relying on button order.
path = root / 'app/tests/e2e/risu-toggle-defaults.spec.ts'
s = path.read_text(encoding='utf-8')
old = '''  const saveDefaults = panel.locator('button').last()
  await saveDefaults.scrollIntoViewIfNeeded()
  await saveDefaults.click()'''
new = '''  const saveDefaults = panel.getByRole('button', { name: 'Use as defaults' })
  await saveDefaults.scrollIntoViewIfNeeded()
  await saveDefaults.click()'''
if old not in s:
    raise SystemExit('Risu defaults button test anchor not found')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')
