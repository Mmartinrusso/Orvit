/**
 * Reusable cache utilities for both client and server contexts.
 *
 * - `useCacheFreshness`: hook to derive a human-readable label & color from a freshness ratio
 * - `refreshOnVisibility`: auto-refresh when tab becomes visible after being hidden
 * - `CacheLogger`: lightweight logger that can be toggled on/off per-environment
 */

// ── Freshness helpers ─────────────────────────────────────────────────

export interface FreshnessInfo {
  /** 'fresh' | 'aging' | 'stale' | 'expired' */
  status: 'fresh' | 'aging' | 'stale' | 'expired';
  /** Tailwind-friendly color token (e.g. 'green-500') */
  color: string;
  /** Short label for UI */
  label: string;
}

/**
 * Convert a 0-1 freshness ratio into a human-friendly status.
 * 0 = just fetched, 1 = about to expire, null = no cache.
 */
export function getFreshnessInfo(ratio: number | null): FreshnessInfo {
  if (ratio === null) {
    return { status: 'expired', color: 'gray-400', label: 'Sin caché' };
  }
  if (ratio < 0.5) {
    return { status: 'fresh', color: 'green-500', label: 'Actualizado' };
  }
  if (ratio < 0.8) {
    return { status: 'aging', color: 'yellow-500', label: 'Envejeciendo' };
  }
  return { status: 'stale', color: 'amber-500', label: 'Próximo a expirar' };
}

// ── Visibility-based refresh ──────────────────────────────────────────

/**
 * Registers a `visibilitychange` listener that calls `onVisible` when the
 * tab becomes visible again, but only if it was hidden for at least
 * `minHiddenMs` milliseconds (default 30 s).
 *
 * Returns a cleanup function.
 */
export function onTabVisible(
  onVisible: () => void,
  minHiddenMs = 30_000,
): () => void {
  if (typeof document === 'undefined') return () => {};

  let hiddenAt: number | null = null;

  const handler = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
      const elapsed = Date.now() - hiddenAt;
      hiddenAt = null;
      if (elapsed >= minHiddenMs) {
        onVisible();
      }
    }
  };

  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
