from pathlib import Path

p=Path('app/src/routes/Personas.svelte'); s=p.read_text()
s=s.replace("import { Pencil, Plus, UserRound }", "import { Copy, Pencil, Plus, UserRound }")
marker="  const personaText = (persona: { kind: string; attributes: Record<string, string[]> }) =>\n"
insert="""  const duplicatePersona = async (persona: import('/common/types').AppSchema.UserPersona) => {
    const created = await personas.create({ name: i18n.t('{name} (copy)', { name: persona.name }), persona: structuredClone(persona.persona) })
    if (created) router.go(routes.persona(created._id))
  }

"""+marker
if marker not in s: raise SystemExit('persona function marker missing')
s=s.replace(marker,insert,1)
old='''              <a
                class="icon-button shrink-0"
                href={routes.persona(persona._id)}'''
new='''              <div class="flex shrink-0 items-center gap-1">
                <button class="icon-button" type="button" aria-label={i18n.t('Duplicate {name}', { name: persona.name })} title={i18n.t('Duplicate')} onclick={() => duplicatePersona(persona)}><Copy size={16} /></button>
              <a
                class="icon-button shrink-0"
                href={routes.persona(persona._id)}'''
if old not in s: raise SystemExit('persona action marker missing')
s=s.replace(old,new,1).replace('''              </a>
            </div>
            <p class="mt-2 line-clamp-3''','''              </a>
              </div>
            </div>
            <p class="mt-2 line-clamp-3''',1)
p.write_text(s)

p=Path('app/src/routes/Characters.svelte'); s=p.read_text()
s=s.replace("import { MessageCircle, Pencil, Plus, Search, Upload, Users }", "import { Copy, MessageCircle, Pencil, Plus, Search, Upload, Users }")
marker='''  const openCharacter = async (character: CharacterSummary) => {
    const chatId = await chats.resolveChatFor(character)
    if (chatId) router.go(routes.chat(chatId))
  }
'''
insert=marker+'''  const duplicateCharacter = async (character: CharacterSummary) => {
    const source = await chats.getCharacter(character._id)
    pendingImport.set({ ...structuredClone(source), name: i18n.t('{name} (copy)', { name: source.name }) } as any)
    router.go(routes.newCharacter())
  }
'''
if marker not in s: raise SystemExit('character function marker missing')
s=s.replace(marker,insert,1)
old='''              <a
                class="icon-button"
                href={routes.character(character._id, 'edit')}'''
new='''              <button class="icon-button" type="button" aria-label={i18n.t('Duplicate {name}', { name: character.name })} title={i18n.t('Duplicate')} onclick={() => duplicateCharacter(character)}><Copy size={17} /></button>
              <a
                class="icon-button"
                href={routes.character(character._id, 'edit')}'''
if old not in s: raise SystemExit('character action marker missing')
p.write_text(s.replace(old,new,1))
