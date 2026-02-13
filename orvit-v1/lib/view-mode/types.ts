/**
 * ViewMode System Types
 * Generic naming for security/indetectability
 */

// View modes - S: Standard (default), E: Extended (includes T2)
export type ViewMode = 'S' | 'E';

// Mode constants (server-side only)
export const MODE = {
  STANDARD: 'S' as const,
  EXTENDED: 'E' as const,
};

// Document types - T1: Standard docs, T2: Extended docs
export type DocType = 'T1' | 'T2';

export const DOC_TYPE = {
  T1: 'T1' as const,
  T2: 'T2' as const,
};

// Cookie payload (minified keys for obfuscation)
export interface ViewModeCookiePayload {
  m: ViewMode;     // Mode: S | E
  u: number;       // userId
  c: number;       // companyId
  a: number;       // activatedAt timestamp
  x: number;       // expiresAt timestamp
}

// Company configuration
export interface ViewModeConfig {
  enabled: boolean;
  hk?: string;           // Encrypted hotkey
  timeout: number;       // Session timeout in minutes
}

// API response for view preferences
export interface ViewPreferencesResponse {
  enabled: boolean;
  hk?: string;           // Encrypted hotkey (only if has permission)
}

// Balance structure for supplier accounts
export interface SupplierBalance {
  s1: number;    // Balance type 1 (documented only)
  s2: number;    // Balance total (all types)
  d: number;     // Difference (s2 - s1)
}

// Log action types
export type ViewModeLogAction = 'ACTIVATE' | 'DEACTIVATE' | 'FAILED_PIN';
