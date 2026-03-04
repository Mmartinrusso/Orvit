import { useQuery } from '@tanstack/react-query';
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
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/users`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener usuarios');
      const json = await res.json();
      return json.success ? json.users : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 min — users don't change frequently
  });

  return {
    users: (data as User[]) ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
