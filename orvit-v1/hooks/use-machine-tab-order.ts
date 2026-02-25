import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';

export function useMachineTabOrder() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['machine-tab-order', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/machine-tab-order`);
      if (!res.ok) throw new Error('Error al obtener orden de tabs');
      const json = await res.json();
      return (json.order ?? []) as string[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (order: string[]) => {
      const res = await fetch(`/api/companies/${companyId}/machine-tab-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error('Error al guardar orden de tabs');
    },
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: ['machine-tab-order', companyId] });
      const prev = queryClient.getQueryData(['machine-tab-order', companyId]);
      queryClient.setQueryData(['machine-tab-order', companyId], order);
      return { prev };
    },
    onError: (_err, _order, ctx) => {
      queryClient.setQueryData(['machine-tab-order', companyId], ctx?.prev);
    },
  });

  return {
    tabOrder: data ?? [],
    setOrder: mutation.mutate,
    isLoading,
  };
}
