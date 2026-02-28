'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  systemRole?: string;
  sectorId?: number | null;
  avatar?: string | null;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // ✨ NUEVO: Forzar recarga de datos del usuario
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean; // ✨ NUEVO: Helper para verificar permisos
  hasAnyPermission: (permissions: string[]) => boolean; // ✨ NUEVO: Verificar si tiene al menos uno
  hasAllPermissions: (permissions: string[]) => boolean; // ✨ NUEVO: Verificar si tiene todos
}

const AuthContext = createContext<AuthContextType | null>(null);



export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  // ✨ FIX: Flag para evitar múltiples llamadas a /api/auth/me
  const hasCheckedAuthRef = useRef(false);

  useEffect(() => {
    // ✨ FIX: Solo verificar auth una vez
    if (hasCheckedAuthRef.current) return;

    // Verificar si hay una sesión JWT válida
    const checkAuth = async () => {
      hasCheckedAuthRef.current = true;

      try {
        let response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        // Si el token expiró, intentar refresh automático
        if (response.status === 401) {
          try {
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
            });

            if (refreshResponse.ok) {
              // Reintentar /api/auth/me con el nuevo token
              response = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include',
              });
            }
          } catch {
            // Refresh falló, continuar con el 401 original
          }
        }

        if (response.ok) {
          const userData = await response.json();
          const realUser: User = {
            id: userData.id.toString(),
            name: userData.name,
            email: userData.email,
            role: userData.role,
            systemRole: userData.systemRole || userData.role,
            sectorId: userData.sectorId || null,
            avatar: userData.avatar || null,
            permissions: userData.permissions || [],
          };
          setUser(realUser);
          // Sincronizar localStorage
          localStorage.setItem('token', 'real-jwt-token');
          localStorage.setItem('userId', realUser.id);
          localStorage.setItem('userEmail', realUser.email);
          localStorage.setItem('userName', realUser.name);

          // Redirigir según el rol si no estamos en la página correcta
          const currentPath = window.location.pathname;
          if (realUser.role === 'SUPERADMIN' && !currentPath.startsWith('/superadmin')) {
            router.push('/superadmin');
          } else if (realUser.role === 'ADMIN' && currentPath === '/login') {
            router.push('/empresas');
          }
        } else {
          // Limpiar cualquier dato residual
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userName');
        }
      } catch {
        // Error de red en check inicial — no limpiar datos, puede ser temporal
        toast.error('Sin conexión. Verificá tu internet.', {
          id: 'network-error',
          duration: 5000,
        });
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  // ✅ FIX: Re-check auth cuando el usuario vuelve al tab (mobile background)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      // Solo re-checkear si ya pasó el check inicial
      if (!hasCheckedAuthRef.current) return;

      try {
        let response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        // Si el access token expiró, intentar refresh
        if (response.status === 401) {
          try {
            const refreshRes = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
            });
            if (refreshRes.ok) {
              response = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include',
              });
            }
          } catch {
            // Refresh falló
          }
        }

        if (response.ok) {
          const userData = await response.json();
          setUser({
            id: userData.id.toString(),
            name: userData.name,
            email: userData.email,
            role: userData.role,
            systemRole: userData.systemRole || userData.role,
            sectorId: userData.sectorId || null,
            avatar: userData.avatar || null,
            permissions: userData.permissions || [],
          });
        } else {
          // Sesión muerta, redirigir a login
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userName');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } catch {
        // Error de red — mostrar toast en vez de redirigir a login
        toast.error('Sin conexión. Verificá tu internet.', {
          id: 'network-error',
          duration: 5000,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ✅ Refresh proactivo: renueva el token 1 minuto antes de que expire
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleProactiveRefresh = useCallback((expiresAt?: string) => {
    // Limpiar timer anterior
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Calcular cuándo refrescar (1 minuto antes de expirar, mínimo 30s)
    let delayMs: number;
    if (expiresAt) {
      const expiresIn = new Date(expiresAt).getTime() - Date.now();
      delayMs = Math.max(expiresIn - 60_000, 30_000); // 1 min antes, mínimo 30s
    } else {
      // Sin expiresAt, refrescar en 13 minutos (access token dura 15min)
      delayMs = 13 * 60 * 1000;
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // Programar el próximo refresh
          scheduleProactiveRefresh(data.expiresAt);
        }
      } catch {
        // Si falla, reintentar en 1 minuto
        scheduleProactiveRefresh();
      }
    }, delayMs);
  }, []);

  // Iniciar el timer cuando el usuario se autentica
  useEffect(() => {
    if (user) {
      scheduleProactiveRefresh();
    }
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [user, scheduleProactiveRefresh]);

  // ✅ FIX: Escuchar eventos de logout desde otras pestañas
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Si se elimina el token o se dispara el evento de logout en otra pestaña
      if (event.key === 'logout-event' || (event.key === 'token' && !event.newValue)) {
        setUser(null);
        // Redirigir a login si no estamos ya ahí
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    };

    // También usar BroadcastChannel para comunicación más rápida (si está disponible)
    let logoutChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      logoutChannel = new BroadcastChannel('auth-channel');
      logoutChannel.onmessage = (event) => {
        if (event.data === 'logout') {
          setUser(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      };
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (logoutChannel) {
        logoutChannel.close();
      }
    };
  }, []);

    const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (response.ok) {
        const data = await response.json();
        const realUser: User = {
          id: data.user.id.toString(),
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          systemRole: data.user.systemRole || data.user.role,
          sectorId: data.user.sectorId || null,
          avatar: data.user.avatar || null,
          permissions: data.user.permissions || [],
        };
        
        setUser(realUser);
        localStorage.setItem('token', 'real-jwt-token');
        localStorage.setItem('userId', realUser.id);
        localStorage.setItem('userEmail', realUser.email);
        localStorage.setItem('userName', realUser.name);

        // Programar refresh proactivo con el expiresAt real del login
        scheduleProactiveRefresh(data.expiresAt);

        setIsLoading(false);

        // Redirigir según el rol del usuario
        if (realUser.role === 'SUPERADMIN') {
          window.location.href = '/superadmin';
        } else {
          // Restaurar sesión previa: sessionStorage (per-tab) > localStorage (shared)
          const tabPath = sessionStorage.getItem('lastPath');
          const savedCompany = sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany');
          const savedArea = sessionStorage.getItem('currentArea') || localStorage.getItem('currentArea');
          const savedSector = sessionStorage.getItem('currentSector') || localStorage.getItem('currentSector');

          // Si hay un path guardado de esta pestaña, ir directo ahí
          if (tabPath && tabPath !== '/login' && tabPath !== '/areas' && tabPath !== '/sectores' && tabPath !== '/empresas' && savedCompany) {
            window.location.href = tabPath;
          } else if (savedCompany && savedArea) {
            try {
              const area = JSON.parse(savedArea);
              const areaName = area?.name?.trim().toUpperCase();
              if (areaName === 'ADMINISTRACIÓN') {
                window.location.href = '/administracion/dashboard';
              } else if (savedSector && areaName === 'MANTENIMIENTO') {
                window.location.href = '/mantenimiento/dashboard';
              } else if (savedSector && areaName === 'PRODUCCIÓN') {
                window.location.href = '/produccion/dashboard';
              } else {
                window.location.href = '/sectores';
              }
            } catch {
              window.location.href = '/empresas';
            }
          } else {
            window.location.href = '/empresas';
          }
        }
        
        return true;
      } else {
        const errorData = await response.json();
        setIsLoading(false);
        throw new Error(errorData.error || 'Credenciales inválidas');
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // ✅ FIX: Llamar al endpoint para eliminar la cookie JWT del servidor
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error al cerrar sesión en el servidor:', error);
    }

    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    // También limpiar la selección de empresa y área
    localStorage.removeItem('currentCompany');
    localStorage.removeItem('currentArea');
    localStorage.removeItem('currentSector');
    // Limpiar sectores guardados por área
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lastSector_area_')) {
        localStorage.removeItem(key);
      }
    });

    // Limpiar sessionStorage (per-tab)
    sessionStorage.removeItem('currentCompany');
    sessionStorage.removeItem('currentArea');
    sessionStorage.removeItem('currentSector');
    sessionStorage.removeItem('lastPath');

    // ✅ FIX: Notificar a otras pestañas que se cerró sesión
    localStorage.setItem('logout-event', Date.now().toString());
    localStorage.removeItem('logout-event');

    // También notificar via BroadcastChannel (más rápido)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('auth-channel');
      channel.postMessage('logout');
      channel.close();
    }

    // Usar window.location para forzar recarga completa
    window.location.href = '/login';
  };

  const isAuthenticated = !!user;

  // ✨ NUEVO: Función para forzar recarga de datos del usuario
  const refreshUser = React.useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me?refresh=true', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        const realUser: User = {
          id: userData.id.toString(),
          name: userData.name,
          email: userData.email,
          role: userData.role,
          systemRole: userData.systemRole || userData.role,
          sectorId: userData.sectorId || null,
          avatar: userData.avatar || null,
          permissions: userData.permissions || [],
        };
        setUser(realUser);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, []);

  // ✨ NUEVO: Helper para verificar permisos en memoria (sin fetch)
  const hasPermission = React.useCallback((permission: string): boolean => {
    if (!user || !user.permissions) {
      return false;
    }
    return user.permissions.includes(permission);
  }, [user]);

  // ✨ NUEVO: Verificar si tiene al menos uno de los permisos
  const hasAnyPermission = React.useCallback((permissions: string[]): boolean => {
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.some(p => user.permissions.includes(p));
  }, [user]);

  // ✨ NUEVO: Verificar si tiene todos los permisos
  const hasAllPermissions = React.useCallback((permissions: string[]): boolean => {
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.every(p => user.permissions.includes(p));
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      refreshUser, // ✨ NUEVO: Forzar recarga
      loading,
      isLoading,
      isAuthenticated,
      hasPermission, // ✨ NUEVO
      hasAnyPermission, // ✨ NUEVO
      hasAllPermissions // ✨ NUEVO
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export { AuthContext };