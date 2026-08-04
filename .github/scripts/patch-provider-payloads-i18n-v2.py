from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# Validate and merge providerSettings for every mapped adapter.
p = Path('common/presets.ts')
s = p.read_text()
s = replace_once(
    s,
    "import { optionalArray } from './valid/types'",
    "import { optionalArray } from './valid/types'\nimport { mergeProviderSettings } from './provider-settings'",
    'common provider settings import',
)
s = replace_once(
    s,
    """  // reasoning: {
  //   '?': '?',
  //   start: 'string?',
  //   end: 'string?',
  // },
  presetMode: ['simple', 'advanced', null],
""",
    """  reasoning: 'any?',
  providerSettings: 'any?',
  presetMode: ['simple', 'advanced', null],
""",
    'preset reasoning validation',
)
s = replace_once(s, '  return body\n}\n\nexport const serviceGenMap', '  return mergeProviderSettings(body, presets.providerSettings)\n}\n\nexport const serviceGenMap', 'mapped payload merge')
p.write_text(s)

# OpenAI-compatible providers build payloads manually, so merge custom JSON immediately before dispatch.
p = Path('srv/adapter/openai.ts')
s = p.read_text()
s = replace_once(
    s,
    "import { adjustMessageFormatting } from './util'",
    "import { adjustMessageFormatting } from './util'\nimport { mergeProviderSettings } from '/common/provider-settings'",
    'OpenAI provider settings import',
)
s = replace_once(
    s,
    """  if (!body.stop?.length) {
    delete body.stop
  }

  const iter = body.stream
""",
    """  if (!body.stop?.length) {
    delete body.stop
  }

  // User-defined provider parameters intentionally win over generated defaults.
  mergeProviderSettings(body, gen.providerSettings)

  const iter = body.stream
""",
    'OpenAI custom payload merge',
)
p.write_text(s)

# Claude also builds its request manually.
p = Path('srv/adapter/claude.ts')
s = p.read_text()
s = replace_once(
    s,
    "import { stripImageContent, toChatMessages } from '/common/template-messages'",
    "import { stripImageContent, toChatMessages } from '/common/template-messages'\nimport { mergeProviderSettings } from '/common/provider-settings'",
    'Claude provider settings import',
)
s = replace_once(
    s,
    """  if (opts.kind === 'plain') {
    payload.stream = false
  }

  const headers: any = {
""",
    """  if (opts.kind === 'plain') {
    payload.stream = false
  }

  // User-defined provider parameters intentionally win over generated defaults.
  mergeProviderSettings(payload, gen.providerSettings)

  const headers: any = {
""",
    'Claude custom payload merge',
)
p.write_text(s)

# Sidebar terminology.
p = Path('app/src/shared/Sidebar.svelte')
s = p.read_text().replace("{i18n.t('AI settings')}", "{i18n.t('Settings')}")
p.write_text(s)

# Korean labels for the new actions and controls.
p = Path('app/src/lib/i18n.svelte.ts')
s = p.read_text()
anchor = "  'AI settings': 'AI 설정',\n"
entries = """  Duplicate: '복제',
  'Duplicate {name}': '{name} 복제',
  '{name} (copy)': '{name} (복사본)',
  'Duplicate template': '템플릿 복제',
  'Advanced model parameters': '고급 모델 파라미터',
  'Enable thinking / reasoning': 'Thinking / 추론 활성화',
  'Thinking effort': 'Thinking 강도',
  Low: '낮음',
  Medium: '중간',
  High: '높음',
  'Custom token budget': '사용자 지정 토큰 예산',
  'Thinking token budget': 'Thinking 토큰 예산',
  'Exclude thinking from the final response': '최종 응답에서 Thinking 내용 제외',
  'Reasoning start marker': '추론 시작 마커',
  'Reasoning end marker': '추론 종료 마커',
  'Custom request parameters': '사용자 지정 요청 파라미터',
  'Enter a JSON object. These values are merged into the provider request last, so they can add or override provider-specific parameters.':
    'JSON 객체를 입력하세요. 이 값은 프로바이더 요청에 마지막으로 병합되어 전용 파라미터를 추가하거나 기존 값을 덮어씁니다.',
  'Custom request parameters must be a JSON object.':
    '사용자 지정 요청 파라미터는 JSON 객체여야 합니다.',
  'Custom request parameters contain invalid JSON.':
    '사용자 지정 요청 파라미터의 JSON 형식이 올바르지 않습니다.',
"""
if "  Duplicate: '복제'," not in s:
    s = replace_once(s, anchor, anchor + entries, 'i18n advanced entries')
p.write_text(s)

# Version bump.
p = Path('package.json')
s = p.read_text()
if '"version": "1.0.37"' in s:
    s = s.replace('"version": "1.0.37"', '"version": "1.0.38"', 1)
p.write_text(s)
