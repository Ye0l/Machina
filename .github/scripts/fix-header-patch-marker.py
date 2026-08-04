from pathlib import Path

p = Path('.github/scripts/patch-header-controls-v2.py')
s = p.read_text()
old = '''s = replace_once(
    s,
    "import { normalizeAppTheme } from '/common/types/ui'",
    "import { normalizeAppTheme } from '/common/types/ui'\\n  import { getRisuToggleConfig, parseRisuToggleSyntax } from '/common/risu-toggles'\\n  import { chatControls } from '/app/lib/chat-controls.svelte'",
    'AppShell control imports',
)
'''
new = '''s = replace_once(
    s,
    "  import { router, routes } from '/app/lib/router.svelte'",
    "  import { router, routes } from '/app/lib/router.svelte'\\n  import { session } from '/app/lib/session.svelte'\\n  import { getRisuToggleConfig, parseRisuToggleSyntax } from '/common/risu-toggles'\\n  import { chatControls } from '/app/lib/chat-controls.svelte'",
    'AppShell control imports',
)
'''
if old not in s:
    raise SystemExit('header patch marker block not found')
p.write_text(s.replace(old, new, 1))
