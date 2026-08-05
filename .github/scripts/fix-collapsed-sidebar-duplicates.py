from pathlib import Path

root = Path('.')

# Provider duplication must happen server-side so the encrypted API key and hidden options survive.
path = root / 'app/src/lib/settings.svelte.ts'
s = path.read_text(encoding='utf-8')
old = '''  async duplicateProvider(provider: AppSchema.Provider, name: string): Promise<boolean> {
    this.providerSaving = true
    this.error = ''
    try {
      const user = await api.post<AppSchema.User>('/user/provider', {
        _id: '',
        name: name.trim(),
        provider: provider.provider,
        url: provider.url,
        key: '',
        subFormat: provider.subFormat,
        format: provider.format,
      })
      session.user = user
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to duplicate provider'
      return false
    } finally {
      this.providerSaving = false
    }
  }'''
new = '''  async duplicateProvider(provider: AppSchema.Provider, name: string): Promise<boolean> {
    this.providerSaving = true
    this.error = ''
    try {
      const user = await api.post<AppSchema.User>(`/user/provider/${provider._id}/duplicate`, {
        name: name.trim(),
      })
      session.user = user
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to duplicate provider'
      return false
    } finally {
      this.providerSaving = false
    }
  }'''
if old not in s:
    raise SystemExit('provider client duplicate anchor not found')
s = s.replace(old, new)
path.write_text(s, encoding='utf-8')

path = root / 'srv/api/user/settings.ts'
s = path.read_text(encoding='utf-8')
anchor = '''export const saveProvider = handle(async ({ userId, body }) => {'''
handler = '''export const duplicateProvider = handle(async ({ userId, params, body }) => {
  assertValid({ name: 'string' }, body)
  const user = await getUser(userId!)
  if (!user) throw errors.Forbidden

  const source = user.providers?.find((provider) => provider._id === params.id)
  if (!source) throw new StatusError('Provider not found', 404)

  const name = body.name.trim()
  if (!name) throw new StatusError('A provider requires a name', 400)

  const providers = [
    ...(user.providers ?? []),
    {
      ...source,
      _id: v4(),
      name,
    },
  ]
  await store.users.updateUser(userId!, { providers })
  return toSafeUser({ ...user, providers })
})

'''
if anchor not in s:
    raise SystemExit('provider server anchor not found')
s = s.replace(anchor, handler + anchor)
path.write_text(s, encoding='utf-8')

path = root / 'srv/api/user/index.ts'
s = path.read_text(encoding='utf-8')
s = s.replace('  deleteProvider,\n', '  deleteProvider,\n  duplicateProvider,\n')
s = s.replace(
"router.post('/provider', loggedIn, saveProvider)\n",
"router.post('/provider', loggedIn, saveProvider)\nrouter.post('/provider/:id/duplicate', loggedIn, duplicateProvider)\n"
)
path.write_text(s, encoding='utf-8')
