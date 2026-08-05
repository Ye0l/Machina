from pathlib import Path
import json

root = Path('.')

readme = r'''# Machina

자체 호스팅 가능한 AI 캐릭터 롤플레잉 채팅 애플리케이션입니다.

Machina는 캐릭터, 페르소나, 메모리북, 프롬프트 템플릿과 생성 프리셋을 한곳에서 관리하고 여러 AI 제공자를 연결해 장기 롤플레잉 대화를 운영할 수 있도록 만든 웹 애플리케이션입니다. 데스크톱과 모바일 브라우저를 지원하며 PWA로 설치할 수 있습니다.

> 이 프로젝트는 [Agnaistic](https://github.com/agnaistic/agnai)을 기반으로 크게 개조한 포크입니다. Agnaistic은 초기 [Galatea UI](https://github.com/PygmalionAI/galatea-ui)의 작업을 기반으로 합니다.

## 주요 기능

### 캐릭터와 대화

- 캐릭터 생성, 편집, 복제, 삭제
- 캐릭터별 채팅 작업 공간과 최근 채팅 목록
- 다중 캐릭터 및 그룹 대화
- 메시지 수정, 재생성, 삭제
- 특정 메시지에서 새 대화 분기
- 긴 대화의 점진적 로딩과 이전 기록 확장
- Markdown 렌더링과 캐릭터 에셋 태그 출력
- 캐릭터 이미지 및 폴더형 에셋 관리
- PNG 카드, JSON, CHARX 가져오기 및 내보내기

### 페르소나와 메모리

- 사용자 페르소나 생성, 편집, 복제
- 채팅별 화자 페르소나 선택
- 메모리북 및 로어북 생성, 편집, 복제
- 키워드 기반 메모리 삽입
- 항상 포함되는 메모리 항목
- 캐릭터 전용 내장 메모리북
- 채팅별 메모리북 연결

### 프롬프트와 RisuAI 호환

- 재사용 가능한 프롬프트 템플릿
- 프롬프트 순서와 시스템 프롬프트 편집
- RisuAI 프리셋 가져오기
- Risu 토글 매크로 파싱과 실행
- 채팅 중 프롬프트 토글 변경
- 토글 기본값을 프리셋에 저장
- 정규식 기반 표시 후처리
- 프롬프트 미리보기와 토큰 수 확인

### AI 제공자와 생성 프리셋

- OpenAI 호환 API, OpenRouter, Anthropic Claude, Google Gemini
- NovelAI, Kobold 계열 API, AI Horde, Replicate 등 기존 Agnaistic 제공자
- 제공자와 프리셋 생성, 편집, 복제, 삭제
- 모델, 온도, 최대 출력 토큰, 컨텍스트 크기 설정
- Thinking/Reasoning 활성화와 강도 설정
- Thinking 토큰 예산, 추론 마커, 최종 출력 제외 설정
- `top_p`, `seed`, `reasoning` 등 임의 요청 파라미터 JSON 추가
- 제공자별 사용자 정의 요청 값을 기본 페이로드에 병합

### 인터페이스와 PWA

- Svelte 5 기반 반응형 UI
- 데스크톱 접이식 사이드바와 모바일 서랍 메뉴
- 채팅 헤더의 프롬프트 토글과 채팅 설정
- 색상 테마와 라이트/다크 모드
- 한국어/영어 인터페이스
- 홈 화면 설치, Web App Manifest, Service Worker 앱 셸 캐시
- iOS standalone, Dynamic Island, 홈 인디케이터 safe area 대응
- 모바일 입력 자동 확대와 전역 확대 방지
- 빌드 버전과 커밋 해시 표시

### 계정과 서버

- 사용자 가입과 로그인
- JWT 기반 세션
- MongoDB 영속 저장
- Redis 기반 분산 WebSocket 지원
- 초기 관리자 계정 설정
- Docker Compose 및 Podman Compose 지원
- 업로드 파일과 데이터베이스 볼륨 영속화

## 기술 구성

- **Frontend:** Svelte 5, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB
- **Distributed messaging:** Redis
- **Tests:** Vitest, Mocha, Playwright
- **Package manager:** pnpm
- **Optional pipeline:** Python, Poetry

## 요구 사항

- Node.js `^20.19.0` 또는 `>=22.12.0`
- Corepack
- pnpm 10
- MongoDB
- Redis — 다중 인스턴스 또는 분산 배포 시
- Docker Compose 또는 Podman Compose — 컨테이너 배포 시
- Python 3.10 이상 — 선택적 파이프라인 사용 시

## 빠른 시작

```sh
git clone https://github.com/Ye0l/Machina.git
cd Machina

corepack enable
pnpm install --frozen-lockfile
pnpm run up
pnpm run build:all
pnpm start
```

- API와 빌드된 애플리케이션: `http://localhost:3001`
- Vite 개발 서버: `http://localhost:1234`

## 자체 호스팅

```sh
cp .env.selfhost.example .env
```

`.env`에서 최소한 다음 값을 설정합니다.

```env
JWT_SECRET=충분히_긴_고정_문자열
INITIAL_USER=admin
INITIAL_PASSWORD=변경할_초기_비밀번호
```

그다음 전체 스택을 실행합니다.

```sh
pnpm run docker:up
```

애플리케이션은 `http://localhost:3001`에서 열립니다.

`JWT_SECRET`은 반드시 고정해서 유지해야 합니다. 값을 변경하면 기존 JWT 세션이 모두 무효화됩니다. `INITIAL_USER`와 `INITIAL_PASSWORD`는 컨테이너가 시작될 때 초기 계정을 생성하거나 기존 계정의 비밀번호를 해당 값으로 재설정합니다.

MongoDB와 Redis는 Compose 네트워크 내부에서만 접근하며, 데이터베이스와 업로드 파일은 이름 있는 볼륨에 저장됩니다. `docker compose down`은 데이터를 유지하지만 `down -v`는 볼륨도 삭제합니다.

## 주요 명령어

| 명령어 | 설명 |
| --- | --- |
| `pnpm start` | Vite, API 서버, 서버 TypeScript 감시 실행 |
| `pnpm run build` | Svelte 프론트엔드 빌드 |
| `pnpm run build:server` | 서버와 공통 TypeScript 컴파일 |
| `pnpm run build:all` | 프론트엔드와 서버 전체 빌드 |
| `pnpm run selfhost` | 전체 빌드 후 자체 호스팅 모드 실행 |
| `pnpm run up` | 개발용 MongoDB와 Redis 실행 |
| `pnpm run docker:up` | 전체 컨테이너 스택 빌드 및 실행 |
| `pnpm run docker:build` | 현재 커밋 정보를 포함해 이미지 재빌드 |
| `pnpm run docker:down` | 컨테이너 스택 종료 |
| `pnpm run docker:logs` | 애플리케이션 로그 확인 |
| `pnpm run check` | 포맷, 타입, 서버 테스트, 단위 테스트 실행 |
| `pnpm run test:e2e` | 프로덕션 빌드 후 Playwright E2E 실행 |

## 설정 파일

저장소 루트에 `settings.json`을 만들면 배포 전체에 적용되는 동작을 설정할 수 있습니다. 사용 가능한 값은 [`template.settings.json`](./template.settings.json)을 참고하십시오. 변경 후 서버를 재시작해야 합니다.

## 개발과 검증

```sh
pnpm install --frozen-lockfile
pnpm run format:fix
pnpm run check
pnpm run test:e2e
```

현재 기본 프론트엔드는 `app/`의 Svelte 애플리케이션입니다.

## 라이선스

이 프로젝트는 [GNU Affero General Public License v3.0](./LICENSE)에 따라 배포됩니다.
'''
(root / 'README.md').write_text(readme, encoding='utf-8')

