import { useEffect, useRef } from 'react'
import { pushBackHandler, removeBackHandler } from '@/lib/back-stack'

/**
 * useModalBack
 *
 * Registers a close handler on the global back-stack whenever `isOpen` is true.
 * On Android, pressing the hardware back button fires `popstate`, which calls
 * the top handler (closes this modal) instead of navigating to the previous URL.
 *
 * Usage: call inside any modal/dialog/sheet component that receives open + onClose.
 */
export function useModalBack(isOpen: boolean, onClose: () => void): void {
  // Keep a stable ref so the handler always calls the latest onClose
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    const fn = () => onCloseRef.current()
    pushBackHandler(fn)
    return () => removeBackHandler(fn)
  }, [isOpen])
}
