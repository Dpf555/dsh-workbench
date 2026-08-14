// Generate the seti file-icon stylesheet and the extension→icon map from the
// vendored VS Code seti theme (scripts/seti-theme.json, MIT, extracted from
// microsoft/vscode extensions/theme-seti). Outputs assets/seti.css and
// assets/seti-map.json consumed by the workbench UI bundle.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const json = JSON.parse(readFileSync(join(here, 'seti-theme.json'), 'utf8'))
const defs = json.iconDefinitions

let css = '@font-face{font-family:"seti-icons";src:url("/wb/seti.woff") format("woff");font-weight:400;font-style:normal;font-display:block}\n'
css += '.seti{font-family:"seti-icons";speak:none;font-style:normal;font-weight:400;font-variant:normal;text-transform:none;line-height:1;display:inline-block;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;width:16px;height:16px;text-align:center}\n'
css += '.seti::before{display:inline-block}\n'

const cls = (id) => 'seti-' + id.replace(/^_/, '')
for (const [id, def] of Object.entries(defs)) {
  if (id.endsWith('_light')) continue
  const ch = def.fontCharacter.replace(/^\\/, '')
  css += `.${cls(id)}::before{content:"\\${ch}";color:${def.fontColor}}\n`
}
// The seti font ships one folder glyph (\E032, classic seti color #dcb67a);
// VS Code's seti theme uses the same glyph for open and closed folders.
css += '.seti-folder::before{content:"\\E032";color:#dcb67a}\n'

const map = { fileExtensions: {}, fileNames: {}, folder: 'seti-folder', folderOpen: 'seti-folder' }
for (const [ext, id] of Object.entries(json.fileExtensions)) map.fileExtensions[ext] = cls(id)
for (const [name, id] of Object.entries(json.fileNames)) map.fileNames[name] = cls(id)

// The modern theme maps most common languages through `languageIds` (VS Code
// resolves icons by language service); the Explorer only knows file names, so
// merge a curated extension → languageId table for the popular types.
const EXT_TO_LANGUAGE_ID = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', es6: 'javascript',
  jsx: 'javascriptreact',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescriptreact',
  json: 'json', jsonc: 'jsonc', jsonl: 'jsonl',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less', styl: 'stylus',
  html: 'html', htm: 'html', vue: 'vue', erb: 'erb', haml: 'haml', pug: 'jade', jade: 'jade',
  hbs: 'handlebars', mustache: 'mustache', njk: 'nunjucks',
  md: 'markdown', markdown: 'markdown',
  py: 'python', yaml: 'yaml', yml: 'yaml',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', cu: 'cuda-cpp',
  m: 'objective-c', mm: 'objective-cpp',
  cs: 'csharp', java: 'java', go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript',
  bat: 'bat', cmd: 'bat', ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
  sql: 'sql', ini: 'properties', env: 'dotenv',
  dockerfile: 'dockerfile', makefile: 'makefile',
  clj: 'clojure', cljs: 'clojure', ex: 'elixir', exs: 'elixir', elm: 'elm',
  hs: 'haskell', kt: 'kotlin', kts: 'kotlin', groovy: 'groovy', scala: 'scala',
  pl: 'perl', pm: 'perl', lua: 'lua', r: 'r', dart: 'dart', swift: 'swift',
  tex: 'tex', latex: 'latex', jl: 'julia', fs: 'fsharp', fsx: 'fsharp',
  tf: 'terraform', tfvars: 'terraform', gradle: 'gradle', bicep: 'bicep',
  vala: 'vala', ml: 'ocaml', mli: 'ocaml', res: 'rescript', haxe: 'haxe',
  godot: 'godot', gd: 'godot', zig: 'zig'
}
for (const [ext, langId] of Object.entries(EXT_TO_LANGUAGE_ID)) {
  if (map.fileExtensions[ext] !== undefined) continue
  const iconId = json.languageIds[langId]
  if (iconId !== undefined) map.fileExtensions[ext] = cls(iconId)
}

writeFileSync(join(repoRoot, 'assets', 'seti.css'), css)
writeFileSync(join(repoRoot, 'assets', 'seti-map.json'), JSON.stringify(map))
console.log(`seti.css: ${css.length} bytes | seti-map.json: ${JSON.stringify(map).length} bytes (${Object.keys(map.fileExtensions).length} extensions, ${Object.keys(map.fileNames).length} filenames)`)
