from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing marker in {path}: {old}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'app/src/shared/AppShell.svelte',
    'class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-800/80 bg-[#0d1118] px-3 md:hidden"',
    'class="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-neutral-800/80 bg-[#0d1118] px-3 pt-[env(safe-area-inset-top)] md:hidden"',
)

replace_once(
    'app/src/routes/Chat.svelte',
    'class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"',
    'class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] px-3 pt-3 pb-[max(0.375rem,calc(env(safe-area-inset-bottom)-1rem))] sm:px-5 sm:pb-3"',
)

replace_once(
    'app/src/shared/RisuTogglePanel.svelte',
    'top-[calc(3.5rem+env(safe-area-inset-top))]',
    'top-[calc(3.75rem+env(safe-area-inset-top))]',
)

p = Path('package.json')
text = p.read_text()
text = text.replace('"version": "1.0.39"', '"version": "1.0.40"', 1)
p.write_text(text)