app_shell = root / 'app/src/shared/AppShell.svelte'
s = app_shell.read_text(encoding='utf-8')
s = s.replace("  import RisuImportButton from './RisuImportButton.svelte'\n", '')
s = s.replace('\n<RisuImportButton />\n<RisuTogglePanel />', '\n<RisuTogglePanel />')
app_shell.write_text(s, encoding='utf-8')

settings = root / 'app/src/routes/Settings.svelte'
s = settings.read_text(encoding='utf-8')
s = s.replace('    Trash2,\n    Wifi,', '    Trash2,\n    Upload,\n    Wifi,')
s = s.replace("  import type { SettingsTab } from '/app/lib/router.svelte'\n", "  import type { SettingsTab } from '/app/lib/router.svelte'\n  import RisuImportButton from '/app/shared/RisuImportButton.svelte'\n")
needle = '''      {:else}\n        <!-- Preset list -->\n        {#if !presets.length}'''
replacement = '''      {:else}\n        <!-- Preset list -->\n        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-3">\n          <div>\n            <h2 class="text-sm font-semibold text-neutral-200">{i18n.t('Generation presets')}</h2>\n            <p class="mt-0.5 text-xs text-neutral-500">\n              {i18n.t('Create a preset or import one exported from RisuAI.')}\n            </p>\n          </div>\n          <div class="flex flex-wrap items-center gap-2">\n            <RisuImportButton />\n            {#if providers.length}\n              <button class="button-primary" type="button" onclick={startAddPreset}>\n                <Plus size={17} />\n                {i18n.t('New preset')}\n              </button>\n            {/if}\n          </div>\n        </div>\n        {#if !presets.length}'''
if needle not in s:
    raise SystemExit('preset list anchor not found')
