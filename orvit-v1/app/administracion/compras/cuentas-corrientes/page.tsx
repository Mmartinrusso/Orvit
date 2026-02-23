'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  Building2,
  History,
  ArrowLeft,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ProveedorCuentaCorriente from '@/components/compras/proveedor-cuenta-corriente';

interface Proveedor {
  id: number;
  name: string;
  razon_social?: string;
  cuit?: string;
}

interface RecentSearch {
  id: number;
  name: string;
  timestamp: number;
}

export default function CuentasCorrientesPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filteredProveedores, setFilteredProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);

  useEffect(() => {
    loadProveedores();
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProveedores([]);
      setSelectedIndex(0);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = proveedores.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.razon_social?.toLowerCase().includes(term) ||
      p.cuit?.includes(term)
    ).slice(0, 10);
    setFilteredProveedores(filtered);
    setSelectedIndex(0);
  }, [searchTerm, proveedores]);

  const loadProveedores = async () => {
    try {
      const response = await fetch('/api/compras/proveedores?limit=1000');
      if (!response.ok) throw new Error('Error al cargar proveedores');
      const data = await response.json();
      setProveedores(data.data || data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSearches = () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('cuentas-corrientes-recent');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = parsed.filter((r: RecentSearch) => r.timestamp > weekAgo);
        setRecentSearches(recent.slice(0, 5));
      } catch {
        setRecentSearches([]);
      }
    }
  };

  const saveRecentSearch = (proveedor: Proveedor) => {
    if (typeof window === 'undefined') return;
    const newSearch: RecentSearch = {
      id: proveedor.id,
      name: proveedor.name,
      timestamp: Date.now()
    };
    const updated = [
      newSearch,
      ...recentSearches.filter(r => r.id !== proveedor.id)
    ].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('cuentas-corrientes-recent', JSON.stringify(updated));
  };

  const handleSelectProveedor = useCallback((proveedor: Proveedor) => {
    saveRecentSearch(proveedor);
    setSelectedProveedor(proveedor);
    setSearchTerm('');
  }, [recentSearches]);

  const handleBack = () => {
    setSelectedProveedor(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = filteredProveedores.length > 0 ? filteredProveedores : recentSearches;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProveedores.length > 0 && selectedIndex < filteredProveedores.length) {
        handleSelectProveedor(filteredProveedores[selectedIndex]);
      } else if (searchTerm === '' && recentSearches.length > 0 && selectedIndex < recentSearches.length) {
        const recent = recentSearches[selectedIndex];
        const proveedor = proveedores.find(p => p.id === recent.id);
        if (proveedor) handleSelectProveedor(proveedor);
      }
    } else if (e.key === 'Escape') {
      setSearchTerm('');
    }
  };

  useEffect(() => {
    if (!loading && !selectedProveedor && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, selectedProveedor]);

  // Si hay un proveedor seleccionado, mostrar su cuenta corriente
  if (selectedProveedor) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-6 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-success-muted-foreground shrink-0" />
            <span className="font-medium truncate">{selectedProveedor.name}</span>
            {selectedProveedor.cuit && (
              <span className="text-xs text-muted-foreground shrink-0">• {selectedProveedor.cuit}</span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <ProveedorCuentaCorriente
            proveedorId={String(selectedProveedor.id)}
            showHeader={false}
          />
        </div>
      </div>
    );
  }

  // Vista de búsqueda
  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-6 border-b">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar proveedor por nombre, razón social o CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-9 h-10"
            disabled={loading}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de resultados */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Cargando proveedores...
            </div>
          ) : filteredProveedores.length > 0 ? (
            <div className="p-4 space-y-1.5">
              {filteredProveedores.map((proveedor, index) => (
                <button
                  key={proveedor.id}
                  onClick={() => handleSelectProveedor(proveedor)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md border transition-all",
                    index === selectedIndex
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="w-8 h-8 rounded-md bg-success-muted flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-success-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{proveedor.name}</p>
                    {proveedor.razon_social && proveedor.razon_social !== proveedor.name && (
                      <p className="text-xs text-muted-foreground truncate">{proveedor.razon_social}</p>
                    )}
                  </div>
                  {proveedor.cuit && (
                    <span className="text-xs text-muted-foreground">{proveedor.cuit}</span>
                  )}
                </button>
              ))}
            </div>
          ) : searchTerm ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No se encontraron proveedores</p>
            </div>
          ) : recentSearches.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <History className="w-3 h-3" />
                Recientes
              </div>
              <div className="space-y-1.5">
                {recentSearches.map((recent, index) => {
                  const proveedor = proveedores.find(p => p.id === recent.id);
                  if (!proveedor) return null;
                  return (
                    <button
                      key={recent.id}
                      onClick={() => handleSelectProveedor(proveedor)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md border transition-all",
                        index === selectedIndex
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="w-8 h-8 rounded-md bg-success-muted flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-success-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{proveedor.name}</p>
                        {proveedor.cuit && (
                          <p className="text-xs text-muted-foreground">{proveedor.cuit}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Escribe para buscar un proveedor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
