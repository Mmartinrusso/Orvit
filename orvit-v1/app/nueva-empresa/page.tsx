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
        <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-4 mb-2">
          <Building2 className="h-10 w-10 text-blue-500" />
        </div>
        <h2 className="text-3xl font-bold">Crear Nueva Empresa</h2>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Registra una nueva empresa en el sistema</p>
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
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                className="mt-1 block w-full rounded-md border border-input bg-background text-foreground px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
          
          {error && (
            <div className="p-3 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="p-3 text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 rounded-lg">{success}</div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Empresa'}
          </button>
        </form>
      </div>
      
              <footer className="mt-8 text-gray-400 text-xs">© 2025 ORVIT. Todos los derechos reservados.</footer>
    </div>
  );
} 