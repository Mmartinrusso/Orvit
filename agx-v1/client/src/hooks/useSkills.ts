import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi } from '@/api';
import type { SkillSaveRequest } from '@/api/types';

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => skillsApi.list(),
    staleTime: 30000,
  });
}

export function useSkillDetail(skillId: string | null) {
  return useQuery({
    queryKey: ['skills', skillId],
    queryFn: () => skillsApi.get(skillId!),
    enabled: !!skillId,
    staleTime: 30000,
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SkillSaveRequest) => skillsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: Omit<SkillSaveRequest, 'id'> }) =>
      skillsApi.update(skillId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => skillsApi.delete(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useMatchSkills() {
  return useMutation({
    mutationFn: (prompt: string) => skillsApi.match(prompt),
  });
}
