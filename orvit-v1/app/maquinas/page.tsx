'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MachineGrid from '@/components/maquinas/MachineGrid';
import MachineTable from '@/components/maquinas/MachineTable';
import MachineDialog from '@/components/maquinas/MachineDialog';
import MobileMachineNavbar from '@/components/layout/MobileMachineNavbar';
import { Machine } from '@/lib/types';
import { Plus, Search, LayoutGrid, LayoutList, Loader2 } from 'lucide-react';

export default function MaquinasPage() {
  const router = useRouter();
  const { currentCompany, currentSector } = useCompany();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // ✨ OPTIMIZADO: Usar hook con React Query (1 solo request)
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? (typeof currentSector.id === 'number' ? currentSector.id : parseInt(String(currentSector.id))) : null;
  const { data, isLoading, refetch } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: !!sectorIdNum }
  );

  const machines: Machine[] = (data?.machines || []) as Machine[];

  // Filter machines
  const filteredMachines = machines.filter(machine => {
    const matchesSearch = machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         machine.nickname?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || machine.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleMachineClick = (machine: Machine) => {
    router.push(`/mantenimiento/maquinas/${machine.id}`);
  };

  const handleDeleteMachine = async (machine: Machine) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta máquina?')) return;
    
    try {
      const response = await fetch(`/api/maquinas/${machine.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        refetch(); // ✨ Usar refetch en lugar de setMachines
      }
    } catch (error) {
      console.error('Error deleting machine:', error);
    }
  };

  const handleCreateWorkOrder = async (machine: Machine) => {
    try {
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: machine.id,
          title: `Orden de trabajo - ${machine.name}`,
          description: 'Orden de trabajo creada desde la lista de máquinas',
          priority: 'medium',
          status: 'pending'
        })
      });
      
      if (response.ok) {
        alert('Orden de trabajo creada exitosamente');
      }
    } catch (error) {
      console.error('Error creating work order:', error);
      alert('No se pudo crear la orden de trabajo. Inténtalo de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Mobile navbar */}
      <MobileMachineNavbar onAddMachine={() => setIsDialogOpen(true)} />
      
      <div className="min-h-screen md:sidebar-shell">
        <div className="md:m-3 md:rounded-2xl md:h-[calc(100vh-24px)] md:surface-card md:dashboard-surface h-screen px-4 md:px-6 pt-2 md:py-6 pb-4 space-y-4 md:space-y-6">
          {/* Header - Hidden on mobile since we have the mobile navbar */}
          <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Máquinas</h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Gestión de máquinas{currentSector ? ` en ${currentSector.name}` : ''}
              </p>
            </div>
          
            <Button 
              onClick={() => setIsDialogOpen(true)} 
              className="sm:self-end w-full sm:w-auto"
              disabled={!currentSector}
              title={!currentSector ? 'Debe seleccionar un sector primero' : ''}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar máquina
            </Button>
          </div>
          
          {/* Filters - Mobile Optimized */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar máquinas..."
                className="pl-10 h-12 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 px-3 -mx-3">
              <div className="flex gap-2 min-w-0 flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="min-w-[140px] h-12">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="out_of_service">Fuera de servicio</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={viewMode} onValueChange={(value: 'grid' | 'list') => setViewMode(value)}>
                  <SelectTrigger className="min-w-[120px] h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        <span>Grid</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="list">
                      <div className="flex items-center gap-2">
                        <LayoutList className="h-4 w-4" />
                        <span>Lista</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Content with internal scroll */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
            {viewMode === 'grid' ? (
              <MachineGrid 
                machines={filteredMachines} 
                onSelect={handleMachineClick}
                onDelete={handleDeleteMachine}
                onCreateWorkOrder={handleCreateWorkOrder}
              />
            ) : (
              <MachineTable 
                machines={filteredMachines} 
                onDelete={handleDeleteMachine}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <MachineDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)}
        onSave={() => {
          setIsDialogOpen(false);
          refetch(); // ✨ Usar refetch del hook
        }}
      />
    </>
  );
} 