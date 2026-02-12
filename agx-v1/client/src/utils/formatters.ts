import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: es });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatTokens(tokens: number | null | undefined): string {
  // Handle null, undefined, or 0 tokens
  if (!tokens || tokens === 0) return '0';
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

export function formatNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1_000_000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1_000_000).toFixed(2)}M`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate GitHub URL for a specific branch from a repo URL
 * Supports both HTTPS and SSH git URLs
 */
export function getGitHubBranchUrl(repoUrl: string, branch: string): string | null {
  if (!repoUrl || !branch) return null;

  let baseUrl = repoUrl;

  // Convert SSH URL to HTTPS
  // git@github.com:user/repo.git -> https://github.com/user/repo
  if (baseUrl.startsWith('git@')) {
    baseUrl = baseUrl
      .replace('git@', 'https://')
      .replace(':', '/')
      .replace(/\.git$/, '');
  }

  // Remove .git suffix if present
  baseUrl = baseUrl.replace(/\.git$/, '');

  // Ensure it's a valid GitHub URL
  if (!baseUrl.includes('github.com')) {
    return null;
  }

  return `${baseUrl}/tree/${encodeURIComponent(branch)}`;
}

/**
 * Claude API pricing per million tokens (as of January 2026)
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 */
export const CLAUDE_PRICING = {
  haiku: {
    input: 1.00,   // $1.00 per million input tokens
    output: 5.00,  // $5.00 per million output tokens
  },
  sonnet: {
    input: 3.00,   // $3.00 per million input tokens
    output: 15.00, // $15.00 per million output tokens
  },
  opus: {
    input: 5.00,  // $15.00 per million input tokens (Opus 4)
    output: 25.00, // $75.00 per million output tokens (Opus 4)
  },
} as const;

export type ModelType = keyof typeof CLAUDE_PRICING;

/**
 * Calculate the estimated cost of a task based on token usage and model
 */
export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const modelKey = model.toLowerCase() as ModelType;
  const pricing = CLAUDE_PRICING[modelKey] || CLAUDE_PRICING.sonnet;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Format a cost value as USD currency
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}
