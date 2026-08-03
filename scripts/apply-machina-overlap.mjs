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
  'app/src/lib/generate.ts',
  `): Promise<GenerationDebug> {
  return {
    model: resolveGenerationModel(settings),
    outputTokens: await countTokens(text),
    request: {`,
  `): Promise<GenerationDebug> {
  // Structured messages are what chat adapters consume; completion adapters fall back to the
  // flat prompt. Role labels approximate the small framing overhead while keeping the count
  // tied to the same tokenizer that assembled and trimmed this request.
  const inputText = request.messages.length
    ? request.messages
        .map(({ role, content }) => role + ': ' + content)
        .join(String.fromCharCode(10))
    : request.prompt

  return {
    model: resolveGenerationModel(settings),
    outputTokens: await countTokens(text),
    inputTokens: await countTokens(inputText),
    contextLimit: settings?.maxContextLength,
    request: {`,
  'generation context usage'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `  import {
    AVATAR_CORNERS,
    AVATAR_SIZES,
    CHAT_WIDTHS,
    FONT_FACES,
    UI_FONT,
    type AvatarCornerRadius,
    type AvatarSize,
    type ChatWidth,
    type FontSetting,
  } from '/common/types/ui'`,
  `  import {
    APP_THEMES,
    APP_THEME_LABELS,
    AVATAR_CORNERS,
    AVATAR_SIZES,
    CHAT_WIDTHS,
    FONT_FACES,
    SCROLL_FOLLOW_LABELS,
    SCROLL_FOLLOW_MODES,
    UI_FONT,
    normalizeAppTheme,
    type AppTheme,
    type AvatarCornerRadius,
    type AvatarSize,
    type ChatWidth,
    type FontSetting,
    type ScrollFollowMode,
    type ThemeMode,
  } from '/common/types/ui'`,
  'display imports'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `  type DisplayForm = {
    chatWidth: ChatWidth`,
  `  type DisplayForm = {
    theme: AppTheme
    mode: ThemeMode
    scrollFollow: ScrollFollowMode
    streamingOutput: boolean
    chatWidth: ChatWidth`,
  'display form fields'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `    return {
      chatWidth: ui.chatWidth ?? 'full',`,
  `    return {
      theme: normalizeAppTheme(ui.theme),
      mode: ui.mode === 'light' ? 'light' : 'dark',
      scrollFollow: ui.scrollFollow ?? 'always',
      streamingOutput: ui.streamingOutput !== false,
      chatWidth: ui.chatWidth ?? 'full',`,
  'display form defaults'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `      const ok = await uiSettings.save({
        chatWidth: displayForm.chatWidth,`,
  `      const ok = await uiSettings.save({
        theme: displayForm.theme,
        mode: displayForm.mode,
        scrollFollow: displayForm.scrollFollow,
        streamingOutput: displayForm.streamingOutput,
        chatWidth: displayForm.chatWidth,`,
  'display save fields'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `          <div
            class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-4"
            style:font-family=`,
  `          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="display-theme">{i18n.t('Color theme')}</label>
              <select id="display-theme" class="field" bind:value={displayForm.theme}>
                {#each APP_THEMES as theme (theme)}
                  <option value={theme}>{APP_THEME_LABELS[theme]}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-mode">{i18n.t('Appearance mode')}</label>
              <select id="display-mode" class="field" bind:value={displayForm.mode}>
                <option value="dark">{i18n.t('Dark')}</option>
                <option value="light">{i18n.t('Light')}</option>
              </select>
            </div>
          </div>

          <div
            class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-4"
            data-theme={displayForm.theme}
            data-mode={displayForm.mode}
            style:font-family=`,
  'theme controls'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `            <div class="field-group">
              <label class="field-label" for="display-font">{i18n.t('Font family')}</label>`,
  `            <div class="field-group">
              <label class="field-label" for="display-scroll-follow">{i18n.t('Scroll following')}</label>
              <select
                id="display-scroll-follow"
                class="field"
                bind:value={displayForm.scrollFollow}
              >
                {#each SCROLL_FOLLOW_MODES as mode (mode)}
                  <option value={mode}>{i18n.t(SCROLL_FOLLOW_LABELS[mode])}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-font">{i18n.t('Font family')}</label>`,
  'scroll following control'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                class="accent-violet-500"
                bind:checked={displayForm.chatAvatarMode}`,
  `          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                class="accent-violet-500"
                bind:checked={displayForm.streamingOutput}
                aria-label={i18n.t('Streaming output')}
              />
              <span>
                {i18n.t('Streaming output')}
                <span class="ml-1 text-xs text-neutral-500">
                  {i18n.t('Show partial output while the model is writing.')}
                </span>
              </span>
            </label>
            <label class="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                class="accent-violet-500"
                bind:checked={displayForm.chatAvatarMode}`,
  'streaming output control'
)

const pkgPath = 'package.json'
const pkg = JSON.parse(read(pkgPath))
pkg.name = 'machina'
pkg.version = '1.0.35'
pkg.description = 'Machina AI Roleplay Chat'
pkg.bin = { ...pkg.bin, machina: './srv/bin.js' }
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log('Machina overlap resolution applied')
