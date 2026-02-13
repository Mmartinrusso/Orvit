/**
 * Extract mode from request
 * Reads from header (injected by middleware)
 */

import { NextRequest } from 'next/server';
import { ViewMode, MODE } from './types';

// Obfuscated header and values (must match middleware.ts)
const VM_HEADER_NAME = 'X-Prf';
const VM_ENCODED = { S: 'p3q8n', E: 'x7k2m' };

/**
 * Get current view mode from request
 * Returns 'S' (Standard) if header not present or invalid
 */
export function getViewMode(request: NextRequest): ViewMode {
  const header = request.headers.get(VM_HEADER_NAME);

  if (header === VM_ENCODED.E) {
    return MODE.EXTENDED;
  }

  // Default to Standard for security
  return MODE.STANDARD;
}

/**
 * Check if current mode is Extended
 * Accepts either NextRequest or ViewMode string
 */
export function isExtendedMode(requestOrMode: NextRequest | ViewMode): boolean {
  // If it's already a ViewMode string, compare directly
  if (typeof requestOrMode === 'string') {
    return requestOrMode === MODE.EXTENDED;
  }
  // Otherwise extract from request
  return getViewMode(requestOrMode) === MODE.EXTENDED;
}

/**
 * Check if current mode is Standard
 * Accepts either NextRequest or ViewMode string
 */
export function isStandardMode(requestOrMode: NextRequest | ViewMode): boolean {
  // If it's already a ViewMode string, compare directly
  if (typeof requestOrMode === 'string') {
    return requestOrMode === MODE.STANDARD;
  }
  // Otherwise extract from request
  return getViewMode(requestOrMode) === MODE.STANDARD;
}
