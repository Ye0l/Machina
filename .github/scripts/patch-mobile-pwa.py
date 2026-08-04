from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'app/src/shared/RisuTogglePanel.svelte',
    'class="fixed right-2 top-[3.75rem] z-40 max-h-[calc(100vh-4.5rem)] w-[min(25rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:right-5 sm:top-[4.5rem] sm:max-h-[calc(100vh-5.25rem)]"',
    'class="fixed inset-x-2 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 flex max-h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:inset-x-auto sm:right-5 sm:top-[4.5rem] sm:max-h-[calc(100dvh-5.25rem)] sm:w-[min(25rem,calc(100vw-2.5rem))]"',
    'mobile toggle panel sizing',
)
replace_once(
    'app/src/shared/RisuTogglePanel.svelte',
    '<div class="space-y-4 p-4">\n      {#each activeDefinitions',
    '<div class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:space-y-4 sm:p-4">\n      {#each activeDefinitions',
    'mobile toggle scroll body',
)
replace_once(
    'app/src/shared/RisuTogglePanel.svelte',
    'class="sticky top-0 flex items-center gap-2 border-b border-neutral-800 bg-[#10151d] px-4 py-3"',
    'class="flex shrink-0 items-center gap-2 border-b border-neutral-800 bg-[#10151d] px-3 py-2.5 sm:px-4 sm:py-3"',
    'mobile toggle header',
)

replace_once(
    'app/index.html',
    '    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n    <title>Machina</title>',
    '    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n    <meta name="theme-color" content="#10151d" />\n    <meta name="color-scheme" content="dark light" />\n    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n    <meta name="apple-mobile-web-app-title" content="Machina" />\n    <link rel="manifest" href="/manifest.webmanifest" />\n    <link rel="icon" href="/machina-icon.svg" type="image/svg+xml" />\n    <link rel="apple-touch-icon" href="/machina-icon.svg" />\n    <title>Machina</title>',
    'PWA document metadata',
)

replace_once(
    'app/src/main.ts',
    "import App from './App.svelte'\n\nexport default mount(App, { target: document.getElementById('root')! })",
    "import App from './App.svelte'\n\nif ('serviceWorker' in navigator && import.meta.env.PROD) {\n  window.addEventListener('load', () => {\n    void navigator.serviceWorker.register('/sw.js').catch((error) => {\n      console.warn('Service worker registration failed', error)\n    })\n  })\n}\n\nexport default mount(App, { target: document.getElementById('root')! })",
    'service worker registration',
)

replace_once(
    'package.json',
    '"version": "1.0.38"',
    '"version": "1.0.39"',
    'version bump',
)
