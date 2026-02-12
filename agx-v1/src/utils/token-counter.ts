import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { TokenUsage, AgentTokenUsage } from '../types/index.js';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('token-counter');

interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface JsonlMessage {
  message?: {
    usage?: MessageUsage;
  };
  session_id?: string;
}

function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects');
}

function findSessionFile(sessionId: string): string | null {
  const projectsDir = getClaudeProjectsDir();

  if (!existsSync(projectsDir)) {
    logger.warn({ projectsDir }, 'Claude projects directory not found');
    return null;
  }

  // Search through project directories for the session
  try {
    const projects = readdirSync(projectsDir, { withFileTypes: true });

    for (const project of projects) {
      if (!project.isDirectory()) continue;

      const projectPath = join(projectsDir, project.name);
      const files = readdirSync(projectPath);

      for (const file of files) {
        if (file.endsWith('.jsonl') && file.includes(sessionId)) {
          return join(projectPath, file);
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error searching for session file');
  }

  return null;
}

function parseJsonlFile(filePath: string): JsonlMessage[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const messages: JsonlMessage[] = [];
    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // Skip invalid JSON lines
      }
    }

    return messages;
  } catch (error) {
    logger.error({ error, filePath }, 'Error reading JSONL file');
    return [];
  }
}

function sumTokensFromMessages(messages: JsonlMessage[]): AgentTokenUsage {
  let input = 0;
  let output = 0;

  for (const msg of messages) {
    if (msg.message?.usage) {
      const usage = msg.message.usage;
      input += (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
      output += usage.output_tokens || 0;
    }
  }

  return { input, output };
}

export function getTokenUsageForSession(sessionId: string): AgentTokenUsage {
  if (!sessionId) {
    return { input: 0, output: 0 };
  }

  const filePath = findSessionFile(sessionId);

  if (!filePath) {
    logger.debug({ sessionId }, 'Session file not found, returning zero tokens');
    return { input: 0, output: 0 };
  }

  const messages = parseJsonlFile(filePath);
  return sumTokensFromMessages(messages);
}

export function getTokenUsageForSessions(
  sessionIds: Record<string, string>
): TokenUsage {
  const byAgent: Record<string, AgentTokenUsage> = {};
  let totalInput = 0;
  let totalOutput = 0;

  for (const [agentName, sessionId] of Object.entries(sessionIds)) {
    const usage = getTokenUsageForSession(sessionId);
    byAgent[agentName] = usage;
    totalInput += usage.input;
    totalOutput += usage.output;
  }

  return {
    total_input: totalInput,
    total_output: totalOutput,
    total: totalInput + totalOutput,
    by_agent: byAgent,
  };
}
