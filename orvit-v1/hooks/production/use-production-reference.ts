'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

// === Tipos compartidos ===

interface WorkCenter {
  id: number;
  name: string;
  code?: string;
  machine?: { sectorId?: number | null } | null;
}

interface Shift {
  id: number;
  name: string;
}

interface ProductionResource {
  id: number;
  code: string;
  name: string;
  resourceType?: { id: number; code: string; name: string };
  status?: string;
  order?: number;
}

interface Employee {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  companyRole?: { id: number; name: string } | null;
}

interface WorkSector {
  id: number;
  name: string;
  code?: string;
  sector?: { id: number; name: string } | null;
}

interface Sector {
  id: number;
  name: string;
}

interface ResourceType {
  id: number;
  code: string;
  name: string;
}

// === Fetchers ===

async function fetchWorkCenters(): Promise<WorkCenter[]> {
  const res = await fetch('/api/production/work-centers?status=ACTIVE');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success ? data.workCenters : [];
}

async function fetchShifts(): Promise<Shift[]> {
  const res = await fetch('/api/production/shifts?activeOnly=true');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success ? data.shifts : [];
}

async function fetchResources(): Promise<ProductionResource[]> {
  const res = await fetch('/api/production/resources?status=ACTIVE');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success ? data.resources : [];
}

async function fetchSectors(): Promise<Sector[]> {
  const res = await fetch('/api/production/sectors');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.success && Array.isArray(data.sectors)) {
    return data.sectors.map((s: any) => ({ id: s.id, name: s.name }));
  }
  return [];
}

async function fetchWorkSectors(): Promise<WorkSector[]> {
  const res = await fetch('/api/production/work-sectors?activeOnly=true');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success ? data.workSectors : [];
}

async function fetchResourceTypes(): Promise<ResourceType[]> {
  const res = await fetch('/api/production/resource-types');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success ? data.resourceTypes : [];
}

interface EmployeeFilters {
  sectorId?: number;
  workCenterId?: number;
  templateName?: string;
  all?: boolean;
}

interface EmployeesResponse {
  employees: Employee[];
  allSectorRoles?: string[];
}

async function fetchEmployees(filters: EmployeeFilters): Promise<EmployeesResponse> {
  let url = '/api/production/routines/employees';
  const params = new URLSearchParams();

  if (filters.all) {
    // No filters — fetch all
  } else if (filters.sectorId) {
    params.append('sectorId', filters.sectorId.toString());
  } else if (filters.workCenterId) {
    params.append('workCenterId', filters.workCenterId.toString());
  } else if (filters.templateName) {
    params.append('templateName', filters.templateName);
  }

  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    employees: data.success ? data.employees : [],
    allSectorRoles: data.allSectorRoles,
  };
}

async function fetchTemplatesForExecution() {
  const res = await fetch('/api/production/routines/templates?activeOnly=true&limit=100');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success ? data.templates : [];
}

// === Hooks individuales (cada form usa solo lo que necesita) ===

const STALE = 3 * 60 * 1000; // 3 min — datos de referencia cambian poco

export function useWorkCenters(enabled = true) {
  return useQuery({
    queryKey: ['production-work-centers'],
    queryFn: fetchWorkCenters,
    enabled,
    staleTime: STALE,
  });
}

export function useShifts(enabled = true) {
  return useQuery({
    queryKey: ['production-shifts'],
    queryFn: fetchShifts,
    enabled,
    staleTime: STALE,
  });
}

export function useProductionResources(enabled = true) {
  return useQuery({
    queryKey: ['production-resources'],
    queryFn: fetchResources,
    enabled,
    staleTime: STALE,
  });
}

export function useProductionSectors(enabled = true) {
  return useQuery({
    queryKey: ['production-sectors'],
    queryFn: fetchSectors,
    enabled,
    staleTime: STALE,
  });
}

export function useWorkSectors(enabled = true) {
  return useQuery({
    queryKey: ['production-work-sectors'],
    queryFn: fetchWorkSectors,
    enabled,
    staleTime: STALE,
  });
}

export function useResourceTypes(enabled = true) {
  return useQuery({
    queryKey: ['production-resource-types'],
    queryFn: fetchResourceTypes,
    enabled,
    staleTime: STALE,
  });
}

export function useRoutineEmployees(filters: EmployeeFilters, enabled = true) {
  return useQuery({
    queryKey: ['production-employees', filters],
    queryFn: () => fetchEmployees(filters),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useExecutionTemplates(enabled = true) {
  return useQuery({
    queryKey: ['production-execution-templates'],
    queryFn: fetchTemplatesForExecution,
    enabled,
    staleTime: STALE,
  });
}

// Hook combinado para el formulario de ejecución
export function useExecutionFormData(employeeFilters: EmployeeFilters, enabled = true) {
  const queryClient = useQueryClient();
  const workCenters = useWorkCenters(enabled);
  const shifts = useShifts(enabled);
  const resources = useProductionResources(enabled);
  const sectors = useProductionSectors(enabled);
  const workSectorsQuery = useWorkSectors(enabled);
  const templates = useExecutionTemplates(enabled);
  const employees = useRoutineEmployees(employeeFilters, enabled);

  const isLoading = workCenters.isLoading || shifts.isLoading || resources.isLoading ||
    sectors.isLoading || workSectorsQuery.isLoading || templates.isLoading || employees.isLoading;

  return {
    templates: templates.data ?? [],
    workCenters: workCenters.data ?? [],
    shifts: shifts.data ?? [],
    resources: resources.data ?? [],
    sectors: sectors.data ?? [],
    workSectors: workSectorsQuery.data ?? [],
    employees: employees.data?.employees ?? [],
    allSectorRoles: employees.data?.allSectorRoles ?? [],
    isLoading,
    refetchEmployees: () => queryClient.invalidateQueries({ queryKey: ['production-employees'] }),
  };
}

// Hook combinado para el formulario de templates
export function useTemplateFormData(enabled = true) {
  const workCenters = useWorkCenters(enabled);
  const sectors = useProductionSectors(enabled);
  const resourceTypes = useResourceTypes(enabled);

  const isLoading = workCenters.isLoading || sectors.isLoading || resourceTypes.isLoading;

  return {
    workCenters: workCenters.data ?? [],
    sectors: sectors.data ?? [],
    resourceTypes: resourceTypes.data ?? [],
    isLoading,
  };
}

export type { WorkCenter, Shift, ProductionResource, Employee, WorkSector, Sector, ResourceType };
