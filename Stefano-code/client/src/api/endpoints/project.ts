import { apiClient } from '../client';
import type {
  ProjectInfoResponse,
  ProjectFilesResponse,
  GitLogResponse,
  GitDiffResponse,
} from '../types';

export async function getProjectInfo(): Promise<ProjectInfoResponse> {
  const { data } = await apiClient.get('/api/project/info');
  return data;
}

export async function getProjectFiles(path?: string): Promise<ProjectFilesResponse> {
  const { data } = await apiClient.get('/api/project/files', { params: { path } });
  return data;
}

export async function getGitLog(limit?: number): Promise<GitLogResponse> {
  const { data } = await apiClient.get('/api/project/git/log', { params: { limit } });
  return data;
}

export async function getGitDiff(): Promise<GitDiffResponse> {
  const { data } = await apiClient.get('/api/project/git/diff');
  return data;
}
