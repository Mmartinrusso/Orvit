const STORAGE_KEY_PREFIX = 'orvit_agenda_filters_';

export interface AgendaFilters {
  priorities: string[];
  statuses: string[];
  dateFrom: string | null;
  dateTo: string | null;
  assigneeIds: number[];
  groupId: number | null;
}

export const DEFAULT_FILTERS: AgendaFilters = {
  priorities: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
  assigneeIds: [],
  groupId: null,
};

export function saveFilters(companyId: number, filters: AgendaFilters): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${companyId}`,
      JSON.stringify(filters)
    );
  } catch {
    // localStorage unavailable (SSR or private browsing)
  }
}

export function loadFilters(companyId: number): AgendaFilters {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${companyId}`);
    if (!raw) return { ...DEFAULT_FILTERS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export function clearFilters(companyId: number): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${companyId}`);
  } catch {}
}

export function hasActiveFilters(filters: AgendaFilters): boolean {
  return (
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.assigneeIds.length > 0 ||
    filters.groupId !== null
  );
}
