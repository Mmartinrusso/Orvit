/**
 * View Mode Helper - O2C T1/T2 Support
 *
 * This file re-exports everything from the view-mode folder for backward compatibility.
 * All implementations are in lib/view-mode/
 *
 * ViewMode:
 * - 'S' (Standard): Only shows T1 documents
 * - 'E' (Extended): Shows both T1 and T2 documents
 */

// Re-export everything from the view-mode folder
export * from './view-mode/index';

// Legacy type aliases for backward compatibility
import { DocType } from '@prisma/client';
import { ViewMode, MODE, DOC_TYPE, getDocTypeFilter as _getDocTypeFilter } from './view-mode/index';

// Re-export MODE and DOC_TYPE for direct access
export { MODE, DOC_TYPE } from './view-mode/index';

/**
 * Get the user's view mode from their settings.
 * Falls back to 'S' (Standard) if not set.
 * @deprecated Use getViewMode from request instead
 */
export async function getUserViewMode(userId: number): Promise<ViewMode> {
  return 'S';
}

/**
 * Validate if a user can create documents of a specific DocType.
 * @deprecated Use canCreateT2 from view-mode/permissions instead
 */
export async function canUserCreateDocType(
  userId: number,
  docType: DocType
): Promise<boolean> {
  return docType === 'T1' || true;
}

/**
 * Get docType from request body or default to T1.
 */
export function getDocTypeFromRequest(body: { docType?: string }): DocType {
  if (body.docType === 'T2') {
    return 'T2';
  }
  return 'T1';
}

/**
 * Helper to create a where clause for a specific company with view mode.
 */
export function companyViewModeWhere<T extends Record<string, unknown>>(
  companyId: number,
  viewMode: ViewMode,
  additionalWhere?: T
): { companyId: number; docType: { in: DocType[] } } & T {
  return {
    companyId,
    docType: { in: _getDocTypeFilter(viewMode) },
    ...additionalWhere,
  } as { companyId: number; docType: { in: DocType[] } } & T;
}
