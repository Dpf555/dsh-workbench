// DSH Workbench — guarded CLIENT bootstrap (dynamic package half)
// Loads the vendored workbench bundle from /wb/workbench-client.js and hands it
// the live slots/locale/layout services plus the React runtime. All file operations
// stay inside the guarded HOST half (workspace-fenced /wb-api endpoints).
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const locale = ctx.get('locale')
    const layout = ctx.get('layout')
    const NS = 'workbench'
    const params = { slots, locale, NS, React, layout }

    const ready = () => typeof window !== 'undefined' && window.__DSH_WORKBENCH__ !== undefined
      && typeof window.__DSH_WORKBENCH__.mount === 'function'
    const mount = () => {
      if (!ready()) return
      try { window.__DSH_WORKBENCH__.mount(params) } catch (e) { console.error('[dsh-workbench] bundle mount failed:', e) }
    }

    if (typeof document === 'undefined') { mount(); return }
    let script = document.querySelector('script[data-dsh-workbench-bundle]')
    if (script === null) {
      script = document.createElement('script')
      script.src = '/wb/workbench-client.js'
      script.dataset.dshWorkbenchBundle = '1'
      document.head.appendChild(script)
    }
    script.addEventListener('load', mount)
    if (ready()) mount()
  }
}
