/**
 * Hook for Enter key navigation between form fields
 * Allows users to press Enter to move to next field automatically
 */

import { useCallback, useRef } from 'react';

interface UseEnterNavigationOptions {
  onLastFieldEnter?: () => void; // Callback when Enter is pressed on last field
  skipFields?: Set<number>; // Field indices to skip (e.g., textareas)
}

export function useEnterNavigation(
  fieldCount: number,
  options: UseEnterNavigationOptions = {}
) {
  const { onLastFieldEnter, skipFields = new Set() } = options;
  const fieldsRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>(
    Array(fieldCount).fill(null)
  );

  const registerField = useCallback((index: number) => {
    return (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      fieldsRefs.current[index] = el;
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      // Only handle Enter key, not Shift+Enter (for textareas)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        // Find next non-skipped field
        let nextIndex = currentIndex + 1;
        while (nextIndex < fieldCount && skipFields.has(nextIndex)) {
          nextIndex++;
        }

        if (nextIndex < fieldCount) {
          // Focus next field
          fieldsRefs.current[nextIndex]?.focus();
        } else {
          // Last field - either submit or call callback
          if (onLastFieldEnter) {
            onLastFieldEnter();
          } else {
            // Try to submit the form
            const form = e.currentTarget.closest('form');
            form?.requestSubmit();
          }
        }
      }
    },
    [fieldCount, skipFields, onLastFieldEnter]
  );

  const focusField = useCallback((index: number) => {
    if (index >= 0 && index < fieldCount) {
      fieldsRefs.current[index]?.focus();
    }
  }, [fieldCount]);

  const focusFirstField = useCallback(() => {
    focusField(0);
  }, [focusField]);

  const focusLastField = useCallback(() => {
    focusField(fieldCount - 1);
  }, [focusField, fieldCount]);

  return {
    registerField,
    handleKeyDown,
    focusField,
    focusFirstField,
    focusLastField,
  };
}

/**
 * Simple version for when you just need basic Enter navigation
 * without refs management
 */
export function useSimpleEnterNavigation(onSubmit?: () => void) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        if (nextRef?.current) {
          nextRef.current.focus();
        } else if (onSubmit) {
          onSubmit();
        } else {
          const form = e.currentTarget.closest('form');
          form?.requestSubmit();
        }
      }
    },
    [onSubmit]
  );

  return { handleKeyDown };
}
