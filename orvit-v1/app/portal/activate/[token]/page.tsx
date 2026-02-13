'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Building2, Check, X, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TokenInfo {
  valid: boolean;
  user: {
    email: string;
    contact: {
      firstName: string;
      lastName: string;
    };
    company: {
      name: string;
      logo: string | null;
    };
  };
}

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

function validatePassword(password: string): PasswordValidation {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
      {label}
    </div>
  );
}

export default function ActivateAccountPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValidation = validatePassword(formData.password);
  const allValid = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/portal/activate/${token}`, {
          method: 'GET',
        });

        const data = await response.json();

        if (response.ok && data.valid) {
          setTokenInfo(data);
        } else {
          setTokenError(data.error || 'Token inválido');
        }
      } catch (err) {
        setTokenError('Error al verificar el enlace');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyToken();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allValid) {
      setError('La contraseña no cumple con los requisitos');
      return;
    }

    if (!passwordsMatch) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/portal/activate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        // Redirect to portal after 2 seconds
        setTimeout(() => {
          router.push('/portal');
        }, 2000);
      } else {
        setError(data.error || 'Error al activar la cuenta');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Enlace no válido</CardTitle>
            <CardDescription>{tokenError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Este enlace de activación no es válido o ha expirado.
                Contactá a tu proveedor para solicitar un nuevo enlace.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => router.push('/portal/login')}>
              Ir al Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Cuenta activada</CardTitle>
            <CardDescription>Tu cuenta ha sido activada correctamente</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Serás redirigido al portal en unos segundos...
            </p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4 text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Activation form
  return (
    <div className="min-h-screen grid grid-rows-[1fr_auto] relative overflow-hidden bg-background">
      {/* Patrón de puntos */}
      <div
        className="hidden md:block absolute inset-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />

      <main className="grid place-items-center px-4 py-8 relative z-10">
        <Card className="w-full max-w-md border shadow-sm">
          <CardHeader className="space-y-2 pb-4 text-center">
            {tokenInfo?.user.company.logo ? (
              <img
                src={tokenInfo.user.company.logo}
                alt={tokenInfo.user.company.name}
                className="h-16 w-auto object-contain mx-auto mb-2"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
            <CardTitle className="text-xl">Activá tu cuenta</CardTitle>
            <CardDescription>
              Hola <strong>{tokenInfo?.user.contact.firstName}</strong>, creá tu contraseña para acceder al portal de{' '}
              <strong>{tokenInfo?.user.company.name}</strong>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={tokenInfo?.user.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={submitting}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password requirements */}
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <PasswordRequirement met={passwordValidation.minLength} label="Mínimo 8 caracteres" />
                  <PasswordRequirement met={passwordValidation.hasUppercase} label="Una mayúscula" />
                  <PasswordRequirement met={passwordValidation.hasLowercase} label="Una minúscula" />
                  <PasswordRequirement met={passwordValidation.hasNumber} label="Un número" />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={submitting}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Las contraseñas coinciden
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !allValid || !passwordsMatch}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activando...
                  </>
                ) : (
                  'Activar cuenta'
                )}
              </Button>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                  {error}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground relative z-10">
        Portal de Clientes - Powered by ORVIT
      </footer>
    </div>
  );
}
