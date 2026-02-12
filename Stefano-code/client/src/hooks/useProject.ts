import { useQuery } from '@tanstack/react-query';
import { getProjectInfo, getProjectFiles, getGitLog, getGitDiff } from '../api/endpoints/project';

export function useProject() {
  return useQuery({
    queryKey: ['project-info'],
    queryFn: getProjectInfo,
    staleTime: 30_000,
  });
}

export function useProjectFiles(path?: string) {
  return useQuery({
    queryKey: ['project-files', path],
    queryFn: () => getProjectFiles(path),
    enabled: path !== undefined,
  });
}

export function useGitLog(limit?: number) {
  return useQuery({
    queryKey: ['git-log', limit],
    queryFn: () => getGitLog(limit),
    staleTime: 30_000,
  });
}

export function useGitDiff() {
  return useQuery({
    queryKey: ['git-diff'],
    queryFn: getGitDiff,
    staleTime: 15_000,
  });
}
