// DSH Workbench — CLIENT bundle v2 (three-column layout)
// Right column: Explorer file tree (slot `explorer`, declared by the patched layout shell).
// Middle column: `workbench.editor` view in the conversation view ring — clicking a file
// switches the middle to the Monaco editor; the chat tab switches back.
// Talks to the host through POST /wb/api/<op>.
(function () {
  'use strict'
  let mounted = false
  const mount = (params) => {
    if (mounted) return
    mounted = true
    const slots = params.slots
    const locale = params.locale
    const NS = params.NS
    const React = params.React
    const layout = params.layout
    const styles = {
      insert: (css) => {
        const tag = document.createElement('style')
        tag.dataset.dshWorkbench = '1'
        tag.textContent = css
        document.head.appendChild(tag)
        return () => {}
      }
    }
    const host = {
      call: (method, args) => {
        const op = String(method).indexOf('wb.') === 0 ? String(method).slice(3) : String(method)
        return fetch('/wb/api/' + op, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(args === undefined || args === null ? {} : { args })
        }).then((r) => r.json(), () => ({ ok: false, error: 'rpc' }))
      }
    }

    const zh = {
      'explorer': '资源管理器',
      'action.newFile': '新建文件',
      'action.newFolder': '新建文件夹',
      'action.refresh': '刷新',
      'action.collapseAll': '全部折叠',
      'action.collapsePanel': '收起面板',
      'view.editor': '代码',
      'view.back': '返回会话',
      'welcome.title': '未打开文件',
      'welcome.hint': '在右侧资源管理器中点击文件，即可在此处编辑。Ctrl+S 保存。',
      'banner.saved': '已保存',
      'banner.stale': '此文件已被其他程序修改（可能是 AI 助手编辑了它）',
      'banner.reload': '重新加载',
      'banner.overwrite': '强制覆盖',
      'banner.error': '保存失败',
      'create.file.placeholder': '文件名',
      'create.folder.placeholder': '文件夹名',
      'status.files': '个文件',
      'error.too-large': '文件超过 5 MB 限制',
      'error.not-text': '无法打开二进制文件',
      'error.not-found': '文件不存在',
      'error.loading': '无法打开文件',
      'loading': '正在加载编辑器…',
      'tab.close': '关闭标签页',
      'tab.closeDirty': '文件未保存，再次点击关闭'
    }
    const en = {
      'explorer': 'Explorer',
      'action.newFile': 'New File',
      'action.newFolder': 'New Folder',
      'action.refresh': 'Refresh',
      'action.collapseAll': 'Collapse All',
      'action.collapsePanel': 'Collapse panel',
      'view.editor': 'Code',
      'view.back': 'Back to chat',
      'welcome.title': 'No file open',
      'welcome.hint': 'Click a file in the Explorer on the right to edit it here. Ctrl+S to save.',
      'banner.saved': 'Saved',
      'banner.stale': 'This file changed on disk (the AI assistant may have edited it)',
      'banner.reload': 'Reload',
      'banner.overwrite': 'Overwrite',
      'banner.error': 'Save failed',
      'create.file.placeholder': 'File name',
      'create.folder.placeholder': 'Folder name',
      'status.files': 'files',
      'error.too-large': 'File exceeds the 5 MB limit',
      'error.not-text': 'Cannot open binary files',
      'error.not-found': 'File not found',
      'error.loading': 'Cannot open file',
      'loading': 'Loading editor…',
      'tab.close': 'Close tab',
      'tab.closeDirty': 'Unsaved changes — click again to close'
    }
    const tFallback = (key) => (zh[key] !== undefined ? zh[key] : key)
    let tBind = tFallback
    if (locale !== undefined) {
      try { locale.register(NS, { zh, en }); tBind = locale.bind(NS) } catch (e) {}
    }

    // ---- stylesheet (VS Code dark palette, docked panels) ----
    styles.insert('@font-face{font-family:"codicon-wb";src:url("/wb/vs/base/browser/ui/codicons/codicon/codicon.ttf") format("truetype");font-weight:400;font-style:normal;font-display:block}' +
      '.wb-codicon{font-family:"codicon-wb";speak:none;font-style:normal;font-weight:400;font-variant:normal;text-transform:none;line-height:1;display:inline-block;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}' +
      '.wb-codicon-close::before{content:"\\ea76"}.wb-codicon-refresh::before{content:"\\eb37"}.wb-codicon-trash::before{content:"\\ea81"}' +
      '.wb-codicon-folder::before{content:"\\ea83"}.wb-codicon-files::before{content:"\\eaf0"}.wb-codicon-file-code::before{content:"\\eae9"}' +
      '.wb-codicon-code::before{content:"\\eac4"}.wb-codicon-save::before{content:"\\eb4b"}.wb-codicon-new-file::before{content:"\\ea7f"}' +
      '.wb-codicon-new-folder::before{content:"\\ea80"}.wb-codicon-chevron-right::before{content:"\\eab6"}.wb-codicon-chevron-down::before{content:"\\eab4"}' +
      '.wb-codicon-collapse-all::before{content:"\\eac5"}.wb-codicon-chevron-left::before{content:"\\eab5"}' +
      '.wb-codicon-comment-discussion::before{content:"\\eacf"}' +
      '.wbx-explorer{height:100%;display:flex;flex-direction:column;min-width:0;color:#cccccc;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;font-size:13px}' +
      '.wbx-header{flex:none;display:flex;align-items:center;height:35px;padding:0 8px;gap:4px;border-bottom:1px solid rgba(128,128,128,.25)}' +
      '.wbx-title{flex:1;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#bbbbbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.wb-icon-btn{cursor:pointer;border:none;background:transparent;color:#cccccc;width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}' +
      '.wb-icon-btn:hover{background:#3a3d41}' +
      '.wbx-tree{flex:1;overflow:auto;padding:2px 0 8px;min-height:0}' +
      '.wbx-tree::-webkit-scrollbar{width:10px}.wbx-tree::-webkit-scrollbar-thumb{background:rgba(121,121,121,.4)}' +
      '.wbx-tree::-webkit-scrollbar-thumb:hover{background:rgba(121,121,121,.7)}' +
      '.wb-row{display:flex;align-items:center;height:22px;line-height:22px;cursor:pointer;white-space:nowrap;color:#cccccc}' +
      '.wb-row:hover{background:#2a2d2e}' +
      '.wb-row-selected{background:#04395e}.wb-row-selected:hover{background:#094771}' +
      '.wb-row-chevron{flex:none;width:16px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#cccccc}' +
      '.wb-row-icon{flex:none;width:18px;height:22px;display:flex;align-items:center;justify-content:center;font-size:15px}' +
      '.wb-row-name{flex:1;overflow:hidden;text-overflow:ellipsis;padding-right:6px}' +
      '.wb-row-loading{color:#858585;font-style:italic}' +
      '.wbx-create-row{display:flex;align-items:center;height:24px;margin:2px 0;padding-left:20px;gap:6px}' +
      '.wbx-create-input{flex:1;background:#3c3c3c;border:1px solid #007fd4;color:#cccccc;outline:none;height:20px;line-height:20px;padding:0 6px;font-size:13px;font-family:inherit;border-radius:2px}' +
      '.wbx-editor{height:100%;display:flex;flex-direction:column;min-width:0;background:#1e1e1e;color:#cccccc}' +
      '.wbx-tabs{flex:none;display:flex;align-items:stretch;height:35px;background:#252526;overflow-x:auto;overflow-y:hidden;border-bottom:1px solid rgba(128,128,128,.2)}' +
      '.wbx-tabs::-webkit-scrollbar{height:3px}.wbx-tabs::-webkit-scrollbar-thumb{background:rgba(121,121,121,.4)}' +
      '.wbx-tab{display:flex;align-items:center;gap:6px;padding:0 10px;background:#2d2d2d;color:#969696;cursor:pointer;border-right:1px solid #252526;white-space:nowrap;min-width:110px;max-width:200px;font-size:13px}' +
      '.wbx-tab:hover{background:#383838}' +
      '.wbx-tab-active{background:#1e1e1e;color:#ffffff;box-shadow:inset 0 1px 0 #007acc}' +
      '.wbx-tab-icon{flex:none;font-size:14px}' +
      '.wbx-tab-label{flex:1;overflow:hidden;text-overflow:ellipsis}' +
      '.wbx-tab-dirty .wbx-tab-label::after{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#cccccc;margin-left:6px;vertical-align:1px}' +
      '.wbx-tab-x{flex:none;width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:inherit}' +
      '.wbx-tab-x:hover{background:rgba(255,255,255,.15);color:#ffffff}' +
      '.wbx-banner{flex:none;display:flex;align-items:center;gap:8px;padding:5px 12px;font-size:12px}' +
      '.wbx-banner-ok{background:#1e3a1e;color:#7cc97c}' +
      '.wbx-banner-warn{background:#4a3a1a;color:#e2c08d}' +
      '.wbx-banner-error{background:#4a1e1e;color:#e28d8d}' +
      '.wbx-banner-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.wbx-banner-btn{cursor:pointer;border:1px solid currentColor;background:transparent;color:inherit;font-size:12px;border-radius:3px;padding:2px 10px;font-family:inherit;margin-left:6px}' +
      '.wbx-banner-btn:hover{opacity:.85}' +
      '.wbx-holder{flex:1;min-height:0;position:relative}' +
      '.wbx-welcome{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#969696;font-family:"Segoe UI",system-ui,sans-serif}' +
      '.wbx-welcome-icon{font-size:64px;color:#3f3f46}' +
      '.wbx-welcome-title{font-size:20px;color:#cccccc}' +
      '.wbx-welcome-hint{font-size:13px;max-width:420px;text-align:center;line-height:1.6}' +
      '.wbx-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#858585;font-size:13px}' +
      '.wbx-statusbar{flex:none;display:flex;align-items:center;justify-content:space-between;height:22px;background:#007acc;color:#ffffff;font-size:12px;padding:0 12px}' +
      '.wbx-statusbar span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.wbx-back{flex:none;display:flex;align-items:center;gap:6px;cursor:pointer;background:transparent;border:none;color:#cccccc;padding:6px 12px;font-size:13px;font-family:inherit}' +
      '.wbx-back:hover{background:#2a2d2e}' +
      'body[data-wb-editor-active] [data-composer-seat]{display:none}')

    // ---- seti icon assets ----
    const setiMap = { fileExtensions: {}, fileNames: {}, folder: 'seti-folder', folderOpen: 'seti-folder' }
    let setiPromise = null
    const loadSeti = () => {
      if (setiPromise !== null) return setiPromise
      setiPromise = (async () => {
        try {
          const css = await host.call('wb.assetText', { file: 'seti.css' })
          if (css !== null && typeof css === 'object' && css.ok === true && typeof css.text === 'string') styles.insert(css.text)
          const map = await host.call('wb.assetText', { file: 'seti-map.json' })
          if (map !== null && typeof map === 'object' && map.ok === true && typeof map.text === 'string') {
            const parsed = JSON.parse(map.text)
            if (parsed && typeof parsed === 'object') {
              if (parsed.fileExtensions) setiMap.fileExtensions = parsed.fileExtensions
              if (parsed.fileNames) setiMap.fileNames = parsed.fileNames
              if (typeof parsed.folder === 'string') setiMap.folder = parsed.folder
            }
          }
        } catch (e) { console.error('[dsh-workbench] seti assets failed:', e) }
      })()
      return setiPromise
    }

    const extOf = (name) => { const i = name.lastIndexOf('.'); return i <= 0 ? '' : name.slice(i + 1).toLowerCase() }
    const joinPath = (a, b) => a.replace(/\/+$/, '') + '/' + String(b).replace(/^\/+/, '')
    const iconClassFor = (entry) => {
      if (entry.type === 'directory') return 'seti ' + setiMap.folder
      if (setiMap.fileNames[entry.name] !== undefined) return 'seti ' + setiMap.fileNames[entry.name]
      const ext = extOf(entry.name)
      if (ext !== '' && setiMap.fileExtensions[ext] !== undefined) return 'seti ' + setiMap.fileExtensions[ext]
      return 'seti seti-default'
    }
    const LANGUAGE = {
      js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
      ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
      json: 'json', jsonc: 'json', css: 'css', scss: 'scss', less: 'less',
      html: 'html', htm: 'html', md: 'markdown', markdown: 'markdown',
      py: 'python', yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql',
      java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
      cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
      ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
      sh: 'shell', bash: 'shell', zsh: 'shell', bat: 'bat', cmd: 'bat',
      ini: 'ini', cfg: 'ini', dockerfile: 'dockerfile', vue: 'html'
    }
    const languageFor = (name) => {
      if (name.toLowerCase() === 'dockerfile') return 'dockerfile'
      return LANGUAGE[extOf(name)] || 'plaintext'
    }

    // ---- page-level shared UI state ----
    const ui = {
      sessionId: null,
      tabs: [],
      activePath: null,
      dirty: new Set(),
      conflict: new Set(),
      closing: new Set(),
      models: new Map(),
      contents: new Map(),
      savedVersions: new Map(),
      savedAltIds: new Map(),
      monaco: null,
      monacoState: 'idle',
      editor: null,
      tree: null,
      create: null,
      banner: null,
      listeners: new Set()
    }
    const emit = () => { ui.listeners.forEach((l) => l()) }
    const useUI = () => {
      const [, set] = React.useState(0)
      React.useEffect(() => { const l = () => set((v) => v + 1); ui.listeners.add(l); return () => { ui.listeners.delete(l) } }, [])
      return ui
    }
    const bridgeFor = (sessionId) => {
      if (typeof window === 'undefined') return null
      const b = window.__DSH_CONV_BRIDGE__
      return (b && sessionId !== null && sessionId !== undefined && b[sessionId] !== undefined) ? b[sessionId] : null
    }
    const switchToEditor = () => {
      const b = bridgeFor(ui.sessionId)
      if (b !== null && typeof b.setView === 'function') b.setView('workbench.editor')
    }

    // ---- monaco boot (page-level, started on first need) ----
    let bootStarted = false
    const bootMonaco = () => {
      if (bootStarted || ui.monacoState !== 'idle') return
      bootStarted = true
      ui.monacoState = 'loading'
      emit()
      const boot = () => {
        const req = typeof window !== 'undefined' ? window.require : undefined
        if (!req || typeof req.config !== 'function') { ui.monacoState = 'error'; emit(); return }
        try {
          req.config({ paths: { vs: '/wb/vs' } })
          req(['vs/editor/editor.main'], () => {
            if (window.monaco && window.monaco.editor) {
              ui.monaco = window.monaco
              ui.monacoState = 'ready'
            } else ui.monacoState = 'error'
            emit()
          }, () => { ui.monacoState = 'error'; emit() })
        } catch (e) { ui.monacoState = 'error'; emit() }
      }
      if (typeof window !== 'undefined' && window.require) boot()
      else if (typeof document !== 'undefined') {
        const s = document.createElement('script')
        s.src = '/wb/vs/loader.js'
        s.onload = boot
        s.onerror = () => { ui.monacoState = 'error'; emit() }
        document.head.appendChild(s)
      } else { ui.monacoState = 'error'; emit() }
    }

    // ---- file operations ----
    const openFile = async (path, name) => {
      if (!ui.tabs.some((tb) => tb.path === path)) {
        ui.tabs = [...ui.tabs, { path, name, lang: languageFor(name), status: 'loading', error: null }]
      }
      ui.activePath = path
      emit()
      switchToEditor()
      if (ui.contents.has(path) || ui.models.has(path)) return
      try {
        const res = await host.call('wb.readFile', { path })
        if (res !== null && typeof res === 'object' && res.ok === true) {
          ui.contents.set(path, res.content)
          ui.savedVersions.set(path, res.version)
          ui.tabs = ui.tabs.map((tb) => tb.path === path ? { ...tb, status: 'ready' } : tb)
          emit()
        } else {
          ui.tabs = ui.tabs.map((tb) => tb.path === path ? { ...tb, status: 'error', error: res !== null && typeof res === 'object' ? String(res.error) : 'rpc' } : tb)
          emit()
        }
      } catch (e) {
        ui.tabs = ui.tabs.map((tb) => tb.path === path ? { ...tb, status: 'error', error: 'rpc' } : tb)
        emit()
      }
    }

    const savePath = async (path, expected) => {
      const model = ui.models.get(path)
      const tab = ui.tabs.find((tb) => tb.path === path)
      if (model === undefined || tab === undefined || tab.status !== 'ready') return
      try {
        const args = { path, content: model.getValue() }
        if (expected) args.expected = ui.savedVersions.get(path)
        const res = await host.call('wb.writeFile', args)
        if (res !== null && typeof res === 'object' && res.ok === true) {
          ui.savedVersions.set(path, res.version)
          ui.savedAltIds.set(path, model.getAlternativeVersionId())
          ui.dirty.delete(path)
          ui.conflict.delete(path)
          ui.banner = { kind: 'ok', text: tBind('banner.saved') + ' — ' + tab.name }
          emit()
        } else if (res !== null && typeof res === 'object' && res.error === 'stale') {
          ui.conflict.add(path)
          ui.banner = { kind: 'warn', text: tBind('banner.stale') }
          emit()
        } else {
          ui.banner = { kind: 'error', text: tBind('banner.error') + ': ' + (res !== null && typeof res === 'object' ? String(res.error) : 'rpc') }
          emit()
        }
      } catch (e) {
        ui.banner = { kind: 'error', text: tBind('banner.error') }
        emit()
      }
    }

    const reloadPath = async (path) => {
      try {
        const res = await host.call('wb.readFile', { path })
        if (res !== null && typeof res === 'object' && res.ok === true) {
          const model = ui.models.get(path)
          if (model !== undefined) model.setValue(res.content)
          ui.contents.set(path, res.content)
          ui.savedVersions.set(path, res.version)
          if (model !== undefined) ui.savedAltIds.set(path, model.getAlternativeVersionId())
          ui.dirty.delete(path)
          ui.conflict.delete(path)
          ui.banner = null
          emit()
        }
      } catch (e) {}
    }

    const closePath = (path) => {
      const tab = ui.tabs.find((tb) => tb.path === path)
      if (tab === undefined) return
      if (ui.dirty.has(path) && !ui.closing.has(path)) {
        ui.closing.add(path)
        emit()
        return
      }
      const model = ui.models.get(path)
      if (model !== undefined) { try { model.dispose() } catch (e) {} ui.models.delete(path) }
      ui.contents.delete(path)
      ui.savedVersions.delete(path)
      ui.savedAltIds.delete(path)
      ui.dirty.delete(path)
      ui.conflict.delete(path)
      ui.closing.delete(path)
      const idx = ui.tabs.findIndex((tb) => tb.path === path)
      ui.tabs = ui.tabs.filter((tb) => tb.path !== path)
      if (ui.activePath === path) {
        const nxt = ui.tabs[Math.max(0, idx - 1)]
        ui.activePath = nxt !== undefined ? nxt.path : null
      }
      emit()
    }

    const markDirtyForModel = (model) => {
      let path = null
      for (const [p, m] of ui.models.entries()) if (m === model) { path = p; break }
      if (path === null) return
      const savedAlt = ui.savedAltIds.get(path)
      const isDirty = model.getAlternativeVersionId() !== savedAlt
      if (isDirty === ui.dirty.has(path)) return
      if (isDirty) ui.dirty.add(path); else ui.dirty.delete(path)
      emit()
    }

    const refreshTree = async () => {
      const tr = ui.tree
      if (tr === null) return
      const paths = [tr.root, ...Array.from(tr.expanded)]
      for (const p of paths) {
        try {
          const res = await host.call('wb.listDir', { path: p })
          if (res !== null && typeof res === 'object' && res.ok === true) {
            ui.tree = { ...ui.tree, dirs: { ...ui.tree.dirs, [p]: res.entries } }
            emit()
          }
        } catch (e) {}
      }
    }

    // ---- ExplorerRoot (right column) ----
    function ExplorerRoot(props) {
      const t = typeof props.t === 'function' ? props.t : tBind
      const u = useUI()
      if (typeof props.useSessions === 'function') {
        const current = props.useSessions((s) => s.current)
        if (u.sessionId !== current) u.sessionId = current
      }
      const tr = u.tree
      const [create, setCreate] = React.useState(null)
      React.useEffect(() => { u.create = create }, [create])
      React.useEffect(() => { loadSeti() }, [])

      // bootstrap tree at workspace root
      React.useEffect(() => {
        if (u.tree !== null) return
        let disposed = false
        host.call('wb.describe', null).then((d) => {
          if (disposed || d === null || typeof d !== 'object' || d.ok !== true) return
          host.call('wb.listDir', { path: d.root }).then((res) => {
            if (disposed) return
            const entries = (res !== null && typeof res === 'object' && res.ok === true) ? res.entries : []
            ui.tree = { root: d.root, rootName: d.rootName, dirs: { [d.root]: entries }, expanded: new Set([d.root]) }
            emit()
          }, () => {})
        }, () => {})
        return () => { disposed = true }
      }, [])

      const toggleDir = (path) => {
        const trr = ui.tree
        if (trr === null) return
        const expanded = new Set(trr.expanded)
        if (expanded.has(path)) {
          expanded.delete(path)
          ui.tree = { ...trr, expanded }
          emit()
          return
        }
        expanded.add(path)
        if (trr.dirs[path] !== undefined) {
          ui.tree = { ...trr, expanded }
          emit()
          return
        }
        ui.tree = { ...trr, expanded, dirs: { ...trr.dirs, [path]: null } }
        emit()
        host.call('wb.listDir', { path }).then((res) => {
          const entries = (res !== null && typeof res === 'object' && res.ok === true) ? res.entries : []
          ui.tree = { ...ui.tree, dirs: { ...ui.tree.dirs, [path]: entries } }
          emit()
        }, () => {})
      }

      const collapseAll = () => {
        if (ui.tree === null) return
        ui.tree = { ...ui.tree, expanded: new Set() }
        emit()
      }

      const submitCreate = async () => {
        const c = ui.create
        if (c === null || c.value.trim() === '') { setCreate(null); ui.create = null; return }
        const value = c.value.trim()
        setCreate(null)
        ui.create = null
        if (c.kind === 'file') {
          const target = joinPath(c.parent, value)
          try {
            const res = await host.call('wb.createFile', { path: target })
            if (res !== null && typeof res === 'object' && res.ok === true) {
              await refreshTree()
              openFile(target, value)
            } else {
              ui.banner = { kind: 'error', text: tBind('banner.error') + ': ' + (res !== null && typeof res === 'object' ? String(res.error) : 'rpc') }
              emit()
            }
          } catch (e) {}
        } else {
          try {
            const res = await host.call('wb.createDir', { parent: c.parent, name: value })
            if (res !== null && typeof res === 'object' && res.ok === true) await refreshTree()
            else {
              ui.banner = { kind: 'error', text: tBind('banner.error') + ': ' + (res !== null && typeof res === 'object' ? String(res.error) : 'rpc') }
              emit()
            }
          } catch (e) {}
        }
      }

      const renderRows = (entries, depth, parentPath) => entries.map((entry) => {
        const path = joinPath(parentPath, entry.name)
        const isDir = entry.type === 'directory'
        const isOpen = isDir && tr !== null && tr.expanded.has(path)
        const children = isDir && tr !== null ? tr.dirs[path] : undefined
        const selected = u.activePath === path
        return [
          React.createElement('div', {
            key: path,
            className: 'wb-row' + (selected ? ' wb-row-selected' : ''),
            style: { paddingLeft: 6 + depth * 12 },
            title: path,
            onClick: () => { if (isDir) toggleDir(path); else openFile(path, entry.name) },
            children: [
              React.createElement('span', {
                className: 'wb-row-chevron wb-codicon ' + (isDir ? (isOpen ? 'wb-codicon-chevron-down' : 'wb-codicon-chevron-right') : ''),
                style: { visibility: isDir ? 'visible' : 'hidden' }
              }),
              React.createElement('span', { className: 'wb-row-icon ' + iconClassFor(entry) }),
              React.createElement('span', { className: 'wb-row-name', children: entry.name })
            ]
          }),
          isDir && isOpen ? (children === null
            ? React.createElement('div', { key: path + '::loading', className: 'wb-row wb-row-loading', style: { paddingLeft: 6 + (depth + 1) * 12 }, children: '…' })
            : renderRows(children, depth + 1, path))
            : null
        ]
      })

      const rootChildren = tr !== null ? (tr.dirs[tr.root] || []) : []
      const newFile = () => setCreate({ kind: 'file', parent: tr !== null ? tr.root : '', value: '' })
      const newFolder = () => setCreate({ kind: 'folder', parent: tr !== null ? tr.root : '', value: '' })

      return React.createElement('div', {
        className: 'wbx-explorer',
        children: [
          React.createElement('div', { className: 'wbx-header', children: [
            React.createElement('span', { className: 'wbx-title', children: t('explorer') }),
            React.createElement('button', { type: 'button', className: 'wb-icon-btn', title: t('action.newFile'), onClick: newFile, children: React.createElement('span', { className: 'wb-codicon wb-codicon-new-file' }) }),
            React.createElement('button', { type: 'button', className: 'wb-icon-btn', title: t('action.newFolder'), onClick: newFolder, children: React.createElement('span', { className: 'wb-codicon wb-codicon-new-folder' }) }),
            React.createElement('button', { type: 'button', className: 'wb-icon-btn', title: t('action.refresh'), onClick: () => { refreshTree() }, children: React.createElement('span', { className: 'wb-codicon wb-codicon-refresh' }) }),
            React.createElement('button', { type: 'button', className: 'wb-icon-btn', title: t('action.collapseAll'), onClick: collapseAll, children: React.createElement('span', { className: 'wb-codicon wb-codicon-collapse-all' }) }),
            layout !== undefined && typeof layout.toggleExplorer === 'function'
              ? React.createElement('button', { type: 'button', className: 'wb-icon-btn', title: t('action.collapsePanel'), onClick: () => layout.toggleExplorer(), children: React.createElement('span', { className: 'wb-codicon wb-codicon-chevron-left' }) })
              : null
          ] }),
          React.createElement('div', { className: 'wbx-tree', children: [
            create !== null
              ? React.createElement('div', { className: 'wbx-create-row', children: [
                  React.createElement('span', { className: 'wb-row-icon wb-codicon ' + (create.kind === 'file' ? 'wb-codicon-new-file' : 'wb-codicon-new-folder'), style: { fontSize: 14 } }),
                  React.createElement('input', {
                    className: 'wbx-create-input',
                    autoFocus: true,
                    placeholder: create.kind === 'file' ? t('create.file.placeholder') : t('create.folder.placeholder'),
                    value: create.value,
                    onChange: (e) => setCreate({ ...create, value: e.target.value }),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter') submitCreate()
                      if (e.key === 'Escape') { setCreate(null); ui.create = null }
                    },
                    onBlur: () => { setCreate(null); ui.create = null }
                  })
                ] })
              : null,
            tr !== null
              ? React.createElement('div', {
                  className: 'wb-row',
                  style: { paddingLeft: 6 },
                  title: tr.root,
                  onClick: () => toggleDir(tr.root),
                  children: [
                    React.createElement('span', { className: 'wb-row-chevron wb-codicon ' + (tr.expanded.has(tr.root) ? 'wb-codicon-chevron-down' : 'wb-codicon-chevron-right') }),
                    React.createElement('span', { className: 'wb-row-icon seti seti-folder' }),
                    React.createElement('span', { className: 'wb-row-name', children: tr.rootName })
                  ]
                })
              : null,
            tr !== null && tr.expanded.has(tr.root) ? renderRows(rootChildren, 1, tr.root) : null
          ] })
        ]
      })
    }

    // ---- EditorView (middle column, conversation.view entry) ----
    function EditorView(props) {
      const t = typeof props.t === 'function' ? props.t : tBind
      const u = useUI()
      const holderRef = React.useRef(null)
      const sessionId = props.sessionId
      React.useEffect(() => { bootMonaco() }, [])
      // hide the composer while the editor view is mounted (fills the column)
      React.useEffect(() => {
        if (typeof document === 'undefined') return
        document.body.setAttribute('data-wb-editor-active', '1')
        return () => { document.body.removeAttribute('data-wb-editor-active') }
      }, [])

      // create the editor instance while this view is mounted
      React.useEffect(() => {
        if (u.monacoState !== 'ready' || u.editor !== null || holderRef.current === null) return
        const editor = u.monaco.editor.create(holderRef.current, {
          theme: 'vs-dark',
          automaticLayout: true,
          fontSize: 13,
          fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          renderWhitespace: 'selection',
          tabSize: 2,
          padding: { top: 10 }
        })
        u.editor = editor
        editor.addCommand(u.monaco.KeyMod.CtrlCmd | u.monaco.KeyCode.KeyS, () => { savePath(u.activePath, true) })
        editor.onDidChangeModelContent((e) => { if (e.changes && e.changes.length > 0) markDirtyForModel(e.model) })
        const ap = u.activePath
        if (ap !== null) { const m = u.models.get(ap); if (m !== undefined) editor.setModel(m) }
        return () => { u.editor = null; editor.dispose() }
      }, [u.monacoState])

      // materialize models from pending contents; bind the active model
      React.useEffect(() => {
        if (u.monacoState !== 'ready') return
        let changed = false
        for (const tb of u.tabs) {
          const content = u.contents.get(tb.path)
          if (content !== undefined && !u.models.has(tb.path)) {
            const model = u.monaco.editor.createModel(content, tb.lang)
            u.models.set(tb.path, model)
            u.contents.delete(tb.path)
            u.savedAltIds.set(tb.path, model.getAlternativeVersionId())
            changed = true
          }
        }
        if (u.editor !== null) {
          const ap = u.activePath
          if (ap !== null) {
            const m = u.models.get(ap)
            if (m !== undefined && u.editor.getModel() !== m) u.editor.setModel(m)
          }
        }
        if (changed) emit()
      }, [u.monacoState, u])

      const activeTab = u.tabs.find((tb) => tb.path === u.activePath) || null
      const errorText = (code) => {
        if (code === 'too-large') return t('error.too-large')
        if (code === 'not-text') return t('error.not-text')
        if (code === 'not-found') return t('error.not-found')
        return t('error.loading') + ' (' + code + ')'
      }
      const bridge = bridgeFor(sessionId)

      return React.createElement('div', {
        className: 'wbx-editor',
        children: [
          React.createElement('div', { className: 'wbx-tabs', children: [
            u.tabs.map((tb) => {
              const isActive = tb.path === u.activePath
              const isDirtyTab = u.dirty.has(tb.path)
              return React.createElement('div', {
                key: tb.path,
                className: 'wbx-tab' + (isActive ? ' wbx-tab-active' : '') + (isDirtyTab ? ' wbx-tab-dirty' : ''),
                title: tb.path,
                onClick: () => { u.activePath = tb.path; emit() },
                children: [
                  React.createElement('span', { className: 'wbx-tab-icon ' + (tb.status === 'ready' ? iconClassFor({ name: tb.name, type: 'file' }) : 'wb-codicon wb-codicon-file-code') }),
                  React.createElement('span', { className: 'wbx-tab-label', children: tb.name }),
                  tb.status === 'loading' ? React.createElement('span', { children: '…', style: { flex: 'none', fontSize: 12 } }) : null,
                  React.createElement('span', {
                    className: 'wbx-tab-x wb-codicon ' + (isDirtyTab ? (u.closing.has(tb.path) ? 'wb-codicon-trash' : 'wb-codicon-close') : 'wb-codicon-close'),
                    title: isDirtyTab ? t('tab.closeDirty') : t('tab.close'),
                    onClick: (e) => { e.stopPropagation(); closePath(tb.path) }
                  })
                ]
              })
            }),
            bridge !== null
              ? React.createElement('button', { type: 'button', className: 'wbx-back', title: t('view.back'), onClick: () => bridge.setView('chat'), children: [
                  React.createElement('span', { className: 'wb-codicon wb-codicon-comment-discussion' }),
                  React.createElement('span', { children: t('view.back') })
                ] })
              : null
          ] }),
          u.banner !== null
            ? React.createElement('div', { className: 'wbx-banner wbx-banner-' + u.banner.kind, children: [
                React.createElement('span', { className: 'wbx-banner-text', children: u.banner.text }),
                activeTab !== null && u.conflict.has(activeTab.path) && u.banner.kind === 'warn'
                  ? React.createElement('span', { children: [
                      React.createElement('button', { type: 'button', className: 'wbx-banner-btn', onClick: () => reloadPath(activeTab.path), children: t('banner.reload') }),
                      React.createElement('button', { type: 'button', className: 'wbx-banner-btn', onClick: () => savePath(activeTab.path, false), children: t('banner.overwrite') })
                    ] })
                  : null,
                React.createElement('button', { type: 'button', className: 'wbx-banner-btn', style: { border: 'none' }, onClick: () => { u.banner = null; emit() }, children: React.createElement('span', { className: 'wb-codicon wb-codicon-close' }) })
              ] })
            : null,
          React.createElement('div', { className: 'wbx-holder', ref: holderRef, children: [
            u.monacoState === 'loading' ? React.createElement('div', { className: 'wbx-loading', children: t('loading') }) : null,
            u.monacoState === 'error' && activeTab !== null ? React.createElement('textarea', {
              style: { position: 'absolute', inset: 0, width: '100%', height: '100%', boxSizing: 'border-box', background: '#1e1e1e', color: '#cccccc', border: 'none', padding: 10, fontFamily: 'Consolas, monospace', fontSize: 13, resize: 'none', outline: 'none' },
              value: u.contents.get(activeTab.path) !== undefined ? u.contents.get(activeTab.path) : '',
              onChange: (e) => { u.contents.set(activeTab.path, e.target.value); emit() }
            }) : null,
            activeTab === null && u.monacoState !== 'loading' && u.monacoState !== 'error' ? React.createElement('div', { className: 'wbx-welcome', children: [
              React.createElement('span', { className: 'wbx-welcome-icon wb-codicon wb-codicon-files' }),
              React.createElement('span', { className: 'wbx-welcome-title', children: t('welcome.title') }),
              React.createElement('span', { className: 'wbx-welcome-hint', children: t('welcome.hint') })
            ] }) : null,
            activeTab !== null && activeTab.status === 'error' ? React.createElement('div', { className: 'wbx-welcome', children: [
              React.createElement('span', { className: 'wbx-welcome-icon wb-codicon wb-codicon-trash' }),
              React.createElement('span', { className: 'wbx-welcome-title', children: errorText(activeTab.error) })
            ] }) : null
          ] }),
          React.createElement('div', { className: 'wbx-statusbar', children: [
            React.createElement('span', { children: activeTab !== null ? activeTab.path : (u.tree !== null ? u.tree.root : '') }),
            React.createElement('span', { children: (activeTab !== null ? activeTab.lang + ' · ' : '') + u.tabs.length + ' ' + t('status.files') + (u.dirty.size > 0 ? ' · ' + u.dirty.size + ' ✎' : '') })
          ] })
        ]
      })
    }

    // ---- registrations ----
    slots.inject('explorer', () => slots.register({
      name: 'explorer',
      locale: NS
    }, ExplorerRoot))
    slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view',
      id: 'workbench.editor',
      order: 5,
      locale: NS,
      label: () => tBind('view.editor')
    }, EditorView))
  }
  window.__DSH_WORKBENCH__ = { mount }
})()
