'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// =====================================================
// TYPES
// =====================================================

export interface PortalUser {
  id: string;
  portalUserId: string;
  clientId: string;
  companyId: number;
  email: string;
  contact: {
    firstName: string;
    lastName: string;
    position: string | null;
  };
  client: {
    id: string;
    name: string | null;
    legalName: string;
  };
  company: {
    id: number;
    name: string;
    logo: string | null;
  };
  permissions: {
    canViewPrices: boolean;
    canViewQuotes: boolean;
    canAcceptQuotes: boolean;
    canCreateOrders: boolean;
    canViewHistory: boolean;
    canViewDocuments: boolean;
  };
  limits: {
    maxOrderAmount: number | null;
    requiresApprovalAbove: number | null;
  };
}

interface PortalAuthContextType {
  user: PortalUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Permission helpers
  canViewPrices: boolean;
  canViewQuotes: boolean;
  canAcceptQuotes: boolean;
  canCreateOrders: boolean;
  canViewHistory: boolean;
  canViewDocuments: boolean;
}

const PortalAuthContext = createContext<PortalAuthContextType | null>(null);

// =====================================================
// PROVIDER
// =====================================================

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const hasCheckedAuthRef = useRef(false);

  // Check auth on mount
  useEffect(() => {
    if (hasCheckedAuthRef.current) return;

    const checkAuth = async () => {
      hasCheckedAuthRef.current = true;

      try {
        const response = await fetch('/api/portal/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
          // Redirect to login if on protected route
          if (pathname?.startsWith('/portal') && !pathname.includes('/login') && !pathname.includes('/activate')) {
            router.push('/portal/login');
          }
        }
      } catch (error) {
        console.error('Error checking portal auth:', error);
        setUser(null);
      }

      setLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Login
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        router.push('/portal');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Error al iniciar sesión' };
      }
    } catch (error) {
      console.error('Error en login del portal:', error);
      return { success: false, error: 'Error de conexión' };
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch('/api/portal/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error en logout del portal:', error);
    }

    setUser(null);
    router.push('/portal/login');
  }, [router]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error refreshing portal user:', error);
    }
  }, []);

  // Permission helpers
  const permissions = user?.permissions || {
    canViewPrices: false,
    canViewQuotes: false,
    canAcceptQuotes: false,
    canCreateOrders: false,
    canViewHistory: false,
    canViewDocuments: false,
  };

  const value: PortalAuthContextType = {
    user,
    login,
    logout,
    refreshUser,
    loading,
    isLoading,
    isAuthenticated: !!user,
    canViewPrices: permissions.canViewPrices,
    canViewQuotes: permissions.canViewQuotes,
    canAcceptQuotes: permissions.canAcceptQuotes,
    canCreateOrders: permissions.canCreateOrders,
    canViewHistory: permissions.canViewHistory,
    canViewDocuments: permissions.canViewDocuments,
  };

  return (
    <PortalAuthContext.Provider value={value}>
      {children}
    </PortalAuthContext.Provider>
  );
}

// =====================================================
// HOOK
// =====================================================

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (!context) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider');
  }
  return context;
}

// =====================================================
// GUARD COMPONENT
// =====================================================

interface PortalAuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredPermission?: keyof PortalUser['permissions'];
}

export function PortalAuthGuard({ children, fallback, requiredPermission }: PortalAuthGuardProps) {
  const { isAuthenticated, loading, user } = usePortalAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/portal/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check specific permission if required
  if (requiredPermission && user && !user.permissions[requiredPermission]) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permisos para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
