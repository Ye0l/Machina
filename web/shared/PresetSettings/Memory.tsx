import { Component } from 'solid-js'
import RangeInput from '../RangeInput'
import { Toggle } from '../Toggle'
import { PresetTabProps } from '/web/store/preset-context'
import { SUMMARY_CONTEXT_LIMIT, SUMMARY_THRESHOLD } from '/common/summary'

export const MemorySettings: Component<PresetTabProps> = (props) => {
  return (
    <div class="flex flex-col gap-4" classList={{ hidden: props.tab !== 'Memory' }}>
      <div class="flex flex-col gap-2">
        <RangeInput
          fieldName="memoryContextLimit"
          label="Memory: Context Limit"
          helperText="The maximum context budget (in tokens) for the memory book."
          min={1}
          max={2000}
          step={1}
          value={props.state.memoryContextLimit ?? 500}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('memoryContextLimit', ev)}
        />

        <RangeInput
          fieldName="memoryChatEmbedLimit"
          label="Memory: Long-term Memory Context Budget"
          helperText="If available: The maximum context budget (in tokens) for long-term memory."
          min={1}
          max={10000}
          step={1}
          value={props.state.memoryChatEmbedLimit ?? 500}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('memoryChatEmbedLimit', ev)}
        />

        <RangeInput
          fieldName="memoryUserEmbedLimit"
          label="Memory: Embedding Context Budget"
          helperText="If available: The maximum context budget (in tokens) for document embeddings."
          min={1}
          max={10000}
          step={1}
          value={props.state.memoryUserEmbedLimit ?? 500}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('memoryUserEmbedLimit', ev)}
        />

        <RangeInput
          fieldName="memoryDepth"
          label="Memory: Chat History Depth"
          helperText="Number of messages to scan in chat history to scan for memory book keywords."
          min={1}
          max={100}
          step={1}
          value={props.state.memoryDepth || 50}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('memoryDepth', ev)}
        />

        <Toggle
          fieldName="summaryEnabled"
          label="Story Summary"
          helperText="Maintain a running summary of the messages that have fallen out of the context window. Uses the Summary preset from your AI settings, and requires the Story Summary block in your prompt order."
          value={props.state.summaryEnabled ?? false}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('summaryEnabled', ev)}
        />

        <RangeInput
          fieldName="summaryContextLimit"
          label="Story Summary: Context Budget"
          helperText="The maximum context budget (in tokens) for the story summary."
          min={100}
          max={4000}
          step={50}
          value={props.state.summaryContextLimit ?? SUMMARY_CONTEXT_LIMIT}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('summaryContextLimit', ev)}
        />

        <RangeInput
          fieldName="summaryThreshold"
          label="Story Summary: Update Threshold"
          helperText="How many messages must fall out of context before the summary is rewritten."
          min={2}
          max={100}
          step={1}
          value={props.state.summaryThreshold ?? SUMMARY_THRESHOLD}
          disabled={props.state.disabled}
          onChange={(ev) => props.setters.setState('summaryThreshold', ev)}
        />
      </div>
    </div>
  )
}
