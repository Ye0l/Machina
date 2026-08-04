import { readFileSync, writeFileSync } from 'node:fs'

const path = 'app/src/routes/Chat.svelte'
let source = readFileSync(path, 'utf8')

const stateBefore = `  let historyChatId = $state('')
  let loadingEarlier = $state(false)
  const visibleMessages = $derived(chats.messages.slice(visibleStart))`
const stateAfter = `  let historyChatId = $state('')
  let historyReady = $state(false)
  let loadingEarlier = $state(false)
  const visibleMessages = $derived(chats.messages.slice(visibleStart))`

if (!source.includes(stateAfter)) {
  if (!source.includes(stateBefore)) throw new Error('Dynamic history state insertion point not found')
  source = source.replace(stateBefore, stateAfter)
}

const behaviorBefore = `  const trackScrollPosition = () => {
    if (!messageList) return
    wasAtBottom = isScrollAtBottom(messageList)
    if (messageList.scrollTop < 280) void loadEarlierMessages()
  }

  $effect(() => {
    const chatId = detail.chat._id
    const count = chats.messages.length
    if (historyChatId !== chatId) {
      historyChatId = chatId
      visibleStart = findMessageWindowStart(chats.messages)
      return
    }
    if (visibleStart > count) visibleStart = findMessageWindowStart(chats.messages)
  })`

const behaviorAfter = `  const trackScrollPosition = () => {
    if (!messageList) return
    wasAtBottom = isScrollAtBottom(messageList)
    if (historyReady && messageList.scrollTop < 280) void loadEarlierMessages()
  }

  $effect(() => {
    const chatId = detail.chat._id
    const count = chats.messages.length
    if (historyChatId !== chatId) {
      historyChatId = chatId
      historyReady = false
      visibleStart = findMessageWindowStart(chats.messages)
      tick().then(() => {
        if (!messageList || historyChatId !== chatId) return
        messageList.scrollTop = messageList.scrollHeight
        wasAtBottom = true
        historyReady = true
      })
      return
    }
    if (visibleStart > count) visibleStart = findMessageWindowStart(chats.messages)
  })`

if (!source.includes(behaviorAfter)) {
  if (!source.includes(behaviorBefore)) throw new Error('Dynamic history behavior insertion point not found')
  source = source.replace(behaviorBefore, behaviorAfter)
}

writeFileSync(path, source)
