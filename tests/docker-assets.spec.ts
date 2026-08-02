import './init'
import { expect } from 'chai'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * The client bundle and the upload folder must not share a directory.
 *
 * They did: `ASSET_FOLDER` pointed at `dist/assets`, which is where Vite emits the bundle,
 * and the compose stack mounted a volume there. The volume hid the bundle, so `index.html`
 * asked for a content-hashed filename the volume did not have, the SPA fallback answered with
 * `index.html`, and the browser rejected it as the wrong MIME type. A white screen, with the
 * containers all reporting healthy.
 *
 * Read from the files rather than restated here, so this fails if either moves back.
 */

const repo = (path: string) => resolve(__dirname, '..', path)
const read = (path: string) => readFileSync(repo(path), 'utf8')

/** Vite's default, and unset in `app/vite.config.ts`, so the bundle lands in `dist/assets`. */
const BUNDLE_DIR = 'dist/assets'

describe('container asset layout', () => {
  const dockerfile = read('Dockerfile')
  const compose = read('docker-compose.selfhost.yml')

  const assetFolder = dockerfile.match(/ASSET_FOLDER=(\S+)/)?.[1]

  it('sets an upload folder in the image', () => {
    expect(assetFolder, 'ASSET_FOLDER not found in the Dockerfile').to.be.a('string')
  })

  it('keeps the upload folder out of the client bundle directory', () => {
    expect(assetFolder).to.not.include(BUNDLE_DIR)
  })

  it('declares no volume over the client bundle directory', () => {
    const volumes = dockerfile.match(/^VOLUME \[(.+)\]$/m)?.[1] ?? ''
    expect(volumes).to.not.include(BUNDLE_DIR)
  })

  it('mounts the compose volume where the image actually writes uploads', () => {
    const mount = compose.match(/-\s+assets:(\S+)/)?.[1]
    expect(mount, 'no assets volume mount found in the compose file').to.equal(assetFolder)
  })

  it('mounts nothing over the client bundle directory', () => {
    const mounts = compose.match(/-\s+\w+:\/\S+/g) ?? []
    expect(mounts.filter((mount) => mount.includes(BUNDLE_DIR))).to.deep.equal([])
  })
})
