class ChatControls {
  optionsOpen = $state(false)
  promptOpen = $state(false)

  toggleOptions() {
    this.optionsOpen = !this.optionsOpen
    if (this.optionsOpen) this.promptOpen = false
  }

  togglePrompt() {
    this.promptOpen = !this.promptOpen
    if (this.promptOpen) this.optionsOpen = false
  }

  closeOptions() {
    this.optionsOpen = false
  }

  closePrompt() {
    this.promptOpen = false
  }

  closeAll() {
    this.optionsOpen = false
    this.promptOpen = false
  }
}

export const chatControls = new ChatControls()
