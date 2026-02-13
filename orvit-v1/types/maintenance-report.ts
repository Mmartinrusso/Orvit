// ============================================
// MAINTENANCE REPORT TYPES
// For printable A4 maintenance report modal
// ============================================

/**
 * Color tones for badges and cards
 */
export type BadgeTone = 
  | 'green' 
  | 'yellow' 
  | 'orange' 
  | 'red' 
  | 'blue' 
  | 'purple' 
  | 'gray' 
  | 'amber';

/**
 * Tag for maintenance items (type, priority, etc.)
 */
export interface MaintenanceTag {
  label: string;
  tone: BadgeTone;
}

/**
 * Individual maintenance item
 */
export interface MaintenanceReportItem {
  id: number | string;
  name: string;
  description: string;
  frequencyLabel: string;
  durationLabel: string;
  nextDateLabel?: string;
  tags: MaintenanceTag[];
}

/**
 * Group of maintenance items (e.g., Preventivo, Correctivo)
 */
export interface MaintenanceGroup {
  title: string;
  count: number;
  tone: BadgeTone;
  icon?: 'wrench' | 'alert-triangle' | 'clock' | 'check-circle';
  items: MaintenanceReportItem[];
}

/**
 * Machine section with its maintenance groups
 */
export interface MachineSection {
  id: number | string;
  name: string;
  code?: string;
  totalCount: number;
  metaRightTop?: string;
  metaRightBottom?: string;
  groups: MaintenanceGroup[];
}

/**
 * Summary card for the report header
 */
export interface SummaryCard {
  label: string;
  value: string | number;
  tone: BadgeTone;
}

/**
 * Filter chip for applied filters
 */
export interface AppliedFilter {
  label: string;
  value: string;
}

/**
 * Complete report data structure
 */
export interface MaintenanceReportData {
  /** Company name for the header */
  companyName: string;
  /** Report title */
  title: string;
  /** Report subtitle (optional) */
  subtitle?: string;
  /** Generation date string */
  generatedAt: string;
  /** Summary cards (Category, Frequency, Total Items, Estimated Time) */
  summaryCards: SummaryCard[];
  /** Applied filters to display */
  appliedFilters: AppliedFilter[];
  /** Machine sections with their maintenance items */
  machines: MachineSection[];
}

/**
 * Props for the MaintenanceReportModal component
 */
export interface MaintenanceReportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** The report data to display */
  report: MaintenanceReportData;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get background color class for a badge tone
 */
export function getBadgeBgClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return classes[tone];
}

/**
 * Get summary card background class for a tone
 */
export function getSummaryCardClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    gray: 'bg-gray-50 border-gray-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  return classes[tone];
}

/**
 * Get text color class for summary card label
 */
export function getSummaryLabelClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    gray: 'text-gray-600',
    amber: 'text-amber-600',
  };
  return classes[tone];
}

/**
 * Get text color class for summary card value
 */
export function getSummaryValueClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    green: 'text-green-800',
    yellow: 'text-yellow-800',
    orange: 'text-orange-800',
    red: 'text-red-800',
    blue: 'text-blue-800',
    purple: 'text-purple-800',
    gray: 'text-gray-800',
    amber: 'text-amber-800',
  };
  return classes[tone];
}

/**
 * Get left border class for maintenance type
 */
export function getMaintenanceBorderClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    orange: 'border-l-orange-500',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    gray: 'border-l-gray-500',
    amber: 'border-l-amber-500',
  };
  return classes[tone];
}

/**
 * Get icon color class for a tone
 */
export function getIconColorClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    gray: 'text-gray-600',
    amber: 'text-amber-600',
  };
  return classes[tone];
}

