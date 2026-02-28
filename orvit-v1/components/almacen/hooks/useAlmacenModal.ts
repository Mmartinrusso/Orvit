'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

// Tipos de modal disponibles
export type AlmacenModalType =
  | 'solicitud'
  | 'despacho'
  | 'devolucion'
  | 'reserva'
  | 'transferencia'
  | 'ajuste'
  | 'item'
  | null;

// Modos de modal
export type AlmacenModalMode = 'new' | 'edit' | 'view' | null;

// Tabs disponibles
export type AlmacenTab =
  | 'dashboard'
  | 'solicitudes'
  | 'despachos'
  | 'devoluciones'
  | 'inventario'
  | 'kardex'
  | 'reservas'
  | 'transferencias'
  | 'ajustes'
  | 'materiales';

interface UseAlmacenModalReturn {
  // Estado actual
  modal: AlmacenModalType;
  mode: AlmacenModalMode;
  id: number | null;
  tab: AlmacenTab;

  // Acciones
  openModal: (
    type: AlmacenModalType,
    options?: { id?: number; mode?: AlmacenModalMode }
  ) => void;
  closeModal: () => void;
  setTab: (tab: AlmacenTab) => void;

  // Helpers booleanos para cada modal
  isNewSolicitud: boolean;
  isViewSolicitud: boolean;
  isEditSolicitud: boolean;

  isNewDespacho: boolean;
  isViewDespacho: boolean;
  isEditDespacho: boolean;

  isNewDevolucion: boolean;
  isViewDevolucion: boolean;
  isEditDevolucion: boolean;

  isNewReserva: boolean;
  isViewReserva: boolean;

  isNewTransferencia: boolean;
  isViewTransferencia: boolean;

  isNewAjuste: boolean;
  isViewAjuste: boolean;

  isViewItem: boolean;

  // Helper para verificar si hay modal abierto
  hasOpenModal: boolean;
}

/**
 * Hook para manejar modales con URL params (deep linking)
 *
 * Estructura de URL:
 * - /almacen?tab=solicitudes                          # Lista de solicitudes
 * - /almacen?tab=solicitudes&modal=solicitud&mode=new # Nueva solicitud
 * - /almacen?tab=solicitudes&modal=solicitud&id=123   # Ver solicitud 123
 * - /almacen?tab=despachos&modal=despacho&id=456      # Ver despacho 456
 *
 * Beneficios:
 * - Deep linking: URLs compartibles
 * - Back button: Funciona correctamente
 * - Refresh: No pierde estado del modal
 */
export function useAlmacenModal(): UseAlmacenModalReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Extraer valores de URL
  const modal = (searchParams.get('modal') as AlmacenModalType) || null;
  const mode = (searchParams.get('mode') as AlmacenModalMode) || null;
  const idParam = searchParams.get('id');
  const id = idParam ? Number(idParam) : null;
  const tab = (searchParams.get('tab') as AlmacenTab) || 'dashboard';

  /**
   * Abre un modal actualizando la URL
   */
  const openModal = useCallback(
    (
      type: AlmacenModalType,
      options?: { id?: number; mode?: AlmacenModalMode }
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      if (type) {
        params.set('modal', type);

        if (options?.id) {
          params.set('id', String(options.id));
          params.set('mode', options.mode || 'view');
        } else {
          params.set('mode', options?.mode || 'new');
          params.delete('id');
        }
      } else {
        params.delete('modal');
        params.delete('mode');
        params.delete('id');
      }

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  /**
   * Cierra el modal actual
   */
  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('modal');
    params.delete('mode');
    params.delete('id');

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  /**
   * Cambia el tab actual (y cierra cualquier modal abierto)
   */
  const setTab = useCallback(
    (newTab: AlmacenTab) => {
      const params = new URLSearchParams();
      params.set('tab', newTab);

      // Al cambiar de tab, cerrar modales
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  // Helpers booleanos computados
  const helpers = useMemo(() => {
    return {
      // Solicitudes
      isNewSolicitud: modal === 'solicitud' && mode === 'new',
      isViewSolicitud: modal === 'solicitud' && mode === 'view' && id !== null,
      isEditSolicitud: modal === 'solicitud' && mode === 'edit' && id !== null,

      // Despachos
      isNewDespacho: modal === 'despacho' && mode === 'new',
      isViewDespacho: modal === 'despacho' && mode === 'view' && id !== null,
      isEditDespacho: modal === 'despacho' && mode === 'edit' && id !== null,

      // Devoluciones
      isNewDevolucion: modal === 'devolucion' && mode === 'new',
      isViewDevolucion: modal === 'devolucion' && mode === 'view' && id !== null,
      isEditDevolucion: modal === 'devolucion' && mode === 'edit' && id !== null,

      // Reservas
      isNewReserva: modal === 'reserva' && mode === 'new',
      isViewReserva: modal === 'reserva' && mode === 'view' && id !== null,

      // Transferencias
      isNewTransferencia: modal === 'transferencia' && mode === 'new',
      isViewTransferencia: modal === 'transferencia' && mode === 'view' && id !== null,

      // Ajustes
      isNewAjuste: modal === 'ajuste' && mode === 'new',
      isViewAjuste: modal === 'ajuste' && mode === 'view' && id !== null,

      // Items
      isViewItem: modal === 'item' && id !== null,

      // General
      hasOpenModal: modal !== null,
    };
  }, [modal, mode, id]);

  return {
    modal,
    mode,
    id,
    tab,
    openModal,
    closeModal,
    setTab,
    ...helpers,
  };
}

/**
 * Hook simplificado para obtener solo el tab actual
 */
export function useAlmacenTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tab = (searchParams.get('tab') as AlmacenTab) || 'dashboard';

  const setTab = useCallback(
    (newTab: AlmacenTab) => {
      const params = new URLSearchParams();
      params.set('tab', newTab);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  return { tab, setTab };
}

/**
 * Genera URL para deep linking a un modal específico
 */
export function getAlmacenModalUrl(
  type: AlmacenModalType,
  options?: {
    id?: number;
    mode?: AlmacenModalMode;
    tab?: AlmacenTab;
  }
): string {
  const params = new URLSearchParams();

  if (options?.tab) {
    params.set('tab', options.tab);
  }

  if (type) {
    params.set('modal', type);

    if (options?.id) {
      params.set('id', String(options.id));
      params.set('mode', options.mode || 'view');
    } else {
      params.set('mode', options?.mode || 'new');
    }
  }

  return `/almacen?${params.toString()}`;
}

/**
 * Genera URL para un tab específico
 */
export function getAlmacenTabUrl(tab: AlmacenTab): string {
  return `/almacen?tab=${tab}`;
}
