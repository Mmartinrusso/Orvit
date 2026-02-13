'use client';

import { useState, useEffect } from 'react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function PortalLoginPage() {
  const { login, isLoading, isAuthenticated, user } = usePortalAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      router.push('/portal');
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email.trim()) {
      setError('Ingresá tu email.');
      return;
    }
    if (!formData.password.trim()) {
      setError('Ingresá tu contraseña.');
      return;
    }

    const result = await login(formData.email, formData.password);
    if (!result.success) {
      setError(result.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen grid grid-rows-[1fr_auto] relative overflow-hidden bg-background">
      {/* Patrón de puntos sutiles */}
      <div
        className="hidden md:block absolute inset-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Main */}
      <main className="grid place-items-center px-4 py-8 relative z-10">
        <Card className="w-full max-w-[420px] border shadow-sm md:-translate-y-6">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex justify-center mb-2">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              Portal de Clientes
            </CardTitle>
            <CardDescription className="text-center">
              Ingresá con tu email y contraseña para acceder.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="tucorreo@empresa.com"
                  autoComplete="email"
                  disabled={isLoading}
                  aria-invalid={error ? 'true' : 'false'}
                  className="bg-background border-input focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    aria-invalid={error ? 'true' : 'false'}
                    className="pr-10 bg-background border-input focus-visible:ring-2 focus-visible:ring-ring/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="default"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Ingresar'
                )}
              </Button>

              {/* Error container */}
              <div className="min-h-[1.5rem]" role="alert" aria-live="polite">
                {error && (
                  <p className="text-sm text-destructive mt-2">{error}</p>
                )}
              </div>
            </form>

            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Si no tenés cuenta, contactá a tu proveedor para solicitar acceso.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="pb-6 text-center text-xs text-muted-foreground relative z-10">
        Portal de Clientes - Powered by ORVIT
      </footer>
    </div>
  );
}
