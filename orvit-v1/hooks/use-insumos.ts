import { useState, useEffect, useRef, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';

// Cache global para evitar múltiples fetches
const insumosCache = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

export interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supply {
  id: number;
  name: string;
  unitMeasure: string;
  supplierId: number | null;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  supplierName: string | null;
  supplierContactPerson: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
}

export interface SupplyPrice {
  id: number;
  supplyId: number;
  monthYear: string;
  fecha_imputacion: string;
  pricePerUnit: number;
  freightCost?: number;
  totalPrice?: number;
  notes: string | null;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  supplyName: string;
  unitMeasure: string;
}

export interface SupplyHistory {
  id: number;
  supplyId: number;
  changeType: string;
  oldPrice: number | null;
  newPrice: number | null;
  oldFreightCost?: number | null;
  newFreightCost?: number | null;
  monthYear: string;
  notes: string | null;
  companyId: number;
  createdAt: string;
  supplyName: string;
  unitMeasure: string;
}

// Helper para fetch con cache
async function fetchWithCache<T>(url: string, cacheKey: string, force = false): Promise<T> {
  // Verificar cache
  if (!force) {
    const cached = insumosCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
  }

  // Deduplicación: si ya hay un request en curso, esperar ese
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)! as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      insumosCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export function useInsumos() {
  const { currentCompany } = useCompany();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [prices, setPrices] = useState<SupplyPrice[]>([]);
  const [history, setHistory] = useState<SupplyHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  // Cargar proveedores con cache
  const fetchSuppliers = useCallback(async (force = false) => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const cacheKey = `suppliers-${currentCompany.id}`;
      const data = await fetchWithCache<Supplier[]>(
        `/api/insumos/proveedores?companyId=${currentCompany.id}`,
        cacheKey,
        force
      );
      setSuppliers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error cargando proveedores:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Cargar insumos con cache
  const fetchSupplies = useCallback(async (force = false) => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const cacheKey = `supplies-${currentCompany.id}`;
      const data = await fetchWithCache<Supply[]>(
        `/api/insumos/insumos?companyId=${currentCompany.id}`,
        cacheKey,
        force
      );
      setSupplies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error cargando insumos:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Cargar precios con cache
  const fetchPrices = useCallback(async (supplyId?: number, force = false) => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      let url = `/api/insumos/precios?companyId=${currentCompany.id}`;
      if (supplyId) {
        url += `&supplyId=${supplyId}`;
      }
      
      const cacheKey = `prices-${currentCompany.id}-${supplyId || 'all'}`;
      const data = await fetchWithCache<SupplyPrice[]>(url, cacheKey, force);
      setPrices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error cargando precios:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Cargar historial con cache
  const fetchHistory = useCallback(async (supplyId?: number, force = false) => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      let url = `/api/insumos/historial?companyId=${currentCompany.id}`;
      if (supplyId) {
        url += `&supplyId=${supplyId}`;
      }
      
      const cacheKey = `history-${currentCompany.id}-${supplyId || 'all'}`;
      const data = await fetchWithCache<SupplyHistory[]>(url, cacheKey, force);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Crear proveedor
  const createSupplier = async (supplierData: { 
    name: string; 
    contactPerson?: string; 
    phone?: string; 
    email?: string; 
    address?: string; 
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/insumos/proveedores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...supplierData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear proveedor');
      }

      const newSupplier = await response.json();
      setSuppliers(prev => [...prev, newSupplier]);
      // Refrescar datos para sincronizar
      await refreshData();
      return newSupplier;
    } catch (err) {
      console.error('Error creando proveedor:', err);
      throw err;
    }
  };

  // Actualizar proveedor
  const updateSupplier = async (supplierId: number, supplierData: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/insumos/proveedores/${supplierId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supplierData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar proveedor');
      }

      const updatedSupplier = await response.json();
      setSuppliers(prev => prev.map(s => s.id === supplierId ? updatedSupplier : s));
      // Refrescar datos para sincronizar
      await refreshData();
      return updatedSupplier;
    } catch (err) {
      console.error('Error actualizando proveedor:', err);
      throw err;
    }
  };

  // Eliminar proveedor
  const deleteSupplier = async (supplierId: number) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/insumos/proveedores/${supplierId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar proveedor');
      }

      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
      // Refrescar datos para sincronizar
      await refreshData();
      return true;
    } catch (err) {
      console.error('Error eliminando proveedor:', err);
      throw err;
    }
  };

  // Crear insumo
  const createSupply = async (supplyData: {
    name: string;
    unitMeasure: string;
    supplierId?: number;
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/insumos/insumos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...supplyData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear insumo');
      }

      const newSupply = await response.json();
      setSupplies(prev => [...prev, newSupply]);
      // Refrescar datos para sincronizar
      await refreshData();
      return newSupply;
    } catch (err) {
      console.error('Error creando insumo:', err);
      throw err;
    }
  };

  // Actualizar insumo
  const updateSupply = async (supplyId: number, supplyData: {
    name: string;
    unitMeasure: string;
    supplierId?: number;
    isActive?: boolean;
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/insumos/insumos/${supplyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supplyData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar insumo');
      }

      const updatedSupply = await response.json();
      setSupplies(prev => prev.map(s => s.id === supplyId ? updatedSupply : s));
      // Refrescar datos para sincronizar
      await refreshData();
      return updatedSupply;
    } catch (err) {
      console.error('Error actualizando insumo:', err);
      throw err;
    }
  };

  // Eliminar insumo
  const deleteSupply = async (supplyId: number) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/insumos/insumos/${supplyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar insumo');
      }

      setSupplies(prev => prev.filter(s => s.id !== supplyId));
      // Refrescar datos para sincronizar
      await refreshData();
      return true;
    } catch (err) {
      console.error('Error eliminando insumo:', err);
      throw err;
    }
  };

  // Eliminar precio
  const deletePrice = async (priceId: number) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/insumos/precios/${priceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar precio');
      }

      setPrices(prev => prev.filter(p => p.id !== priceId));
      return true;
    } catch (err) {
      console.error('Error eliminando precio:', err);
      throw err;
    }
  };

  // Registrar precio mensual
  const registerPrice = async (priceData: {
    supplyId: number;
    fecha_imputacion: string;
    pricePerUnit: number;
    freightCost?: number;
    notes?: string;
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/insumos/precios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...priceData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar precio');
      }

      const newPrice = await response.json();
      setPrices(prev => [...prev, newPrice]);
      // Refrescar datos para sincronizar
      await refreshData();
      return newPrice;
    } catch (err) {
      console.error('Error registrando precio:', err);
      throw err;
    }
  };

  // Actualizar precio existente
  const updatePrice = async (priceId: number, priceData: {
    pricePerUnit: number;
    freightCost?: number;
    notes?: string;
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/insumos/precios/${priceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(priceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar precio');
      }

      const updatedPrice = await response.json();
      setPrices(prev => prev.map(p => p.id === priceId ? { ...p, ...updatedPrice } : p));
      // Refrescar datos para sincronizar
      await refreshData();
      return updatedPrice;
    } catch (err) {
      console.error('Error actualizando precio:', err);
      throw err;
    }
  };

  // Carga masiva de precios desde CSV
  const bulkUploadPrices = async (file: File) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', currentCompany.id.toString());

      const response = await fetch('/api/insumos/precios/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la carga masiva');
      }

      const result = await response.json();
      
      // Refrescar datos para sincronizar
      await refreshData();
      
      return result;
    } catch (err) {
      console.error('Error en carga masiva:', err);
      throw err;
    }
  };

  // Refrescar datos (fuerza recarga)
  const refreshData = useCallback(() => {
    // Invalidar cache
    if (currentCompany?.id) {
      insumosCache.delete(`suppliers-${currentCompany.id}`);
      insumosCache.delete(`supplies-${currentCompany.id}`);
      insumosCache.delete(`prices-${currentCompany.id}-all`);
      insumosCache.delete(`history-${currentCompany.id}-all`);
    }
    fetchSuppliers(true);
    fetchSupplies(true);
    fetchPrices(undefined, true);
    fetchHistory(undefined, true);
  }, [currentCompany?.id, fetchSuppliers, fetchSupplies, fetchPrices, fetchHistory]);

  // Obtener el precio actual de un insumo específico (incluye flete)
  const getCurrentPrice = (supplyId: number): number => {
    const supplyPrices = prices.filter(p => p.supplyId === supplyId);
    if (supplyPrices.length === 0) return 0;
    
    // Ordenar por fecha y tomar el más reciente
    const sortedPrices = supplyPrices.sort((a, b) => 
      new Date(b.monthYear).getTime() - new Date(a.monthYear).getTime()
    );
    
    const latestPrice = sortedPrices[0];
    // Retornar precio base + flete (totalPrice incluye ambos)
    return latestPrice.totalPrice || (latestPrice.pricePerUnit + (latestPrice.freightCost || 0));
  };



  // Cargar datos cuando cambie la empresa (solo una vez)
  useEffect(() => {
    if (currentCompany?.id && !initialLoadRef.current) {
      initialLoadRef.current = true;
      // Cargar todos los datos en paralelo
      Promise.all([
        fetchSuppliers(),
        fetchSupplies(),
        fetchPrices(),
        fetchHistory()
      ]);
    }
  }, [currentCompany?.id, fetchSuppliers, fetchSupplies, fetchPrices, fetchHistory]);

  // Reset cuando cambia la empresa
  useEffect(() => {
    initialLoadRef.current = false;
  }, [currentCompany?.id]);

  return {
    suppliers,
    supplies,
    prices,
    history,
    loading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createSupply,
    updateSupply,
    deleteSupply,
    deletePrice,
    registerPrice,
    updatePrice,
    bulkUploadPrices,
    fetchPrices,
    fetchHistory,
    refreshData,
    getCurrentPrice,
  };
}
