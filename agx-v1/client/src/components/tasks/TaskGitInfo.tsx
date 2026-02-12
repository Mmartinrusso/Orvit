import { GitBranch, GitCommit, ExternalLink } from 'lucide-react';
import type { RepoGitResult } from '@/api';
import { getGitHubBranchUrl } from '@/utils';

interface TaskGitInfoProps {
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  prUrl?: string | null;
  repos?: RepoGitResult[];
  repoUrl?: string | null;
  // Can be array or JSON string from database
  reposJson?: Array<{ url: string; description: string; branch?: string }> | string | null;
}

export function TaskGitInfo({
  branch,
  commitSha,
  commitMessage,
  prUrl,
  repos,
  repoUrl,
  reposJson: reposJsonProp,
}: TaskGitInfoProps) {
  // Parse reposJson if it's a string (can come as JSON string from DB)
  const reposJson = (() => {
    if (!reposJsonProp) return null;
    if (Array.isArray(reposJsonProp)) return reposJsonProp;
    if (typeof reposJsonProp === 'string') {
      try {
        const parsed = JSON.parse(reposJsonProp);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  })();

  // Multi-repo case (git results)
  if (repos && repos.length > 0) {
    return (
      <div className="space-y-4">
        {repos.map((repo, index) => {
          const branchUrl = repo.repo_url && repo.branch
            ? getGitHubBranchUrl(repo.repo_url, repo.branch)
            : null;

          return (
            <div key={index} className="bg-gray-50 dark:bg-dark-hover rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-dark-text mb-3">{repo.repo_path}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
                  <span className="text-gray-600 dark:text-dark-text-secondary">Branch:</span>
                  <code className="bg-gray-200 dark:bg-dark-hover dark:text-dark-text px-2 py-0.5 rounded text-xs">
                    {repo.branch}
                  </code>
                  {branchUrl && (
                    <a
                      href={branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ml-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver branch
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <GitCommit className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
                  <span className="text-gray-600 dark:text-dark-text-secondary">Commit:</span>
                  <code className="bg-gray-200 dark:bg-dark-hover dark:text-dark-text px-2 py-0.5 rounded text-xs">
                    {repo.commit_sha?.substring(0, 7)}
                  </code>
                </div>
                {repo.pr_url && (
                  <a
                    href={repo.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver Pull Request
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Multi-repo case from repos_json (when we have the original repo configs but no git results)
  if (reposJson && reposJson.length > 1) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-500 dark:text-dark-text-secondary mb-2">
          {reposJson.length} repositorios modificados:
        </div>
        {reposJson.map((repo, index) => {
          // Use branch (task.git_branch - the created branch) as priority over repo.branch (base branch)
          const repoBranch = branch || repo.branch || 'main';
          const repoBranchUrl = getGitHubBranchUrl(repo.url, repoBranch);

          return (
            <div key={index} className="bg-gray-50 dark:bg-dark-hover rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-dark-text mb-2">{repo.description || 'Repositorio'}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-dark-text-secondary truncate">
                  <span className="truncate">{repo.url}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
                  <span className="text-gray-600 dark:text-dark-text-secondary">Branch:</span>
                  <code className="bg-gray-200 dark:bg-dark-hover dark:text-dark-text px-2 py-0.5 rounded text-xs">{repoBranch}</code>
                </div>
                {repoBranchUrl && (
                  <a
                    href={repoBranchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver en GitHub
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {/* Show common git info if available */}
        {(commitSha || prUrl) && (
          <div className="border-t dark:border-dark-border pt-4 mt-4">
            {commitSha && (
              <div className="flex items-center gap-2 text-sm">
                <GitCommit className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
                <span className="text-gray-600 dark:text-dark-text-secondary">Commit:</span>
                <code className="bg-gray-100 dark:bg-dark-hover dark:text-dark-text px-2 py-0.5 rounded text-xs">
                  {commitSha.substring(0, 7)}
                </code>
              </div>
            )}
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm mt-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ver Pull Request
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // Single repo case
  if (!branch && !commitSha && !prUrl) {
    return <p className="text-sm text-gray-500 dark:text-dark-text-secondary">No hay informacion de Git</p>;
  }

  // Get repo URL for branch link
  const effectiveRepoUrl = repoUrl || reposJson?.[0]?.url;
  const singleBranchUrl = effectiveRepoUrl && branch
    ? getGitHubBranchUrl(effectiveRepoUrl, branch)
    : null;

  return (
    <div className="space-y-3">
      {branch && (
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
          <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Branch:</span>
          <code className="bg-gray-100 dark:bg-dark-hover dark:text-dark-text px-2 py-0.5 rounded text-xs font-mono">{branch}</code>
          {singleBranchUrl && (
            <a
              href={singleBranchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm ml-2"
            >
              <ExternalLink className="h-3 w-3" />
              Ver en GitHub
            </a>
          )}
        </div>
      )}
      {commitSha && (
        <div className="flex items-center gap-2">
          <GitCommit className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
          <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Commit:</span>
          <code className="bg-gray-100 dark:bg-dark-hover dark:text-dark-text px-2 py-0.5 rounded text-xs">
            {commitSha.substring(0, 7)}
          </code>
        </div>
      )}
      {commitMessage && (
        <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
          <span className="font-medium">Mensaje:</span> {commitMessage}
        </div>
      )}
      {prUrl && (
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
        >
          <ExternalLink className="h-4 w-4" />
          Ver Pull Request
        </a>
      )}
    </div>
  );
}
