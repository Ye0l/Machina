import { v4 } from 'uuid'
import { db } from './client'
import { AppSchema } from '../../common/types/schema'
import { NewPersona } from '../../common/types/persona'

export async function getPersonas(userId: string) {
  return db('persona').find({ userId }).toArray()
}

export async function getPersona(userId: string, personaId: string) {
  const persona = await db('persona').findOne({ _id: personaId, userId })
  if (!persona) return
  return persona
}

export async function createPersona(userId: string, input: NewPersona) {
  const now = new Date().toISOString()
  const persona: AppSchema.UserPersona = {
    _id: v4(),
    kind: 'persona',
    userId,
    name: input.name,
    persona: input.persona,
    createdAt: now,
    updatedAt: now,
  }

  await db('persona').insertOne(persona)
  return persona
}

export async function updatePersona(userId: string, personaId: string, input: NewPersona) {
  await db('persona').updateOne(
    { _id: personaId, userId },
    {
      $set: {
        name: input.name,
        persona: input.persona,
        updatedAt: new Date().toISOString(),
      },
    }
  )

  return getPersona(userId, personaId)
}

export async function deletePersona(userId: string, personaId: string) {
  await db('persona').deleteOne({ _id: personaId, userId })
}
