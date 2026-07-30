import { Component } from 'solid-js'
import Tabs, { useTabs } from '/web/shared/Tabs'
import { MessageUISettings } from './ui/MessageUISettings'
import { ChatUISettings } from './ui/ChatUISettings'
import { ThemeUISettings } from './ui/ThemeUISettings'
import Select from '/web/shared/Select'
import { LOCALE_OPTIONS, locale, setLocale } from '/web/i18n'

const TABS = {
  Theme: 'Theme',
  Chat: 'Chat',
  Messages: 'Messages',
}

const UISettings: Component<{}> = () => {
  const tabs = useTabs([TABS.Theme, TABS.Chat, TABS.Messages])

  return (
    <>
      <Select
        fieldName="language"
        label="Language"
        items={LOCALE_OPTIONS}
        value={locale()}
        onChange={(item) => setLocale(item.value)}
      />

      <Tabs tabs={tabs.tabs()} select={tabs.select} selected={tabs.selected} />

      <div classList={{ hidden: tabs.current() !== TABS.Theme }}>
        <ThemeUISettings />
      </div>

      <div classList={{ hidden: tabs.current() !== TABS.Chat }}>
        <ChatUISettings />
      </div>

      <div classList={{ hidden: tabs.current() !== TABS.Messages }}>
        <MessageUISettings />
      </div>
    </>
  )
}

export default UISettings
