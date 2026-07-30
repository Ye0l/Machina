import { createSignal } from 'solid-js'

export type Locale = 'en' | 'ko'

export const LOCALE_OPTIONS: Array<{ label: string; value: Locale }> = [
  { label: 'English', value: 'en' },
  { label: '한국어', value: 'ko' },
]

const translations = {
  en: {
    login: 'Login',
    characters: 'Characters',
    chats: 'Chats',
    sagasPreview: 'Sagas Preview',
    library: 'Library',
    presets: 'Presets',
    sounds: 'Sounds',
    manage: 'Manage',
    configuration: 'Configuration',
    users: 'Users',
    subscriptions: 'Subscriptions',
    announcements: 'Announcements',
    persona: 'Persona',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    subscribe: 'Subscribe for higher quality chats and no ads',
  },
  ko: {
    login: '로그인',
    characters: '캐릭터',
    chats: '채팅',
    sagasPreview: '사가 미리보기',
    library: '라이브러리',
    presets: '프리셋',
    sounds: '사운드',
    manage: '관리',
    configuration: '환경 설정',
    users: '사용자',
    subscriptions: '구독',
    announcements: '공지사항',
    persona: '페르소나',
    termsOfService: '이용약관',
    privacyPolicy: '개인정보처리방침',
    subscribe: '구독하고 더 높은 품질의 채팅과 광고 없는 환경을 이용하세요',
  },
} as const

export type TranslationKey = keyof (typeof translations)['en']

const LOCALE_KEY = 'agnai-locale'

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  return stored === 'ko' ? 'ko' : 'en'
}

const [locale, updateLocale] = createSignal<Locale>(getInitialLocale())

export { locale }

export function setLocale(value: string) {
  const next: Locale = value === 'ko' ? 'ko' : 'en'
  localStorage.setItem(LOCALE_KEY, next)
  updateLocale(next)
  document.documentElement.lang = next
}

export function t(key: TranslationKey) {
  return translations[locale()][key]
}

document.documentElement.lang = locale()
