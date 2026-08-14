// DSH Workbench — HOST half
// /wb/* static route (Monaco + assets + the client bundle) and /wb-api/* JSON file operations,
// both workspace-fenced through the ctx.fs service and the DSH sandbox policy.
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    if (fs === undefined) throw new Error('dsh-workbench: ctx.fs is unavailable — cannot serve file operations')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const directoryPicker = ctx.get('directoryPicker')
    const webServer = ctx.get('webServer')

    // ---- path helpers (plain string ops; no node:path in the sandbox) ----
    const norm = (p) => String(p).replace(/\\/g, '/')
    const trimSlash = (p) => norm(p).replace(/\/+$/, '')
    const base = (p) => { const n = trimSlash(p); const i = n.lastIndexOf('/'); return i === -1 ? n : n.slice(i + 1) }
    const join = (a, b) => trimSlash(a) + '/' + String(b).replace(/^\/+/, '')
    const extOf = (p) => { const n = base(p); const i = n.lastIndexOf('.'); return i <= 0 ? '' : n.slice(i + 1).toLowerCase() }

    // ---- workspace root & fencing ----
    const rootPath = () => {
      if (sandboxPolicy === undefined) throw new Error('dsh-workbench: ctx.sandboxPolicy is unavailable')
      const policy = sandboxPolicy.resolve({})
      if (policy === null || typeof policy.workspaceRoot !== 'string' || policy.workspaceRoot === '') {
        throw new Error('dsh-workbench: no workspace root resolved')
      }
      return policy.workspaceRoot
    }
    const policyOf = () => (sandboxPolicy === undefined ? undefined : sandboxPolicy.resolve({}))
    const resolveInside = async (path) => {
      const rootTarget = await fs.resolve(rootPath(), {})
      const target = await fs.resolve(String(path), {})
      if (!fs.contains(rootTarget, target)) throw new Error('path-outside-workspace')
      return target
    }
    const codeOf = (e) => (e !== null && typeof e === 'object' && typeof e.code === 'string') ? e.code : null
    const textOf = (e) => (e instanceof Error ? e.message : String(e))

    // ---- operation dispatch (shared by the HTTP API) ----
    const ops = {
      describe: async () => {
        const root = rootPath()
        return { ok: true, root, rootName: base(root) }
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
        // 1) the browse directory-picker capability, when the deployment mounts it
        if (directoryPicker !== undefined) {
          try {
            const capability = directoryPicker.capability()
            if (capability !== undefined && capability.kind === 'browse') {
              const created = await capability.createDirectory(parent, name)
              return { ok: true, path: created }
            }
          } catch (e) {
            if (e !== null && typeof e === 'object' && typeof e.code === 'string' && String(e.code).indexOf('directory-') === 0) {
              return { ok: false, error: String(e.code) === 'directory-exists' ? 'exists' : 'invalid-name' }
            }
            return { ok: false, error: textOf(e) }
          }
        }
        // 2) subprocess fallback (PowerShell mkdir) for native/absent pickers
        const subprocess = ctx.get('subprocess')
        if (subprocess === undefined) return { ok: false, error: 'unsupported' }
        let pwshPath = null
        for (const candidate of [
          'pwsh',
          'powershell.exe',
          'C:/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe',
          'C:/Program Files/PowerShell/7/pwsh.exe'
        ]) {
          try { pwshPath = await subprocess.resolveExecutable(candidate); break } catch (e) {}
        }
        if (pwshPath === null) return { ok: false, error: 'unsupported' }
        const target = join(parent, name)
        const q = target.replace(/'/g, "''")
        const script = "$p = '" + q + "'; if (Test-Path -LiteralPath $p) { exit 2 }; New-Item -ItemType Directory -Path $p | Out-Null; if (Test-Path -LiteralPath $p) { exit 0 } else { exit 3 }"
        try {
          const handle = subprocess.spawn({
            argv: [pwshPath, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
            cwd: parent,
            stdio: {
              stdin: 'ignore',
              stdout: { maxBytes: 65536, spill: { maxBytes: 65536 } },
              stderr: { maxBytes: 65536, spill: { maxBytes: 65536 } }
            },
            graceMs: 8000
          })
          const outcome = await handle.done
          if (outcome !== null && typeof outcome === 'object' && outcome.exitCode === 0) return { ok: true, path: target }
          if (outcome !== null && typeof outcome === 'object' && outcome.exitCode === 2) return { ok: false, error: 'exists' }
          let errText = ''
          try {
            const reader = handle.collected && handle.collected.stderr
            if (reader !== undefined) errText = String(reader.readFrom(0).text || '').slice(0, 500)
          } catch (e) {}
          return {
            ok: false,
            error: 'mkdir-failed',
            detail: {
              exit: outcome !== null && typeof outcome === 'object' ? outcome.exitCode : null,
              stderr: errText
            }
          }
        } catch (e) {
          return { ok: false, error: textOf(e) }
        }
      },

      assetText: async (args) => {
        const file = args === null ? '' : args.file
        const allow = { 'seti.css': true, 'seti-map.json': true }
        if (!Object.prototype.hasOwnProperty.call(allow, file)) return { ok: false, error: 'forbidden' }
        try {
          const abs = join(join(rootPath(), '.dsh-workbench/assets'), file)
          const target = await fs.resolve(abs, {})
          const text = await fs.readText(target)
          return { ok: true, text }
        } catch (e) {
          return { ok: false, error: textOf(e) }
        }
      }
    }

    if (webServer === undefined) return

    // ---- one prefix route: /wb static assets + /wb-api JSON ops ----
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
      if (rel === '' || rel.split('/').some((seg) => seg === '' || seg === '.' || seg === '..' || seg.indexOf(':') !== -1 || seg.indexOf('\0') !== -1)) {
        res.writeHead(403); res.end(); return
      }
      try {
        const assetsRoot = join(rootPath(), '.dsh-workbench/assets')
        const rootTarget = await fs.resolve(assetsRoot, {})
        const target = await fs.resolve(join(assetsRoot, rel), {})
        if (!fs.contains(rootTarget, target)) { res.writeHead(403); res.end(); return }
        const bytes = await fs.readBytes(target, undefined, 64 * 1024 * 1024)
        res.writeHead(200, {
          'content-type': MIME['.' + extOf(rel)] || 'application/octet-stream',
          'cache-control': 'no-cache'
        })
        res.end(bytes)
      } catch (e) {
        res.writeHead(404); res.end()
      }
    }

    const route = {
      kind: 'prefix',
      path: '/wb',
      handler: async (req, res) => {
        const raw = String(req.url === undefined || req.url === null ? '/' : req.url)
        const pathname = decodeURIComponent(raw.split('?')[0])
        // strip the '/wb' prefix plus any separator ('/wb/vs/…' and '/wb-api/…' both normalize)
        const rel = norm(pathname.slice('/wb'.length)).replace(/^[/-]+/, '')

        // JSON API: POST /wb-api/<op>
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
    }
    ctx.effect(() => webServer.register(route), 'dsh-workbench: /wb route')
  }
}
