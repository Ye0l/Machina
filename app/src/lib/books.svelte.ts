import type { AppSchema } from '/common/types'
import { api } from './api'
import { subscribe } from './socket'

/**
 * Memory book state (`srv/api/memory`).
 *
 * The server replaces `entries` wholesale on update but only `$set`s name, description and
 * entries, so book-level V2 fields (`scanDepth`, `tokenBudget`, ...) survive on their own.
 * Per-entry V2 fields do not, which is why `toDraft`/save round-trip whole entry objects
 * rather than rebuilding them from the fields this editor exposes.
 */

export type BookDraft = {
  name: string
  description: string
  entries: AppSchema.MemoryEntry[]
}

class Books {
  books = $state<AppSchema.MemoryBook[]>([])

  loading = $state(false)
  error = $state('')
  loaded = $state(false)

  /**
   * The in-flight request, not a boolean: the shell and the book editor both call `load()`
   * on the same tick when `/memory/:id` is opened directly. A boolean guard would let the
   * editor fall through to an empty list and report the book as missing.
   */
  private request: Promise<void> | undefined

  async load(force = false) {
    if (this.loaded && !force) return
    if (this.request) return this.request

    this.request = this.fetch()
    try {
      await this.request
    } finally {
      this.request = undefined
    }
  }

  private async fetch() {
    this.loading = true
    this.error = ''
    try {
      const res = await api.get<{ books: AppSchema.MemoryBook[] }>('/memory')
      this.books = res.books ?? []
      this.loaded = true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to load memory books'
    } finally {
      this.loading = false
    }
  }

  get(bookId: string) {
    return this.books.find((book) => book._id === bookId)
  }

  /** Returns the created book, whose id the caller navigates to. */
  async create(draft: BookDraft): Promise<AppSchema.MemoryBook | undefined> {
    this.error = ''
    try {
      const book = await api.post<AppSchema.MemoryBook>('/memory', draft)
      this.books = [book, ...this.books]
      return book
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to create memory book'
    }
  }

  /** `PUT /memory/:id` returns only `{ success }`, so the local copy is patched by hand. */
  async update(bookId: string, draft: BookDraft) {
    this.error = ''
    try {
      await api.put(`/memory/${bookId}`, draft)
      this.books = this.books.map((book) => (book._id === bookId ? { ...book, ...draft } : book))
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save memory book'
      return false
    }
  }

  async remove(bookId: string) {
    this.error = ''
    try {
      await api.del(`/memory/${bookId}`)
      this.books = this.books.filter((book) => book._id !== bookId)
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete memory book'
      return false
    }
  }

  reset() {
    this.books = []
    this.loaded = false
    this.error = ''
  }
}

export const books = new Books()

subscribe('app-logout', () => books.reset())
