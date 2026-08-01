import { Router } from 'express'
import { assertValid } from '/common/valid'
import { PERSONA_FORMATS } from '../../common/adapters'
import { store } from '../db'
import { loggedIn } from './auth'
import { handle, StatusError } from './wrap'

const router = Router()

/** Mirrors the character route's persona validator, since it is the same shape. */
const personaValidator = {
  kind: PERSONA_FORMATS,
  attributes: 'any',
} as const

const validPersona = {
  name: 'string',
  persona: 'any',
} as const

const getUserPersonas = handle(async ({ userId }) => {
  const personas = await store.personas.getPersonas(userId!)
  return { personas }
})

const createPersona = handle(async ({ body, userId }) => {
  assertValid(validPersona, body)
  assertValid(personaValidator, body.persona)

  if (!body.name.trim()) {
    throw new StatusError('A persona requires a name', 400)
  }

  return store.personas.createPersona(userId!, { name: body.name, persona: body.persona })
})

const updatePersona = handle(async ({ body, userId, params }) => {
  assertValid(validPersona, body)
  assertValid(personaValidator, body.persona)

  if (!body.name.trim()) {
    throw new StatusError('A persona requires a name', 400)
  }

  const persona = await store.personas.updatePersona(userId!, params.id, {
    name: body.name,
    persona: body.persona,
  })

  if (!persona) throw new StatusError('Persona not found', 404)
  return persona
})

const removePersona = handle(async ({ userId, params }) => {
  await store.personas.deletePersona(userId!, params.id)
  return { success: true }
})

router.get('/', loggedIn, getUserPersonas)
router.post('/', loggedIn, createPersona)
router.post('/:id', loggedIn, updatePersona)
router.delete('/:id', loggedIn, removePersona)

export default router
