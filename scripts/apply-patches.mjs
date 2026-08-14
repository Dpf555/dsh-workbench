// Apply the three client-bundle patches to a DSH checkout (the layout shell
// explorer track, the conversation view-switch bridge, and the sidebar
// bootstrap). The patched bundles are served per request by DSH, so a hard
// page refresh (Ctrl+F5) picks them up — no rebuild is required.
//
// Usage:
//   node scripts/apply-patches.mjs --checkout <checkout-root> [--dry-run]
//   node scripts/apply-patches.mjs                       # auto-detect under ~/.npm-cache/_npx
//
// --dry-run verifies each patch with `git apply --check` and changes nothing.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const patchesDir = join(repoRoot, 'patches')
const PATCHES = [
  { file: 'ui-layout.patch', target: 'node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js' },
  { file: 'ui-conversation.patch', target: 'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js' },
  { file: 'ui-sidebar.patch', target: 'node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js' }
]

function parseArgs(argv) {
  const opts = { checkout: process.env.DSH_CHECKOUT ?? null, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--checkout') opts.checkout = argv[++i]
    else if (argv[i] === '--dry-run') opts.dryRun = true
  }
  return opts
}

function autoDetectCheckout() {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
  const npxRoot = join(home, '.npm-cache', '_npx')
  if (!existsSync(npxRoot)) return null
  for (const entry of readdirSync(npxRoot)) {
    const candidate = join(npxRoot, entry)
    if (!existsSync(join(candidate, 'node_modules', '@deepseek-ai', 'dsh-client-ui-layout'))) continue
    return candidate
  }
  return null
}

const opts = parseArgs(process.argv.slice(2))
const checkout = opts.checkout ?? autoDetectCheckout()
if (checkout === null) {
  console.error('No DSH checkout found. Pass --checkout <path-to-checkout-root> (the directory that contains node_modules/@deepseek-ai).')
  process.exit(1)
}
console.log(`checkout: ${checkout}${opts.dryRun ? '  [dry-run]' : ''}`)

let failures = 0
for (const patch of PATCHES) {
  const target = join(checkout, patch.target)
  if (!existsSync(target)) {
    console.error(`! ${patch.target} not found — is this a DSH checkout?`)
    failures++
    continue
  }
  const args = ['apply', ...(opts.dryRun ? ['--check'] : []), join(patchesDir, patch.file)]
  const result = spawnSync('git', args, { cwd: checkout, encoding: 'utf8' })
  if (result.status === 0) {
    console.log(`✓ ${patch.file} ${opts.dryRun ? 'applies cleanly' : 'applied'}`)
  } else {
    console.error(`✗ ${patch.file} failed: ${(result.stderr || result.stdout || '').trim().split('\n').slice(0, 3).join(' | ')}`)
    failures++
  }
}
if (failures > 0) {
  console.error('\nOne or more patches did not apply. If the installed package version changed, regenerate the patches against the new bundles and update the targets.')
  process.exit(1)
}
console.log('\nDone. Hard-refresh the DSH web page (Ctrl+F5) to load the patched bundles.')
