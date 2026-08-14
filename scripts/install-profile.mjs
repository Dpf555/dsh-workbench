// Install the plugin package into a DSH profile so it activates on the next
// `dsh web` restart:
//   1. copies this repo (package.json, index.js, client.js, assets/) into
//      <DSH_HOME>/profiles/<profile>/node_modules/@dsh-local/dsh-workbench/
//   2. appends the `workbench` row to the profile's cordis.patch.yml (idempotent)
//
// Usage:
//   node scripts/install-profile.mjs [--profile web] [--dry-run]
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')

function parseArgs(argv) {
  const opts = { profile: 'web', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile') opts.profile = argv[++i]
    else if (argv[i] === '--dry-run') opts.dryRun = true
  }
  return opts
}
const opts = parseArgs(process.argv.slice(2))
const dshHome = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
const profileDir = join(dshHome, 'profiles', opts.profile)
const target = join(profileDir, 'node_modules', '@dsh-local', 'dsh-workbench')
const patchFile = join(profileDir, 'cordis.patch.yml')

if (!existsSync(profileDir)) {
  console.error(`profile directory not found: ${profileDir}`)
  process.exit(1)
}
if (!existsSync(join(repoRoot, 'assets', 'vs', 'loader.js'))) {
  console.error('assets/vs is missing — run `npm run setup:assets` first.')
  process.exit(1)
}
console.log(`DSH_HOME: ${dshHome}`)
console.log(`profile: ${opts.profile}${opts.dryRun ? '  [dry-run]' : ''}`)
console.log(`target: ${target}`)

if (!opts.dryRun) {
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, 'assets'), { recursive: true })
  for (const file of ['package.json', 'index.js', 'client.js']) copyFileSync(join(repoRoot, file), join(target, file))
  const copyDir = (src, dst) => {
    mkdirSync(dst, { recursive: true })
    for (const entry of readdirSync(src)) {
      const s = join(src, entry)
      const d = join(dst, entry)
      if (statSync(s).isDirectory()) copyDir(s, d)
      else copyFileSync(s, d)
    }
  }
  copyDir(join(repoRoot, 'assets'), join(target, 'assets'))
  console.log('✓ package copied')
}

// composition row (idempotent)
let text = ''
try { text = readFileSync(patchFile, 'utf8') } catch (e) {}
if (text.includes('@dsh-local/dsh-workbench')) {
  console.log('✓ cordis.patch.yml already contains the workbench row')
} else {
  const row = '\n# DSH Code Workbench: VS Code-style Explorer + Monaco editor.\n- insert:\n    - id: workbench\n      name: \'@dsh-local/dsh-workbench\'\n'
  if (!opts.dryRun) writeFileSync(patchFile, text.replace(/\s*$/, '') + row + '\n')
  console.log(`${opts.dryRun ? 'would append' : '✓ appended'} the workbench row to cordis.patch.yml`)
}

console.log('\nNext: run `npm run patch:checkout` (three-column layout patches), then restart `dsh web` and hard-refresh the page.')
