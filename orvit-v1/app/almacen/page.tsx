'use client';

import { Suspense, useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Warehouse,
  ClipboardList,
  PackageCheck,
  RotateCcw,
  Package,
  History,
  Bookmark,
  LayoutDashboard,
} from 'lucide-react';

// Hooks
import { useAlmacenModal, type AlmacenTab } from '@/components/almacen/hooks';

// Tabs
import { AlmacenDashboardTab } from '@/components/almacen/tabs/AlmacenDashboardTab';
import { SolicitudesTab } from '@/components/almacen/tabs/SolicitudesTab';
import { DespachosTab } from '@/components/almacen/tabs/DespachosTab';
import { DevolucionesTab } from '@/components/almacen/tabs/DevolucionesTab';
import { InventarioTab } from '@/components/almacen/tabs/InventarioTab';
import { KardexTab } from '@/components/almacen/tabs/KardexTab';
import { ReservasTab } from '@/components/almacen/tabs/ReservasTab';

// Modales
import { SolicitudFormModal } from '@/components/almacen/modals/SolicitudFormModal';
import { SolicitudDetailModal } from '@/components/almacen/modals/SolicitudDetailModal';
import { DespachoFormModal } from '@/components/almacen/modals/DespachoFormModal';
import { DespachoDetailModal } from '@/components/almacen/modals/DespachoDetailModal';
import { DevolucionFormModal } from '@/components/almacen/modals/DevolucionFormModal';
import { DevolucionDetailModal } from '@/components/almacen/modals/DevolucionDetailModal';

// Tipo para item preseleccionado
interface PreselectedItem {
  supplierItemId: number;
  warehouseId: number;
  nombre: string;
  codigo: string;
  unidad: string;
  stockDisponible: number;
}

function AlmacenPageContent() {
  const {
    tab,
    setTab,
    openModal,
    closeModal,
    isNewSolicitud,
    isViewSolicitud,
    isNewDespacho,
    isViewDespacho,
    isNewDevolucion,
    isViewDevolucion,
    id,
  } = useAlmacenModal();

  // Estado para item preseleccionado (despacho/devolución rápida)
  const [preselectedItem, setPreselectedItem] = useState<PreselectedItem | null>(null);

  // Handler para despacho rápido desde inventario
  const handleQuickDispatch = useCallback((item: PreselectedItem) => {
    setPreselectedItem(item);
    openModal('despacho', { mode: 'new' });
  }, [openModal]);

  // Limpiar item preseleccionado al cerrar modal
  const handleCloseModal = useCallback(() => {
    setPreselectedItem(null);
    closeModal();
  }, [closeModal]);

  // Tabs configuración
  const tabs: Array<{ value: AlmacenTab; label: string; icon: any }> = [
    { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { value: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
    { value: 'despachos', label: 'Despachos', icon: PackageCheck },
    { value: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
    { value: 'inventario', label: 'Inventario', icon: Package },
    { value: 'kardex', label: 'Kardex', icon: History },
    { value: 'reservas', label: 'Reservas', icon: Bookmark },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Warehouse className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Gestión de Almacén</h1>
            <p className="text-sm text-muted-foreground">
              Solicitudes, despachos, inventario y movimientos
            </p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => openModal('solicitud', { mode: 'new' })}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Nueva Solicitud
          </Button>
          <Button onClick={() => openModal('despacho', { mode: 'new' })}>
            <PackageCheck className="h-4 w-4 mr-2" />
            Nuevo Despacho
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as AlmacenTab)}>
        <TabsList className="bg-muted/40 border border-border rounded-lg p-1 h-auto flex-wrap">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs gap-1.5 data-[state=active]:bg-background"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <AlmacenDashboardTab
            onOpenSolicitud={(id) => openModal('solicitud', { id, mode: 'view' })}
            onOpenDespacho={(id) => openModal('despacho', { id, mode: 'view' })}
            onNavigateTab={(t) => setTab(t as AlmacenTab)}
          />
        </TabsContent>

        <TabsContent value="solicitudes" className="mt-4">
          <SolicitudesTab
            onNew={() => openModal('solicitud', { mode: 'new' })}
            onView={(id) => openModal('solicitud', { id, mode: 'view' })}
          />
        </TabsContent>

        <TabsContent value="despachos" className="mt-4">
          <DespachosTab
            onNew={() => openModal('despacho', { mode: 'new' })}
            onView={(id) => openModal('despacho', { id, mode: 'view' })}
          />
        </TabsContent>

        <TabsContent value="devoluciones" className="mt-4">
          <DevolucionesTab
            onNew={() => openModal('devolucion', { mode: 'new' })}
            onView={(id) => openModal('devolucion', { id, mode: 'view' })}
          />
        </TabsContent>

        <TabsContent value="inventario" className="mt-4">
          <InventarioTab onDispatchItem={handleQuickDispatch} />
        </TabsContent>

        <TabsContent value="kardex" className="mt-4">
          <KardexTab />
        </TabsContent>

        <TabsContent value="reservas" className="mt-4">
          <ReservasTab />
        </TabsContent>
      </Tabs>

      {/* Modales - controlados por URL params (deep linking) */}
      <SolicitudFormModal
        open={isNewSolicitud}
        onClose={handleCloseModal}
        onSuccess={handleCloseModal}
      />
      <SolicitudDetailModal
        open={isViewSolicitud}
        solicitudId={id}
        onClose={handleCloseModal}
      />
      <DespachoFormModal
        open={isNewDespacho}
        onClose={handleCloseModal}
        onSuccess={handleCloseModal}
        preselectedItem={preselectedItem || undefined}
      />
      <DespachoDetailModal
        open={isViewDespacho}
        despachoId={id}
        onClose={handleCloseModal}
      />
      <DevolucionFormModal
        open={isNewDevolucion}
        onClose={handleCloseModal}
        onSuccess={handleCloseModal}
      />
      <DevolucionDetailModal
        open={isViewDevolucion}
        devolucionId={id}
        onClose={handleCloseModal}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

export default function AlmacenPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AlmacenPageContent />
    </Suspense>
  );
}
