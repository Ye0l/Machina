import { readFileSync, writeFileSync } from 'node:fs'

const path = 'app/tests/e2e/stub-server.ts'
let source = readFileSync(path, 'utf8')

const resetNeedle = `      this.templateCalls = []
      // Rebuilt rather than trimmed:`
const resetReplacement = `      this.templateCalls = []
      user.ui = {}
      // Rebuilt rather than trimmed:`

if (!source.includes('user.ui = {}')) {
  if (!source.includes(resetNeedle)) throw new Error('Could not find stub reset insertion point')
  source = source.replace(resetNeedle, resetReplacement)
}

const initNeedle = `      if (path === '/api/user/init') {
        if (!req.headers.authorization) return json({ message: 'Unauthorized' }, 401)
        return json({
          user: { ...user, providers: state.providers },
          profile,
          presets: state.presets,
        })
      }

      if (path === '/api/persona' && req.method === 'GET') {`
const initReplacement = `      if (path === '/api/user/init') {
        if (!req.headers.authorization) return json({ message: 'Unauthorized' }, 401)
        return json({
          user: { ...user, providers: state.providers },
          profile,
          presets: state.presets,
        })
      }

      if (path === '/api/user/ui' && req.method === 'POST') {
        const body = await readBody(req)
        Object.assign(user.ui, body)
        return json({ success: true })
      }

      if (path === '/api/persona' && req.method === 'GET') {`

if (!source.includes("path === '/api/user/ui'")) {
  if (!source.includes(initNeedle)) throw new Error('Could not find user init insertion point')
  source = source.replace(initNeedle, initReplacement)
}

writeFileSync(path, source)
