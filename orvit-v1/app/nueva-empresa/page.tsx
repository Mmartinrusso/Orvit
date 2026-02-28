'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Building2 } from 'lucide-react';
import { LogoUpload } from '@/components/ui/LogoUpload';

export default function NuevaEmpresaPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    cuit: '',
    direccion: '',
    telefono: '',
    gmail: '',
    description: '',
    logo: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  // Solo usuarios autenticados pueden acceder
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (!isLoading && !user) {
    return null;
  }

  // Solo ADMIN_ENTERPRISE puede crear empresas
  if (!isLoading && user && user.role !== 'ADMIN_ENTERPRISE' && user.role !== 'SUPERADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No autorizado</h2>
          <p className="text-muted-foreground mb-4">
            No tienes permisos para crear empresas.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, logo: logoUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al crear empresa');
      setSuccess('Empresa creada exitosamente');
      setFormData({ name: '', cuit: '', direccion: '', telefono: '', gmail: '', description: '', logo: '' });
      setLogoUrl('');
      
      // Redirigir a la página de empresas después de 1.5 segundos
      setTimeout(() => {
        router.push('/empresas');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background text-foreground transition-colors">
      <div className="flex flex-col items-center mb-8">
        <div className="bg-info-muted rounded-full p-4 mb-2">
          <Building2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold">Crear Nueva Empresa</h2>
        <p className="mt-1 text-muted-foreground">Registra una nueva empresa en el sistema</p>
      </div>
      
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md w-full max-w-2xl border border-border">
        {/* Logo Upload */}
        <div className="mb-6">
          <LogoUpload
            entityType="company"
            entityId="temp"
            currentLogo={logoUrl}
            onLogoUploaded={setLogoUrl}
            onLogoRemoved={() => setLogoUrl('')}
            title="Logo de la Empresa"
            description="Sube el logo oficial de la empresa"
          />
        </div>
        
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          autoComplete="off"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">Nombre de la Empresa</label>
              <input
                type="text"
                id="name"
                required
                autoComplete="off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="cuit" className="block text-sm font-medium">CUIT</label>
              <input
                type="text"
                id="cuit"
                required
                autoComplete="off"
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="direccion" className="block text-sm font-medium">Dirección</label>
              <input
                type="text"
                id="direccion"
                required
                autoComplete="off"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium">Teléfono</label>
              <input
                type="text"
                id="telefono"
                required
                autoComplete="off"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="gmail" className="block text-sm font-medium">Gmail</label>
              <input
                type="email"
                id="gmail"
                required
                autoComplete="off"
                value={formData.gmail}
                onChange={(e) => setFormData({ ...formData, gmail: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium">Dedicación</label>
              <input
                type="text"
                id="description"
                autoComplete="off"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
            </div>
          </div>
          
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="p-3 text-sm text-success bg-success-muted rounded-lg">{success}</div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Empresa'}
          </button>
        </form>
      </div>
      
              <footer className="mt-8 text-muted-foreground text-xs">© 2025 ORVIT. Todos los derechos reservados.</footer>
    </div>
  );
} 