import { Edit, Save } from 'lucide-solid'
import { Component, createEffect, createMemo, createSignal, JSX, on, Show } from 'solid-js'
import { AppSchema } from '../../../../common/types/schema'
import Button from '../../../shared/Button'
import Divider from '../../../shared/Divider'
import Select from '../../../shared/Select'
import { chatStore } from '../../../store'
import { memoryStore } from '../../../store'
import EmbedContent from '../../Memory/EmbedContent'
import { EditEmbedModal } from '/web/shared/EditEmbedModal'
import { Portal } from 'solid-js/web'
import { embedApi } from '/web/store/embeddings'
import { ManageMemoryBooks } from './ManageMemoryBooks'
import TextInput from '/web/shared/TextInput'
import { toastStore } from '/web/store'
import { botGen } from '/web/store/data/bot-generate'
import { elapsedSince } from '/common/util'

const ChatMemoryModal: Component<{
  chat: AppSchema.Chat | undefined
  close: () => void
  footer?: (children: JSX.Element) => void
}> = (props) => {
  const books = memoryStore((s) => ({
    books: s.books,
    items: s.books.list.map((book) => ({ label: book.name, value: book._id })),
    embeds: s.embeds,
  }))

  const [embedId, setEmbedId] = createSignal(props.chat?.userEmbedId)
  const [editingEmbed, setEditingEmbed] = createSignal<boolean>(false)

  createEffect(
    on(
      () => props.chat?.userEmbedId,
      (id) => {
        if (!id) return
        setEmbedId(id)
      }
    )
  )

  const useUserEmbed = () => {
    if (!props.chat?._id) return
    const id = embedId()
    chatStore.editChat(props.chat._id, { userEmbedId: id })

    if (id) {
      embedApi.loadDocument(id)
    }
  }

  const embeds = createMemo(() => {
    return [{ label: 'None', value: '' }].concat(
      books.embeds.map((em) => ({ label: `${em.name} [${em.state}]`, value: em.id }))
    )
  })

  return (
    <>
      <div class="flex flex-col gap-2">
        <ManageMemoryBooks
          bookIds={props.chat?.memoryId || ''}
          updateIds={(next) => {
            if (!props.chat?._id) return
            chatStore.editChat(props.chat?._id, { memoryId: next })
          }}
        />

        <Divider />
        <Show when={books.embeds.length > 0}>
          <Select
            fieldName="embedId"
            label="Embedding"
            helperText="Which user-created embedding to use."
            items={embeds()}
            onChange={(item) => setEmbedId(item.value)}
            value={embedId()}
          />
          <div class="flex items-center gap-1">
            <Button
              class="w-fit"
              disabled={embedId() === props.chat?.userEmbedId}
              onClick={useUserEmbed}
            >
              <Save />
              Use Embedding
            </Button>

            <Button
              class="w-fit"
              disabled={editingEmbed() || !embedId()}
              onClick={() => setEditingEmbed(true)}
            >
              <Edit size={16} />
              Edit
            </Button>

            <Button
              schema="error"
              class="w-fit"
              disabled={!embedId()}
              onClick={() => embedApi.removeDocument(embedId()!)}
            >
              Remove
            </Button>
          </div>
          <Portal>
            <EditEmbedModal
              show={editingEmbed()}
              embedId={embedId()}
              close={() => setEditingEmbed(false)}
            />
          </Portal>
          <Divider />
        </Show>
        <EmbedContent />

        <Divider />
        <ChatSummary chat={props.chat} />
      </div>
    </>
  )
}

const ChatSummary: Component<{ chat: AppSchema.Chat | undefined }> = (props) => {
  const [text, setText] = createSignal(props.chat?.summary || '')
  const [busy, setBusy] = createSignal(false)

  createEffect(
    on(
      () => props.chat?.summary,
      (summary) => setText(summary || '')
    )
  )

  const dirty = createMemo(() => text() !== (props.chat?.summary || ''))

  // Editing by hand must not move the anchor, otherwise the messages between the old and new anchor
  // would never make it into the summary
  const save = () => {
    if (!props.chat) return
    chatStore.editChatSummary(props.chat._id, text(), {
      summaryUpTo: props.chat.summaryUpTo,
      summaryCount: props.chat.summaryCount,
    })
  }

  const clear = () => {
    if (!props.chat) return
    setText('')
    chatStore.editChatSummary(props.chat._id, '', { summaryUpTo: '', summaryCount: 0 })
  }

  const regenerate = async () => {
    setBusy(true)
    try {
      const summary = await botGen.summariseActiveChat()
      if (!summary) {
        toastStore.warn(`Nothing to summarise yet - no messages have fallen out of context`)
      }
    } catch (ex: any) {
      toastStore.error(`Failed to generate summary: ${ex.message || ex}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex flex-col gap-2">
      <TextInput
        fieldName="chatSummary"
        label="Story Summary"
        helperText={
          <>
            A running summary of the messages that have fallen out of the context window. Enable it
            and set its token budget in your preset's <b>Memory</b> settings.
            <Show when={props.chat?.summaryUpdatedAt}>
              <div class="text-600 text-xs">
                Updated {elapsedSince(new Date(props.chat!.summaryUpdatedAt!))} ago, covering{' '}
                {props.chat?.summaryCount || 0} messages.
              </div>
            </Show>
          </>
        }
        isMultiline
        tokenCount
        value={text()}
        onChange={(ev) => setText(ev.currentTarget.value)}
      />

      <div class="flex items-center gap-1">
        <Button class="w-fit" disabled={!dirty()} onClick={save}>
          <Save size={16} />
          Save
        </Button>

        <Button class="w-fit" disabled={busy()} onClick={regenerate}>
          {busy() ? 'Summarising...' : 'Regenerate'}
        </Button>

        <Button
          schema="error"
          class="w-fit"
          disabled={!props.chat?.summary && !text()}
          onClick={clear}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

export default ChatMemoryModal
