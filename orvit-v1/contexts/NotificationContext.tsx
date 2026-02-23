'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useCompany } from './CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { WorkOrderStatus, Priority } from '@/lib/types';
import { useNotifications as useNotificationsHook } from '@/hooks/mantenimiento/use-notifications'; // ✨ OPTIMIZACIÓN: Hook centralizado

export interface Notification {
  id: string;
  type: 'work_order_overdue' | 'work_order_assigned' | 'work_order_status_change' | 'work_order_due_soon' | 'stock_low' | 'stock_out' | 'tool_request_new' | 'tool_request_approved' | 'tool_request_rejected' | 'task_overdue' | 'task_assigned' | 'task_completed' | 'task_updated' | 'task_deleted' | 'task_due_soon' | 'task_auto_reset' | 'task_commented' | 'reminder_overdue' | 'reminder_due_today' | 'reminder_due_soon' | 'invoice_due_soon' | 'invoice_overdue' | 'cheque_due_soon' | 'cheque_overdue' | 'quote_expiring' | 'payment_received' | 'system_alert';
  title: string;
  message: string;
  workOrderId?: number;
  toolId?: number;
  toolRequestId?: string;
  taskId?: number;
  reminderId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  read: boolean;
  userId: number;
  relatedData?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  fetchNotifications: () => Promise<void>;
  clearNotifications: () => void;
  isLoading: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const pathname = usePathname();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // ✨ OPTIMIZACIÓN: Usar hook React Query para evitar duplicados
  // staleTime alto (120s) y refetchOnWindowFocus: false para evitar múltiples llamadas
  // ⚠️ IMPORTANTE: Solo habilitar cuando hay user Y currentCompany Y no estamos en login
  // Esto evita errores durante el flujo de login
  const shouldEnableNotifications = !!user && !!currentCompany?.id && pathname !== '/login';
  
  const notificationsQuery = useNotificationsHook({
    companyId: currentCompany?.id || null,
    limit: 50,
    offset: 0,
    unreadOnly: false,
    enabled: shouldEnableNotifications, // Solo habilitar cuando todo está listo
    staleTime: 120 * 1000 // 120s cache
  });

  const isLoading = notificationsQuery.isLoading || false;

  // ✨ Sincronizar estado local con datos del hook
  useEffect(() => {
    if (notificationsQuery.data?.success) {
      const dbNotifications = notificationsQuery.data.notifications || [];
      setNotifications(prev => {
        const localIds = prev.map(n => n.id);
        const newDbNotifications = dbNotifications.filter((n: any) => 
          !localIds.includes(n.id)
        );
        return [...prev, ...newDbNotifications];
      });
    }
  }, [notificationsQuery.data]);

  // ✨ FIX: clearNotifications debe definirse antes del useEffect que lo usa
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const fetchNotifications = useCallback(async () => {
    // ✨ Ya no se necesita fetch manual, el hook lo maneja
    // Mantener función por compatibilidad con código existente
    if (notificationsQuery.refetch) {
      notificationsQuery.refetch();
    }
  }, [notificationsQuery]);

  // Establecer conexión SSE para notificaciones instantáneas
  // ✨ OPTIMIZADO: No cargar notificaciones si estamos en la página de login
  useEffect(() => {
    // No cargar notificaciones en login para mejorar performance
    if (pathname === '/login') {
      setConnectionStatus('disconnected');
      clearNotifications();
      return;
    }
    
    if (!user || !currentCompany) {
      setConnectionStatus('disconnected');
      // Limpiar notificaciones cuando no hay usuario o empresa
      clearNotifications();
      return;
    }

    // Limpiar notificaciones anteriores al cambiar de usuario
    clearNotifications();

    // ✨ Las notificaciones históricas ahora se cargan automáticamente con el hook
    // No necesitamos llamar fetchNotifications() manualmente

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      setConnectionStatus('connecting');
      // console.log('🔗 Conectando al stream de notificaciones instantáneas...') // Log reducido;

      eventSource = new EventSource('/api/notifications/stream');

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        // // // console.log('✅ Conectado al stream de notificaciones') // Log reducido // Log reducido; // Log reducido
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'notification') {
            // Notificación instantánea recibida
            const notification = data.data;
            setNotifications(prev => [notification, ...prev]);
            
            // Mostrar toast para notificaciones importantes
            if (notification.priority === 'urgent' || notification.priority === 'high') {
              toast({
                title: notification.title,
                description: notification.message,
                variant: notification.priority === 'urgent' ? 'destructive' : 'default',
              });
            }
          } else if (data.type === 'connected') {
            // console.log('🔗 SSE connection established:', data.message); // Log reducido
          } else if (data.type === 'heartbeat') {
            // Heartbeat recibido, conexión está viva
          }
        } catch (error) {
          console.error('Error procesando mensaje SSE:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ Error en conexión SSE:', error);
        setConnectionStatus('error');
        
        if (eventSource) {
          eventSource.close();
        }
        
        // Reconectar después de 5 segundos
        reconnectTimeout = setTimeout(() => {
          connectSSE();
        }, 5000);
      };
    };

    // Iniciar conexión
    connectSSE();

    // Cleanup
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      setConnectionStatus('disconnected');
    };
  }, [user, currentCompany, pathname, clearNotifications]);

  const generateId = () => `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    // Removido el bloqueo de notificaciones de stock bajo
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Mostrar toast para notificaciones importantes
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      toast({
        title: notification.title,
        description: notification.message,
        variant: notification.priority === 'urgent' ? 'destructive' : 'default',
      });
    }
  };

  const markAsRead = async (notificationId: string) => {
    // Marcar localmente primero para UX inmediata
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );

    // Intentar marcar en la BD si es una notificación de BD
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          notificationId: parseInt(notificationId) 
        }),
      });

      // Silently fail for local notifications
    } catch (error) {
      // Silently fail
    }
  };

  const markAllAsRead = async () => {
    // Marcar localmente primero para UX inmediata
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );

    // Intentar marcar todas en la BD
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          markAll: true 
        }),
      });
    } catch (error) {
      // Silently fail
    }
  };

  // Removido el filtro de notificaciones de stock bajo
  // Asegurar que siempre sea un array para evitar errores de .filter
  const filteredNotifications = Array.isArray(notifications) ? notifications : [];

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications: filteredNotifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        fetchNotifications,
        clearNotifications,
        isLoading,
        connectionStatus,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 