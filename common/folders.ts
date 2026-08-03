export type FolderGroup<T> = { folder: string; items: T[] }

/** Canonical slash-separated folder path used by assets and memory books. */
export function normalizeFolderPath(value: string | undefined): string {
  return (value ?? '')
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

/** Groups flat records by folder path. Root comes first; named folders sort naturally. */
export function groupByFolder<T>(
  items: readonly T[],
  folderOf: (item: T) => string | undefined
): FolderGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const folder = normalizeFolderPath(folderOf(item))
    const group = groups.get(folder)
    if (group) group.push(item)
    else groups.set(folder, [item])
  }

  return Array.from(groups, ([folder, grouped]) => ({ folder, items: grouped })).sort((a, b) => {
    if (!a.folder) return -1
    if (!b.folder) return 1
    return a.folder.localeCompare(b.folder, undefined, { numeric: true })
  })
}
