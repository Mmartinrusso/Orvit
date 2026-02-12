import { Coins, ArrowDownToLine, ArrowUpFromLine, DollarSign } from 'lucide-react';
import type { TokenUsage } from '@/api';
import { formatTokens, calculateTokenCost, formatCost, CLAUDE_PRICING } from '@/utils';

interface TaskTokenUsageProps {
  tokenUsage?: TokenUsage | null;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export function TaskTokenUsage({
  tokenUsage,
  totalTokens,
  inputTokens,
  outputTokens,
  model = 'sonnet',
}: TaskTokenUsageProps) {
  const total = tokenUsage?.total ?? totalTokens ?? 0;
  const input = tokenUsage?.total_input ?? inputTokens ?? 0;
  const output = tokenUsage?.total_output ?? outputTokens ?? 0;
  const byAgent = tokenUsage?.by_agent;

  // Calculate costs
  const estimatedCost = calculateTokenCost(input, output, model);
  const modelKey = model.toLowerCase() as keyof typeof CLAUDE_PRICING;
  const pricing = CLAUDE_PRICING[modelKey] || CLAUDE_PRICING.sonnet;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 dark:text-dark-text-secondary text-xs mb-1">
            <Coins className="h-3 w-3" />
            Total
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-dark-text">{formatTokens(total)}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs mb-1">
            <ArrowDownToLine className="h-3 w-3" />
            Input
          </div>
          <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">{formatTokens(input)}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs mb-1">
            <ArrowUpFromLine className="h-3 w-3" />
            Output
          </div>
          <div className="text-lg font-semibold text-green-700 dark:text-green-300">{formatTokens(output)}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-xs mb-1">
            <DollarSign className="h-3 w-3" />
            Costo estimado
          </div>
          <div className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">{formatCost(estimatedCost)}</div>
        </div>
      </div>

      {/* Pricing info */}
      <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3 mb-4">
        <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-1">
          Precios {model} (por millon de tokens)
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-blue-600 dark:text-blue-400">Input: ${pricing.input.toFixed(2)}</span>
          <span className="text-green-600 dark:text-green-400">Output: ${pricing.output.toFixed(2)}</span>
        </div>
      </div>

      {byAgent && Object.keys(byAgent).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">Por agente</h4>
          <div className="space-y-2">
            {Object.entries(byAgent).map(([agent, usage]) => {
              const agentCost = calculateTokenCost(usage.input, usage.output, model);
              return (
                <div key={agent} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-dark-text-secondary capitalize">{agent}</span>
                  <div className="flex items-center gap-4 text-gray-500 dark:text-dark-text-secondary">
                    <span>In: {formatTokens(usage.input)}</span>
                    <span>Out: {formatTokens(usage.output)}</span>
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">{formatCost(agentCost)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
