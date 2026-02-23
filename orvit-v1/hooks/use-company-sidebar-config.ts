'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import type { ModuleSidebarConfig, SidebarModuleKey, CustomAdminGroup } from '@/lib/sidebar/company-sidebar-config';

export interface CompanySidebarConfigResponse {
  ventas: ModuleSidebarConfig;
  mantenimiento: ModuleSidebarConfig;
  produccion: ModuleSidebarConfig;
  compras: ModuleSidebarConfig;
  tesoreria: ModuleSidebarConfig;
  nominas: ModuleSidebarConfig;
  almacen: ModuleSidebarConfig;
  adminOrder: string[];
  sectionLabels: Record<string, string>;
  customGroups: Record<string, CustomAdminGroup>;
  isCustomized: boolean;
}

export function useCompanySidebarConfig() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  return useQuery<CompanySidebarConfigResponse>({
    queryKey: ['company-sidebar-config', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/sidebar-config`);
      if (!res.ok) throw new Error('Error al cargar configuración del sidebar');
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    enabled: !!companyId,
  });
}

export function useUpdateCompanySidebarConfig() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  return useMutation({
    mutationFn: async ({ module, config }: { module: SidebarModuleKey; config: ModuleSidebarConfig }) => {
      const res = await fetch(`/api/companies/${companyId}/sidebar-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, config }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sidebar-config', companyId] });
      toast.success('Sidebar actualizado', { id: 'sidebar-save' });
    },
    onError: (err: Error) => {
      toast.error(err.message, { id: 'sidebar-save' });
    },
  });
}

export function useUpdateAdminModuleOrder() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  return useMutation({
    mutationFn: async (adminOrder: string[]) => {
      const res = await fetch(`/api/companies/${companyId}/sidebar-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminOrder }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al guardar orden');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sidebar-config', companyId] });
      toast.success('Orden actualizado', { id: 'sidebar-order-save' });
    },
    onError: (err: Error) => {
      toast.error(err.message, { id: 'sidebar-order-save' });
    },
  });
}

export function useResetCompanySidebarConfig() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  return useMutation({
    mutationFn: async (moduleKey?: SidebarModuleKey) => {
      const res = await fetch(`/api/companies/${companyId}/sidebar-config`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: moduleKey ? JSON.stringify({ module: moduleKey }) : undefined,
      });
      if (!res.ok) throw new Error('Error al restablecer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sidebar-config', companyId] });
      toast.success('Sidebar restablecido a valores por defecto', { id: 'sidebar-reset' });
    },
    onError: () => {
      toast.error('Error al restablecer el sidebar', { id: 'sidebar-reset' });
    },
  });
}

/** Mutation combinada: order + sectionLabels + custom groups en un solo PUT. */
export function useUpdateAdminSidebar() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  return useMutation({
    mutationFn: async (batch: {
      adminOrder?: string[];
      sectionLabels?: Record<string, string>;
      upsertCustomGroups?: Record<string, CustomAdminGroup>;
      removeCustomGroups?: string[];
    }) => {
      const res = await fetch(`/api/companies/${companyId}/sidebar-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSidebarBatch: batch }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sidebar-config', companyId] });
      toast.success('Sidebar actualizado', { id: 'sidebar-save' });
    },
    onError: (err: Error) => {
      toast.error(err.message, { id: 'sidebar-save' });
    },
  });
}
