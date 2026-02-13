import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============ TYPES ============

export interface PayrollConfig {
  id?: number;
  paymentFrequency: string;
  firstPaymentDay: number;
  secondPaymentDay: number;
  quincenaPercentage: number;
  paymentDayRule: string;
  maxAdvancePercent: number;
  maxActiveAdvances: number;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  isNational: boolean;
}

export interface PayrollProjection {
  configured: boolean;
  message?: string;
  projection?: {
    nextPayment: {
      date: string;
      daysUntil: number;
      periodType: string;
      periodDisplay: string;
      estimatedTotal: number;
      employeeCount: number;
      breakdown: {
        grossSalaries: number;
        deductions: number;
        advances: number;
        netTotal: number;
        employerCost: number;
      };
    } | null;
    pendingAdvances: {
      total: number;
      count: number;
    };
    monthlyProjection: Array<{
      periodType: string;
      paymentDate: string;
      estimatedNet: number;
      employeeCount: number;
    }>;
    alerts: Array<{
      type: 'warning' | 'info' | 'error';
      message: string;
      details?: string;
    }>;
  };
}

export interface Advance {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  amount: number;
  installmentsCount: number;
  installmentAmount: number;
  remainingAmount: number;
  requestDate: string;
  status: string;
  notes?: string;
}

export interface PayrollPeriod {
  id: number;
  periodType: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  businessDays: number;
  isClosed: boolean;
  hasPayroll: boolean;
  payrollStatus: string | null;
}

export interface Payroll {
  id: number;
  periodType: string;
  year: number;
  month: number;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  employeeCount: number;
  calculatedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  calcType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'DAYS_BASED';
  calcValue: number | null;
  calcFormula: string | null;
  baseVariable: string;
  isTaxable: boolean;
  isActive: boolean;
  order: number;
}

// ============ FETCH FUNCTIONS ============

async function fetchProjection(): Promise<PayrollProjection> {
  const res = await fetch(`/api/payroll/projection?_t=${Date.now()}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando proyección');
  }
  return res.json();
}

async function fetchConfig(): Promise<{ config: PayrollConfig | null }> {
  const res = await fetch(`/api/payroll/config?_t=${Date.now()}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando configuración');
  }
  return res.json();
}

async function fetchHolidays(year: number): Promise<{ holidays: Holiday[] }> {
  const res = await fetch(`/api/payroll/holidays?year=${year}&_t=${Date.now()}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando feriados');
  }
  return res.json();
}

async function fetchAdvances(status?: string): Promise<{ advances: Advance[] }> {
  const url = status && status !== 'all'
    ? `/api/payroll/advances?status=${status}&_t=${Date.now()}`
    : `/api/payroll/advances?_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando adelantos');
  }
  return res.json();
}

async function fetchPeriods(year: number, month?: number): Promise<{ periods: PayrollPeriod[] }> {
  let url = `/api/payroll/periods?year=${year}&_t=${Date.now()}`;
  if (month) url += `&month=${month}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando períodos');
  }
  return res.json();
}

async function fetchPayrolls(year: number): Promise<{ payrolls: Payroll[] }> {
  const res = await fetch(`/api/payroll?year=${year}&_t=${Date.now()}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando liquidaciones');
  }
  return res.json();
}

async function fetchComponents(): Promise<{ components: SalaryComponent[] }> {
  const res = await fetch(`/api/payroll/components?_t=${Date.now()}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    throw new Error('Error cargando componentes');
  }
  return res.json();
}

// ============ HOOKS ============

export function usePayrollProjection() {
  return useQuery<PayrollProjection>({
    queryKey: ['payroll', 'projection'],
    queryFn: fetchProjection,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePayrollConfig() {
  return useQuery<{ config: PayrollConfig | null }>({
    queryKey: ['payroll', 'config'],
    queryFn: fetchConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayrollHolidays(year: number) {
  return useQuery<{ holidays: Holiday[] }>({
    queryKey: ['payroll', 'holidays', year],
    queryFn: () => fetchHolidays(year),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayrollAdvances(status?: string) {
  return useQuery<{ advances: Advance[] }>({
    queryKey: ['payroll', 'advances', status],
    queryFn: () => fetchAdvances(status),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function usePayrollPeriods(year: number, month?: number) {
  return useQuery<{ periods: PayrollPeriod[] }>({
    queryKey: ['payroll', 'periods', year, month],
    queryFn: () => fetchPeriods(year, month),
    staleTime: 60 * 1000,
  });
}

export function usePayrolls(year: number) {
  return useQuery<{ payrolls: Payroll[] }>({
    queryKey: ['payroll', 'list', year],
    queryFn: () => fetchPayrolls(year),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useSalaryComponents() {
  return useQuery<{ components: SalaryComponent[] }>({
    queryKey: ['payroll', 'components'],
    queryFn: fetchComponents,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ MUTATIONS ============

export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: PayrollConfig) => {
      const res = await fetch('/api/payroll/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error guardando configuración');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'projection'] });
    },
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (holiday: { date: string; name: string }) => {
      const res = await fetch('/api/payroll/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holiday),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error creando feriado');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'holidays'] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payroll/holidays?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando feriado');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'holidays'] });
    },
  });
}

export function useCreateAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (advance: { employeeId: string; amount: number; installmentsCount: number; notes?: string }) => {
      const res = await fetch('/api/payroll/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advance),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error creando adelanto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'advances'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'projection'] });
    },
  });
}

export function useUpdateAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action, rejectReason }: { id: number; action: 'approve' | 'reject'; rejectReason?: string }) => {
      const res = await fetch(`/api/payroll/advances/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error actualizando adelanto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'advances'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'projection'] });
    },
  });
}

export function useGeneratePeriods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const res = await fetch('/api/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error generando períodos');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'projection'] });
    },
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, notes }: { periodId: number; notes?: string }) => {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error generando liquidación');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useUpdatePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action, cancelReason }: { id: number; action: 'approve' | 'pay' | 'cancel'; cancelReason?: string }) => {
      const res = await fetch(`/api/payroll/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, cancelReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error actualizando liquidación');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useSaveComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (component: Partial<SalaryComponent> & { id?: number }) => {
      const method = component.id ? 'PUT' : 'POST';
      const url = component.id ? `/api/payroll/components/${component.id}` : '/api/payroll/components';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(component),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error guardando componente');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'components'] });
    },
  });
}

export function useDeleteComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payroll/components/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando componente');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'components'] });
    },
  });
}
