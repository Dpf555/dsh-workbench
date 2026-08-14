// @dsh-local/dsh-workbench — durable HOST half (real ESM module)
// Registers the /wb prefix route: static assets (Monaco, icon fonts, the UI
// bundle) from this package's own assets/ directory, plus POST /wb/api/<op>
// JSON file operations. File operations run through ctx.fs and are fenced to
// the workspace root of the DSH sandbox policy; writes pass the resolved
// sandbox policy so the sandbox backend enforces its own boundary.
import { basename, dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile } from 'node:fs/promises'

export const name = 'dsh-workbench'
export const inject = ['webServer', 'fs', 'sandboxPolicy']

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png'
}

export function apply(ctx) {
  const fs = ctx.fs
  const sandboxPolicy = ctx.sandboxPolicy
  const webServer = ctx.webServer
  const assetsRoot = join(dirname(fileURLToPath(import.meta.url)), 'assets')

  const rootPath = () => {
    const policy = sandboxPolicy.resolve({})
    if (policy === null || typeof policy.workspaceRoot !== 'string' || policy.workspaceRoot === '') {
      throw new Error('dsh-workbench: no workspace root resolved')
    }
    return policy.workspaceRoot
  }
  const policyOf = () => sandboxPolicy.resolve({})
  const resolveInside = async (path) => {
    const rootTarget = await fs.resolve(rootPath(), {})
    const target = await fs.resolve(String(path), {})
    if (!fs.contains(rootTarget, target)) throw new Error('path-outside-workspace')
    return target
  }
  const codeOf = (e) => (e !== null && typeof e === 'object' && typeof e.code === 'string') ? e.code : null
  const textOf = (e) => (e instanceof Error ? e.message : String(e))

  const ops = {
    describe: async () => {
      const root = rootPath()
      return { ok: true, root, rootName: basename(root) }
    },

    listDir: async (args) => {
      const path = args === null || args.path === undefined ? rootPath() : args.path
      try {
        const target = await resolveInside(path)
        const info = await fs.stat(target)
        if (info === undefined) return { ok: false, error: 'not-found' }
        if (info.type !== 'directory') return { ok: false, error: 'not-directory' }
        const listed = await fs.listDir(target)
        const entries = listed.map((entry) => ({
          name: entry.name,
          type: entry.type === 'directory' ? 'directory' : 'file',
          ...(typeof entry.size === 'number' ? { size: entry.size } : {})
        }))
        entries.sort((a, b) => ((a.type === 'directory' ? 0 : 1) - (b.type === 'directory' ? 0 : 1)) || a.name.localeCompare(b.name, undefined, { numeric: true }))
        return { ok: true, entries }
      } catch (e) {
        const code = codeOf(e)
        if (code === 'FS_NOT_FOUND' || code === 'FS_NOT_DIRECTORY') return { ok: false, error: 'not-directory' }
        if (e.message === 'path-outside-workspace') return { ok: false, error: 'outside-workspace' }
        return { ok: false, error: textOf(e) }
      }
    },

    readFile: async (args) => {
      const path = args === null ? '' : args.path
      try {
        const target = await resolveInside(path)
        const info = await fs.stat(target)
        if (info === undefined) return { ok: false, error: 'not-found' }
        if (info.type !== 'file') return { ok: false, error: 'not-file' }
        if (typeof info.size === 'number' && info.size > 5 * 1024 * 1024) return { ok: false, error: 'too-large' }
        try {
          const content = await fs.readText(target)
          return { ok: true, content, version: String(info.version) }
        } catch (e) {
          const code = codeOf(e)
          if (code === 'FS_NOT_TEXT') return { ok: false, error: 'not-text' }
          if (code === 'FS_TOO_LARGE') return { ok: false, error: 'too-large' }
          throw e
        }
      } catch (e) {
        if (e.message === 'path-outside-workspace') return { ok: false, error: 'outside-workspace' }
        return { ok: false, error: textOf(e) }
      }
    },

    writeFile: async (args) => {
      const path = args === null ? '' : args.path
      const content = args === null ? '' : args.content
      if (typeof content !== 'string') return { ok: false, error: 'bad-content' }
      try {
        const target = await resolveInside(path)
        const expected = (args !== null && args.expected !== undefined && args.expected !== null)
          ? { kind: 'replaceIfVersion', version: String(args.expected) }
          : undefined
        const outcome = await fs.writeText(target, content, expected, undefined, policyOf())
        return { ok: true, operation: outcome.operation, version: String(outcome.version) }
      } catch (e) {
        const code = codeOf(e)
        if (code === 'FS_STALE_VERSION') return { ok: false, error: 'stale' }
        if (code === 'FS_NOT_OBSERVED') return { ok: false, error: 'not-observed' }
        if (code === 'FS_SANDBOX_DENIED' || code === 'FS_PERMISSION_DENIED') return { ok: false, error: 'denied' }
        if (e.message === 'path-outside-workspace') return { ok: false, error: 'outside-workspace' }
        return { ok: false, error: textOf(e) }
      }
    },

    createFile: async (args) => {
      const path = args === null ? '' : args.path
      try {
        const target = await resolveInside(path)
        const outcome = await fs.writeText(target, '', { kind: 'createIfAbsent' }, undefined, policyOf())
        return { ok: true, operation: outcome.operation, version: String(outcome.version) }
      } catch (e) {
        const code = codeOf(e)
        if (code === 'FS_NOT_OBSERVED') return { ok: false, error: 'exists' }
        if (code === 'FS_SANDBOX_DENIED' || code === 'FS_PERMISSION_DENIED') return { ok: false, error: 'denied' }
        if (e.message === 'path-outside-workspace') return { ok: false, error: 'outside-workspace' }
        return { ok: false, error: textOf(e) }
      }
    },

    createDir: async (args) => {
      const parent = args === null ? '' : args.parent
      const name = args === null ? '' : args.name
      if (typeof name !== 'string' || name.trim() === '' || name === '.' || name === '..' || /[/\\]/.test(name)) {
        return { ok: false, error: 'bad-name' }
      }
      try { await resolveInside(parent) } catch (e) { return { ok: false, error: 'outside-workspace' } }
      const target = join(parent, name)
      try {
        await mkdir(target)
        return { ok: true, path: target }
      } catch (e) {
        if (codeOf(e) === 'EEXIST') return { ok: false, error: 'exists' }
        return { ok: false, error: textOf(e) }
      }
    },

    assetText: async (args) => {
      const file = args === null ? '' : args.file
      const allow = { 'seti.css': true, 'seti-map.json': true }
      if (!Object.prototype.hasOwnProperty.call(allow, file)) return { ok: false, error: 'forbidden' }
      try {
        return { ok: true, text: await readFile(join(assetsRoot, file), 'utf8') }
      } catch (e) {
        return { ok: false, error: textOf(e) }
      }
    }
  }

  const readBodyText = (req) => new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 10 * 1024 * 1024) { reject(new Error('body-too-large')); try { req.destroy() } catch (e) {} return }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(chunks.join('')))
    req.on('error', reject)
  })

  const json = (res, status, value) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
    res.end(JSON.stringify(value))
  }

  const serveAsset = async (req, res, rel) => {
    if (rel === '' || rel.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
      res.writeHead(403); res.end(); return
    }
    try {
      const target = normalize(join(assetsRoot, ...rel.split('/')))
      if (target !== assetsRoot && !target.startsWith(assetsRoot + sep)) { res.writeHead(403); res.end(); return }
      const bytes = await readFile(target)
      res.writeHead(200, {
        'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache'
      })
      res.end(bytes)
    } catch (e) {
      res.writeHead(404); res.end()
    }
  }

  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/wb',
    handler: async (req, res) => {
      const raw = String(req.url === undefined || req.url === null ? '/' : req.url)
      let pathname
      try { pathname = decodeURIComponent(raw.split('?')[0]) } catch (e) { res.writeHead(400); res.end(); return }
      const rel = pathname.slice('/wb'.length).replace(/^[/-]+/, '')

      // JSON API: POST /wb/api/<op>
      if (rel.indexOf('api/') === 0) {
        if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'method-not-allowed' }); return }
        const opName = rel.slice('api/'.length)
        const op = ops[opName]
        if (op === undefined) { json(res, 404, { ok: false, error: 'unknown-op' }); return }
        try {
          const body = await readBodyText(req)
          const payload = body === '' ? null : JSON.parse(body)
          const args = payload === null ? null : (payload.args === undefined ? payload : payload.args)
          const result = await op(args)
          json(res, 200, result)
        } catch (e) {
          json(res, 400, { ok: false, error: textOf(e) })
        }
        return
      }

      // static assets
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
      await serveAsset(req, res, rel)
    }
  }), 'dsh-workbench: /wb route')
}
