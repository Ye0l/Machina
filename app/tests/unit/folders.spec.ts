import { describe, expect, it } from 'vitest'
import { groupByFolder, normalizeFolderPath } from '/common/folders'

describe('folder paths', () => {
  it('normalizes nested slash and backslash paths', () => {
    expect(normalizeFolderPath('  World // Locations\\ Night / ')).toBe('World/Locations/Night')
  })

  it('groups root first and named folders naturally', () => {
    const groups = groupByFolder(
      [{ name: 'root' }, { name: 'ten', folder: 'Scenes/10' }, { name: 'two', folder: 'Scenes/2' }],
      (item) => item.folder
    )

    expect(groups.map((group) => group.folder)).toEqual(['', 'Scenes/2', 'Scenes/10'])
    expect(groups[0].items.map((item) => item.name)).toEqual(['root'])
  })
})
