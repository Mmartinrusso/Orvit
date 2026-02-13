'use client';

/**
 * Mode Indicator - Disabled for security
 */

interface ModeIndicatorProps {
  className?: string;
}

export function ModeIndicator({ className }: ModeIndicatorProps) {
  // Always hidden for security
  void className;
  return null;
}
