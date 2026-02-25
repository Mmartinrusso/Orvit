/**
 * back-stack.ts
 *
 * Global stack for Android hardware back button handling.
 * When a modal/dialog/sheet opens, it pushes a close handler here.
 * When the Android back button fires (popstate), the top handler is called
 * (closes the modal) instead of navigating back to the previous URL.
 *
 * Strategy: pushState when modal opens, popstate calls top handler.
 * Programmatic closes leave an orphaned history entry (one extra "do nothing"
 * back press needed). This is an accepted tradeoff for simplicity and stability.
 */

type CloseHandler = () => void

const _stack: CloseHandler[] = []
let _initialized = false

function _init() {
  if (_initialized || typeof window === 'undefined') return
  _initialized = true

  window.addEventListener('popstate', () => {
    const handler = _stack[_stack.length - 1]
    if (handler) {
      _stack.pop()
      handler()
    }
    // If stack is empty, let the browser handle normal navigation
  })
}

// Initialize immediately on client
if (typeof window !== 'undefined') _init()

export function pushBackHandler(fn: CloseHandler): void {
  _init()
  _stack.push(fn)
  // Push a same-URL history entry so back button has something to pop
  if (typeof window !== 'undefined') {
    history.pushState({ __modal: true }, document.title)
  }
}

export function removeBackHandler(fn: CloseHandler): void {
  const idx = _stack.lastIndexOf(fn)
  if (idx !== -1) _stack.splice(idx, 1)
  // Note: we intentionally don't call history.back() here.
  // The orphaned history entry causes one extra "do nothing" back press
  // after a programmatic close — acceptable UX tradeoff.
}
