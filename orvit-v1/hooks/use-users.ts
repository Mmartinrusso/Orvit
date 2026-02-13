import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';

interface User {
  id: number;
  name: string;
  email?: string;
  role: string;
  companyRole: string;
  type: 'USER' | 'WORKER';
  specialty?: string;
}

interface UseUsersReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentCompany } = useCompany();

  const fetchUsers = async () => {
    if (!currentCompany?.id) {
      setError('No hay empresa seleccionada');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/companies/${currentCompany.id}/users`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener usuarios');
      }

      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
      } else {
        throw new Error(data.error || 'Error al obtener usuarios');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      
      // Fallback con usuarios mock si falla
      setUsers([
        { id: 1, name: 'Usuario Demo', email: 'demo@empresa.com', role: 'ADMIN', companyRole: 'ADMIN', type: 'USER' },
        { id: 2, name: 'Operario Demo', email: 'operario@empresa.com', role: 'WORKER', companyRole: 'WORKER', type: 'WORKER', specialty: 'Mantenimiento' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentCompany?.id]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers
  };
} 