import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, GitBranch, Coins, ExternalLink, DollarSign, FolderGit2, RotateCcw } from 'lucide-react';
import type { TaskRecord } from '@/api';
import { Card, Badge, Button } from '@/components/common';
import { TaskStatusBadge } from './TaskStatusBadge';
import { formatRelativeTime, formatTokens, truncateText, getGitHubBranchUrl, calculateTokenCost, formatCost } from '@/utils';

interface TaskCardProps {
  task: TaskRecord;
  onContinue?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
}

export function TaskCard({ task, onContinue, onRetry }: TaskCardProps) {
  const navigate = useNavigate();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleClick = () => {
    navigate(`/tasks/${task.task_id}`);
  };

  const handleContinue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onContinue) {
      onContinue(task.task_id);
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRetry && !isRetrying) {
      setIsRetrying(true);
      try {
        await onRetry(task.task_id);
      } catch (error) {
        console.error('Error retrying task:', error);
        setIsRetrying(false);
      }
      // Note: we don't set isRetrying to false here because
      // the user will be navigated away after successful retry
    }
  };

  const handleOpenGitHub = (e: React.MouseEvent, repoUrl: string, branch: string) => {
    e.stopPropagation();
    const branchUrl = getGitHubBranchUrl(repoUrl, branch);
    if (branchUrl) {
      window.open(branchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Parse repos_json if it's a string (can come as JSON string from DB)
  const reposJson = (() => {
    if (!task.repos_json) return null;
    if (Array.isArray(task.repos_json)) return task.repos_json;
    if (typeof task.repos_json === 'string') {
      try {
        const parsed = JSON.parse(task.repos_json);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  })();

  // Check if multi-repo
  const isMultiRepo = reposJson && reposJson.length > 1;

  // Get all repos with their GitHub links
  // Use task.git_branch (the branch created by the task) as priority over repo.branch (the base branch)
  const reposWithLinks = isMultiRepo
    ? reposJson!.map(repo => ({
        url: repo.url,
        description: repo.description,
        branch: task.git_branch || repo.branch || 'main',
        branchUrl: getGitHubBranchUrl(repo.url, task.git_branch || repo.branch || 'main'),
      }))
    : [];

  // Single repo case
  const singleRepoUrl = !isMultiRepo ? (task.repo_url || reposJson?.[0]?.url) : null;
  const canOpenSingleGitHub = singleRepoUrl && task.git_branch && getGitHubBranchUrl(singleRepoUrl, task.git_branch);

  // Calculate estimated cost
  const estimatedCost = calculateTokenCost(
    task.total_input_tokens,
    task.total_output_tokens,
    task.model
  );

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
    >
      <div onClick={handleClick}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-4">
            <p className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">
              {truncateText(task.input_prompt, 100)}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-dark-text-secondary">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(task.created_at)}
              </span>
              <Badge variant="neutral">{task.model}</Badge>
            </div>
          </div>
          <TaskStatusBadge success={task.success} stageFailed={task.stage_failed} />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-dark-text-secondary">
          {task.git_branch && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {task.git_branch}
            </span>
          )}
          {isMultiRepo && (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <FolderGit2 className="h-3 w-3" />
              {reposJson!.length} repos
            </span>
          )}
          <span className="flex items-center gap-1">
            <Coins className="h-3 w-3" />
            {formatTokens(task.total_tokens)} tokens
          </span>
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <DollarSign className="h-3 w-3" />
            {formatCost(estimatedCost)}
          </span>
        </div>

        {/* Multi-repo list */}
        {isMultiRepo && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-border">
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">Repositorios:</p>
            <div className="space-y-1">
              {reposWithLinks.map((repo, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-dark-text truncate flex-1" title={repo.url}>
                    {repo.description || repo.url.split('/').slice(-1)[0]}
                  </span>
                  {repo.branchUrl && (
                    <button
                      onClick={(e) => handleOpenGitHub(e, repo.url, repo.branch)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 ml-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(onContinue || onRetry || canOpenSingleGitHub) && !isMultiRepo && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-border flex gap-2">
          {canOpenSingleGitHub && (
            <Button size="sm" variant="secondary" onClick={(e) => handleOpenGitHub(e, singleRepoUrl!, task.git_branch!)}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver en GitHub
            </Button>
          )}
          {onContinue && task.success && (
            <Button size="sm" variant="secondary" onClick={handleContinue}>
              Continuar
            </Button>
          )}
          {onRetry && !task.success && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleRetry}
              disabled={isRetrying}
              loading={isRetrying}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {isRetrying ? 'Reintentando...' : 'Reintentar'}
            </Button>
          )}
        </div>
      )}

      {isMultiRepo && (onContinue || onRetry) && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-border flex gap-2">
          {onContinue && task.success && (
            <Button size="sm" variant="secondary" onClick={handleContinue}>
              Continuar
            </Button>
          )}
          {onRetry && !task.success && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleRetry}
              disabled={isRetrying}
              loading={isRetrying}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {isRetrying ? 'Reintentando...' : 'Reintentar'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
