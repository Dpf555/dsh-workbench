// Fetch the vendored runtime assets:
//   1. monaco-editor (VS Code editor core, npm build) -> assets/vs/
//   2. regenerate seti.css / seti-map.json from the vendored theme
// Uses `npm pack` + `tar` so no node_modules state is touched (the npm
// installer is known to drop files from the monaco tarball on Windows).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MONACO_VERSION = '0.52.2'
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const tmp = join(repoRoot, '.tmp-assets')
const assets = join(repoRoot, 'assets')

const run = (cmd, args, cwd) => {
  const result = spawnSync(cmd, args, { cwd, shell: process.platform === 'win32', stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${result.status})`)
}

if (!existsSync(join(assets, 'vs', 'loader.js'))) {
  console.log(`[1/2] downloading monaco-editor@${MONACO_VERSION} …`)
  mkdirSync(tmp, { recursive: true })
  run('npm', ['pack', `monaco-editor@${MONACO_VERSION}`, '--pack-destination', tmp], repoRoot)
  run('tar', ['-xf', join(tmp, `monaco-editor-${MONACO_VERSION}.tgz`), '-C', tmp])
  const src = join(tmp, 'package', 'min', 'vs')
  mkdirSync(join(assets, 'vs'), { recursive: true })
  if (process.platform === 'win32') {
    const copy = spawnSync('robocopy', [src, join(assets, 'vs'), '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' })
    if (copy.status === null || copy.status >= 8) throw new Error(`robocopy failed (exit ${copy.status})`)
  } else {
    run('cp', ['-r', src + '/.', join(assets, 'vs')])
  }
  rmSync(tmp, { recursive: true, force: true })
  console.log('monaco assets ready at assets/vs/')
} else {
  console.log('[1/2] assets/vs already present — skipped')
}

console.log('[2/2] generating seti assets …')
await import('./generate-seti.mjs')
console.log('done. The workbench bundle serves from /wb/* once the host plugin is mounted.')
