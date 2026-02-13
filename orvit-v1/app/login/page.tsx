'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import OrvitLogoMotion from '@/components/ui/OrvitLogoMotion';

// Componente wrapper para el logo animado - Esfera 3D con cintas espirales
function OrvitLogo() {
  return (
    <div className="flex justify-center">
      <OrvitLogoMotion
        size={150}
        speed={0.4}
        theme="light"
      />
    </div>
  );
}

export default function LoginPage() {
  const { login, logout, isLoading, isAuthenticated, user } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validación básica del lado del cliente
    if (!formData.email.trim()) {
      setError('Ingresá tu email o usuario.');
      return;
    }
    if (!formData.password.trim()) {
      setError('Ingresá tu contraseña.');
      return;
    }
    
    try {
      const success = await login(formData.email, formData.password);
      if (success) {
        // El contexto maneja la redirección
        console.log('Login exitoso');
      }
    } catch (err: any) {
      console.error('Error en login:', err);
      setError('Email o contraseña incorrectos.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleContinue = () => {
    if (user?.role === 'SUPERADMIN') {
      window.location.href = '/superadmin';
      return;
    }
    // Restaurar sesión previa si existe
    const savedCompany = localStorage.getItem('currentCompany');
    const savedArea = localStorage.getItem('currentArea');
    const savedSector = localStorage.getItem('currentSector');

    if (savedCompany && savedArea) {
      try {
        const area = JSON.parse(savedArea);
        const areaName = area?.name?.trim().toUpperCase();
        if (areaName === 'ADMINISTRACIÓN') {
          window.location.href = '/administracion/dashboard';
        } else if (savedSector && (areaName === 'MANTENIMIENTO' || areaName === 'PRODUCCIÓN')) {
          window.location.href = `/${areaName === 'MANTENIMIENTO' ? 'mantenimiento' : 'produccion'}/dashboard`;
        } else {
          window.location.href = '/sectores';
        }
      } catch {
        window.location.href = '/empresas';
      }
    } else {
      window.location.href = '/empresas';
    }
  };

  // Si el usuario ya está autenticado, mostrar mensaje de sesión activa
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen grid grid-rows-[1fr_auto] relative overflow-hidden bg-background">
        {/* Patrón de puntos sutiles - solo desde md: y con opacidad reducida */}
        <div 
          className="hidden md:block absolute inset-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }}
        />

        {/* Main - centrado verticalmente */}
        <main className="grid place-items-center px-4 py-8 relative z-10">
          <div className="w-full max-w-[420px]">
            <Card className="border shadow-sm md:-translate-y-6">
              <CardHeader className="space-y-2 pb-4">
                <div className="flex justify-center">
              <OrvitLogo />
            </div>
                <CardTitle className="text-2xl text-center">
              Sesión Activa
                </CardTitle>
                <CardDescription className="text-center">
              Ya tienes una sesión iniciada
                </CardDescription>
              </CardHeader>
          
              <CardContent>
            <div className="text-center mb-6">
                  <p className="text-foreground mb-6">
                    Has iniciado sesión como <strong className="text-foreground">{user.name}</strong>
              </p>
            </div>
            
            <div className="space-y-3">
                  <Button
                onClick={handleContinue}
                    variant="default"
                    className="w-full"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Continuar con la sesión
                  </Button>
              
                  <Button
                onClick={handleLogout}
                    variant="outline"
                    className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
                  </Button>
            </div>
              </CardContent>
            </Card>
          </div>
        </main>
          
        {/* Footer */}
        <footer className="pb-6 text-center text-xs text-muted-foreground relative z-10">
            © 2025 ORVIT. Todos los derechos reservados.
          </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-rows-[1fr_auto] relative overflow-hidden bg-background">
      {/* Patrón de puntos sutiles - solo desde md: y con opacidad reducida */}
      <div 
        className="hidden md:block absolute inset-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />
      
      {/* Main - centrado verticalmente */}
      <main className="grid place-items-center px-4 py-8 relative z-10">
        <Card className="w-full max-w-[420px] border shadow-sm md:-translate-y-6">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex justify-center">
            <OrvitLogo />
          </div>
            <CardTitle className="text-2xl text-center">
              Iniciar sesión
            </CardTitle>
            <CardDescription className="text-center">
              Accedé a ORVIT para continuar.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email o usuario
                </Label>
                <Input
                  id="email"
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                  autoComplete="username"
                  disabled={isLoading}
                  aria-invalid={error && (!formData.email.trim() || error.includes('incorrectos')) ? 'true' : 'false'}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="bg-background border-input focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </div>
            
              <div className="space-y-2">
                <Label htmlFor="password">
                Contraseña
                </Label>
              <div className="relative">
                  <Input
                    id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    aria-invalid={error && (!formData.password.trim() || error.includes('incorrectos')) ? 'true' : 'false'}
                    aria-describedby={error ? 'login-error' : undefined}
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
                    Verificando…
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>
              
              {/* Contenedor de error con min-h para evitar layout shift */}
              <div className="min-h-[1.5rem]" role="alert" aria-live="polite">
                {error && (
                  <p id="login-error" className="text-sm text-destructive mt-2">
                    {error}
                  </p>
              )}
              </div>
          </form>
          </CardContent>
        </Card>
      </main>
        
      {/* Footer */}
      <footer className="pb-6 text-center text-xs text-muted-foreground relative z-10">
          © 2025 ORVIT. Todos los derechos reservados.
        </footer>
    </div>
  );
}