s = s.replace(needle, replacement)
old_empty_button = '''            {#if providers.length}\n              <button class="button-primary mt-1" type="button" onclick={startAddPreset}>\n                <Plus size={17} />\n                {i18n.t('New preset')}\n              </button>\n            {/if}\n'''
s = s.replace(old_empty_button, '')
settings.write_text(s, encoding='utf-8')

component = root / 'app/src/shared/RisuImportButton.svelte'
s = component.read_text(encoding='utf-8')
s = s.replace("  import { router } from '/app/lib/router.svelte'\n", '')
s = s.replace("\n  const route = $derived(router.route)\n  const visible = $derived(route.name === 'settings' && route.tab === 'presets')", '')
start = s.index('{#if visible}')
markup = '''<div class="flex flex-col items-end gap-2">\n  <input\n    bind:this={input}\n    class="hidden"\n    type="file"\n    accept=".risup,.risupreset,application/octet-stream"\n    onchange={chooseFile}\n  />\n  <button\n    class="button-secondary"\n    type="button"\n    disabled={!providers.length || importing}\n    title={!providers.length ? i18n.t('Add a provider before importing a preset.') : undefined}\n    onclick={() => input?.click()}\n  >\n    <Upload size={17} />\n    {importing ? i18n.t('Importing...') : i18n.t('Import RisuAI preset')}\n  </button>\n  {#if message}\n    <p class="max-w-sm text-right text-xs text-neutral-400" aria-live="polite">{message}</p>\n  {/if}\n</div>\n'''
s = s[:start] + markup
component.write_text(s, encoding='utf-8')

pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['homepage'] = 'https://github.com/Ye0l/Machina'
pkg['repository']['url'] = 'git+https://github.com/Ye0l/Machina.git'
pkg['bugs']['url'] = 'https://github.com/Ye0l/Machina/issues'
for name in ['legacy:web', 'legacy:build']:
    pkg['scripts'].pop(name, None)
pkg['scripts']['format'] = pkg['scripts']['format'].replace(' "web/**/*.{tsx,ts,css,html}"', '')
pkg['scripts']['format:fix'] = pkg['scripts']['format:fix'].replace(' "web/**/*.{tsx,ts,css,html}"', '')
legacy_deps = [
    '@css-hooks/solid', '@thisbeyond/solid-dnd', '@parcel/config-default', '@parcel/core',
    '@parcel/packager-raw-url', '@parcel/resolver-glob', '@parcel/transformer-inline-string',
    '@parcel/transformer-sass', '@parcel/transformer-webmanifest', '@solidjs/router',
    'babel-preset-solid', 'lucide-solid', 'parcel', 'parcel-resolver-ignore', 'solid-js',
    'solid-refresh'
]
for name in legacy_deps:
    pkg.get('dependencies', {}).pop(name, None)
    pkg.get('devDependencies', {}).pop(name, None)
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

ts_path = root / 'tsconfig.json'
ts = json.loads(ts_path.read_text(encoding='utf-8'))
ts['compilerOptions'].pop('jsx', None)
ts['compilerOptions'].pop('jsxImportSource', None)
ts['compilerOptions']['paths'].pop('/web/*', None)
ts['include'] = ['srv', 'common', 'tests']
ts_path.write_text(json.dumps(ts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
