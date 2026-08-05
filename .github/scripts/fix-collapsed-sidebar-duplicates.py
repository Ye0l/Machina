from pathlib import Path

root = Path('.')

# Keep the Risu prompt panel open while chat detail/preset state is briefly recalculated.
path = root / 'app/src/shared/RisuTogglePanel.svelte'
s = path.read_text(encoding='utf-8')
old = '''  $effect(() => {
    // Close panels that no longer have a reason to be visible after navigation or preset changes.
    if (!settingsMode && route.name !== 'chat') {
      setupOpen = false
      chatControls.closePrompt()
    }
    if (route.name === 'chat' && (!activeConfig || !interactiveDefinitions.length)) {
      chatControls.closePrompt()
    }
  })'''
new = '''  $effect(() => {
    // Navigation closes the panel. Chat detail updates can briefly recalculate the active preset,
    // so a transient missing config must not close a panel the user just opened.
    if (!settingsMode && route.name !== 'chat') {
      setupOpen = false
      chatControls.closePrompt()
    }
  })'''
if old not in s:
    raise SystemExit('Risu prompt panel effect anchor not found')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')

# The collapsed sidebar now intentionally keeps primary navigation available as icon links.
path = root / 'app/tests/e2e/routing.spec.ts'
s = path.read_text(encoding='utf-8')
old = '''    await app.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(app.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect(app.getByRole('link', { name: 'Settings' })).toHaveCount(0)

    await app.reload()
    await expect(app.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await app.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(app.getByRole('link', { name: 'Settings' })).toBeVisible()'''
new = '''    await app.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(app.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect(app.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(app.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')

    await app.reload()
    await expect(app.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect(app.getByRole('link', { name: 'Settings' })).toBeVisible()
    await app.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(app.getByRole('link', { name: 'Settings' })).toBeVisible()'''
if old not in s:
    raise SystemExit('collapsed sidebar test anchor not found')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')
