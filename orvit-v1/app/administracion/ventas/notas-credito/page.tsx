'use client';

/**
 * Credit/Debit Notes Page
 *
 * Main page for credit and debit notes management with:
 * - Tab navigation (List, Dashboard)
 * - Create/View/Emit notes
 * - Analytics and reporting
 * - T1/T2 ViewMode support
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CreditNotesList } from '@/components/ventas/credit-notes-list';
import { CreditNoteCreateModal } from '@/components/ventas/credit-note-create-modal';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useViewMode } from '@/contexts/ViewModeContext';
import { BarChart3, List, Plus } from 'lucide-react';

export default function NotasCreditoDebitoPage() {
  const { mode: viewMode } = useViewMode();
  const [activeTab, setActiveTab] = useState('list');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    setCreateModalOpen(false);
  };

  return (
    <PermissionGuard permission="ventas.notas.view">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Notas de Crédito/Débito</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Gestiona notas de crédito y débito de clientes
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Nota
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Listado
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            <CreditNotesList key={refreshKey} viewMode={viewMode} />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Dashboard de analytics en desarrollo</p>
              <p className="text-sm mt-2">
                Próximamente: gráficos de tendencias, análisis por motivo, y KPIs
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Modal */}
        <CreditNoteCreateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
          viewMode={viewMode}
        />
      </div>
    </PermissionGuard>
  );
}
