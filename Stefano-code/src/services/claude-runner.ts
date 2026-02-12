import { spawn, execSync } from 'child_process';
import type { ClaudeRunOptions, ClaudeRunResult } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('claude-runner');

/**
 * Validate that Claude CLI is installed and accessible
 */
export async function validateClaudeCLI(): Promise<boolean> {
  try {
    const version = execSync('claude --version', { encoding: 'utf-8', timeout: 10000 }).trim();
    logger.info({ version }, 'Claude CLI found');
    return true;
  } catch {
    logger.error('Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code');
    return false;
  }
}

/**
 * Helper function to sleep for a given time
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
export async function runClaudeWithRetry(
  options: ClaudeRunOptions,
  maxRetries: number = 2
): Promise<ClaudeRunResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.info({ attempt, maxRetries }, 'Attempting Claude CLI execution');
      const result = await runClaude(options);

      if (attempt > 0) {
        logger.info({ attempt }, 'Claude CLI succeeded after retry');
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Cap at 10s
        logger.warn(
          { attempt, maxRetries, backoffMs, error: lastError.message },
          'Claude CLI failed, retrying with exponential backoff'
        );
        await sleep(backoffMs);
      } else {
        logger.error(
          { attempt, maxRetries, error: lastError.message },
          'Claude CLI failed after all retries'
        );
      }
    }
  }

  throw lastError || new Error('Claude CLI failed after all retries');
}

export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const {
    prompt,
    cwd,
    allowedTools,
    systemPrompt,
    model,
    maxTurns,
    sessionId,
  } = options;

  // Always use stdin to pipe the prompt - avoids Windows shell escaping issues
  // with special characters (parentheses, slashes, quotes, newlines, etc.)
  const useStdin = true;

  const args: string[] = [
    '-p', '-',  // Print mode, read prompt from stdin
    '--output-format', 'json',
    '--permission-mode', 'bypassPermissions',  // Auto-approve all commands
  ];

  if (allowedTools.length > 0) {
    args.push('--allowedTools', allowedTools.join(','));
  }

  if (systemPrompt) {
    args.push('--append-system-prompt', systemPrompt);
  }

  if (model) {
    args.push('--model', model);
  }

  if (maxTurns) {
    args.push('--max-turns', maxTurns.toString());
  }

  if (sessionId) {
    args.push('--resume', sessionId);
  }

  logger.debug({ args, cwd, useStdin, promptLength: prompt.length }, 'Spawning claude CLI');

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd,
      stdio: [useStdin ? 'pipe' : 'inherit', 'pipe', 'pipe'],
      shell: true,  // Required for Windows to find claude in PATH
      env: {
        ...process.env,  // Inherit all environment variables
        HOME: process.env.HOME,  // Ensure HOME is set for Claude config
      },
    });

    // If using stdin, write the prompt and close stdin
    if (useStdin && child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      logger.error({ error }, 'Failed to spawn claude CLI');
      reject(new Error(`Failed to spawn claude: ${error.message}`));
    });

    child.on('close', (code) => {

      logger.debug({ code, stdoutLength: stdout.length, stderrLength: stderr.length }, 'Claude CLI exited');

      // Try to parse stdout even if exit code is non-zero
      // Claude may return valid JSON with error info
      if (stdout.length > 0) {
        try {
          const parsed = JSON.parse(stdout);

          // Log the full structure for debugging
          logger.debug({
            parsedKeys: Object.keys(parsed),
            hasResult: 'result' in parsed,
            resultType: typeof parsed.result,
            resultLength: parsed.result?.length,
            hasSessionId: 'session_id' in parsed,
            subtype: parsed.subtype,
            numTurns: parsed.num_turns,
            fullResponse: JSON.stringify(parsed).substring(0, 1500)
          }, 'Parsed Claude response');

          // Check if it's an error response from Claude
          if (parsed.error) {
            logger.error({ code, error: parsed.error, type: parsed.type }, 'Claude returned error');
            reject(new Error(`Claude error: ${parsed.error}`));
            return;
          }

          // Check for is_error flag FIRST (Claude CLI error format)
          // This handles error_during_execution and other error subtypes
          if (parsed.is_error === true) {
            const errorMsg = parsed.errors?.join(', ') || parsed.result || 'Unknown Claude error';
            logger.error({ code, result: errorMsg, subtype: parsed.subtype, errors: parsed.errors }, 'Claude CLI reported error');
            reject(new Error(`Claude error (${parsed.subtype || 'unknown'}): ${errorMsg}`));
            return;
          }

          // Check for max turns error - Claude didn't finish
          if (parsed.subtype === 'error_max_turns') {
            logger.error({
              numTurns: parsed.num_turns,
              sessionId: parsed.session_id
            }, 'Claude reached max turns without completing');
            reject(new Error(`Claude reached max turns (${parsed.num_turns}) without completing. Session: ${parsed.session_id}`));
            return;
          }

          // Detect rate limit responses (Claude returns subtype=success but the result is a rate limit message)
          const resultText = typeof parsed.result === 'string' ? parsed.result : '';
          if (resultText.includes("hit your limit") || resultText.includes("rate limit") || resultText.includes("resets ")) {
            logger.error({ result: resultText, sessionId: parsed.session_id }, 'Claude CLI rate limit detected');
            reject(new Error(`Claude rate limit: ${resultText.substring(0, 200)}`));
            return;
          }

          // Success case - we have a valid result
          if ('result' in parsed && parsed.result !== undefined) {
            logger.debug({ resultLength: parsed.result?.length, resultPreview: parsed.result?.substring(0, 300) }, 'Claude returned result');
            resolve({
              success: true,
              result: parsed.result ?? '',
              sessionId: parsed.session_id || '',
            });
            return;
          }

          // Has session_id but no result - only accept if NOT an error
          if (parsed.session_id && parsed.type === 'result' && parsed.subtype === 'success') {
            logger.warn({ parsed }, 'Claude returned session but no result text');
            resolve({
              success: true,
              result: '',
              sessionId: parsed.session_id,
            });
            return;
          }

          // Unknown JSON structure
          logger.warn({ parsed, code }, 'Unknown Claude response structure');
          reject(new Error(`Unknown Claude response: ${JSON.stringify(parsed).substring(0, 200)}`));
          return;
        } catch (e) {
          // JSON parse failed - Claude might have returned raw text
          logger.warn({ stdout: stdout.substring(0, 500), error: e }, 'Could not parse JSON from stdout, returning raw text');

          // If exit code is 0, return the raw stdout as the result
          // This allows callers to process non-JSON responses (like markdown analysis)
          if (code === 0) {
            resolve({
              success: true,
              result: stdout,
              sessionId: '',
            });
            return;
          }
        }
      }

      // No valid JSON parsed and non-zero exit code - report error
      if (code !== 0) {
        const errorMsg = stderr || stdout || 'Unknown error';
        logger.error({ code, stderr, stdout: stdout.substring(0, 500) }, 'Claude CLI exited with error');
        reject(new Error(`Claude exited with code ${code}: ${errorMsg.substring(0, 500)}`));
      } else {
        // code is 0 but no stdout - this shouldn't happen often
        reject(new Error('Claude returned empty response'));
      }
    });
  });
}

// Helper function to try to repair truncated JSON
function tryRepairJson(jsonStr: string): string | null {
  let str = jsonStr.trim();

  // Count open/close braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of str) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') openBraces++;
    else if (char === '}') openBraces--;
    else if (char === '[') openBrackets++;
    else if (char === ']') openBrackets--;
  }

  // If we're missing closing brackets/braces, try to add them
  if (openBraces > 0 || openBrackets > 0) {
    // Close any unclosed brackets first, then braces
    for (let i = 0; i < openBrackets; i++) str += ']';
    for (let i = 0; i < openBraces; i++) str += '}';

    try {
      JSON.parse(str);
      return str;
    } catch {
      // Repair didn't work
      return null;
    }
  }

  return null;
}

export function parseJsonFromResult<T>(result: string): T {
  // Try to extract JSON from the result string
  // Claude might return text with JSON embedded in it

  logger.debug({ resultLength: result.length, resultPreview: result.substring(0, 500) }, 'Parsing JSON from result');

  // First, try direct parse
  try {
    return JSON.parse(result);
  } catch {
    // Try to repair truncated JSON as second attempt
    const repaired = tryRepairJson(result);
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired);
        logger.debug('Parsed JSON after repair');
        return parsed;
      } catch {
        // Continue to other methods
      }
    }
  }

  // Try to find JSON in a ```json code block first (most reliable)
  const jsonCodeBlockMatch = result.match(/```json\s*([\s\S]*?)```/);
  if (jsonCodeBlockMatch) {
    const content = jsonCodeBlockMatch[1].trim();
    try {
      const parsed = JSON.parse(content);
      logger.debug('Extracted JSON from ```json code block');
      return parsed;
    } catch {
      // Try to repair truncated JSON from code block
      const repaired = tryRepairJson(content);
      if (repaired) {
        try {
          const parsed = JSON.parse(repaired);
          logger.debug('Extracted JSON from ```json code block (repaired)');
          return parsed;
        } catch {
          // Continue to other methods
        }
      }
    }
  }

  // Try to find JSON in any code block (including unclosed ones)
  // Match from ```json or ``` to either ``` or end of string
  const codeBlockMatches = result.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/g);
  if (codeBlockMatches) {
    for (const block of codeBlockMatches) {
      const content = block.replace(/```(?:json|javascript)?\s*/g, '').replace(/```/g, '').trim();
      if (!content.startsWith('{') && !content.startsWith('[')) continue;

      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          // Check if it has expected fields
          if ('paths' in parsed || 'plan' in parsed || 'changes' in parsed ||
              'bugs' in parsed || 'passed' in parsed || 'fixed' in parsed ||
              'branch' in parsed || 'opportunities' in parsed) {
            logger.debug({ extractedJson: content.substring(0, 200) }, 'Extracted JSON from code block');
            return parsed;
          }
        }
      } catch {
        // Try to repair
        const repaired = tryRepairJson(content);
        if (repaired) {
          try {
            const parsed = JSON.parse(repaired);
            if (parsed && typeof parsed === 'object') {
              if ('paths' in parsed || 'plan' in parsed || 'changes' in parsed ||
                  'bugs' in parsed || 'passed' in parsed || 'fixed' in parsed ||
                  'branch' in parsed || 'opportunities' in parsed) {
                logger.debug({ extractedJson: repaired.substring(0, 200) }, 'Extracted JSON from code block (repaired)');
                return parsed;
              }
            }
          } catch {
            // Continue
          }
        }
      }
    }
  }

  // Try to find the start of a JSON object with expected fields and extract it
  const jsonStartMatch = result.match(/\{\s*"(?:paths|plan|changes|bugs|passed|fixed|branch|opportunities|summary)"/);
  if (jsonStartMatch && jsonStartMatch.index !== undefined) {
    const jsonStart = result.substring(jsonStartMatch.index);
    // Try to parse progressively longer substrings
    for (let endPos = jsonStart.length; endPos > 50; endPos--) {
      const candidate = jsonStart.substring(0, endPos);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') {
          logger.debug({ extractedJson: candidate.substring(0, 200) }, 'Extracted JSON by finding expected field start');
          return parsed;
        }
      } catch {
        // Try repair
        const repaired = tryRepairJson(candidate);
        if (repaired) {
          try {
            const parsed = JSON.parse(repaired);
            if (parsed && typeof parsed === 'object' &&
                ('paths' in parsed || 'plan' in parsed || 'changes' in parsed ||
                 'bugs' in parsed || 'passed' in parsed || 'fixed' in parsed ||
                 'branch' in parsed || 'opportunities' in parsed)) {
              logger.debug({ extractedJson: repaired.substring(0, 200) }, 'Extracted JSON by finding expected field start (repaired)');
              return parsed;
            }
          } catch {
            // Continue trying shorter
          }
        }
      }
    }
  }

  // Try to find all JSON objects in the text and pick the one with expected fields
  const jsonMatches = result.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  if (jsonMatches) {
    // Sort by length (longer = more complete) and try each
    const sortedMatches = jsonMatches.sort((a, b) => b.length - a.length);
    for (const match of sortedMatches) {
      try {
        const parsed = JSON.parse(match);
        // Check if it looks like our expected output (has paths, plan, changes, bugs, opportunities, etc)
        if (parsed && typeof parsed === 'object' &&
            ('paths' in parsed || 'plan' in parsed || 'changes' in parsed ||
             'bugs' in parsed || 'passed' in parsed || 'fixed' in parsed ||
             'branch' in parsed || 'opportunities' in parsed)) {
          logger.debug({ extractedJson: match.substring(0, 200) }, 'Extracted JSON object with expected fields');
          return parsed;
        }
      } catch {
        // Continue to next match
      }
    }

    // If no match with expected fields, try the longest valid JSON
    for (const match of sortedMatches) {
      try {
        const parsed = JSON.parse(match);
        if (parsed && typeof parsed === 'object') {
          logger.debug({ extractedJson: match.substring(0, 200) }, 'Extracted longest valid JSON object');
          return parsed;
        }
      } catch {
        // Continue to next match
      }
    }
  }

  // Try to find JSON array
  const arrayMatch = result.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // Continue to error
    }
  }

  logger.error({ result: result.substring(0, 800) }, 'Could not parse JSON from result');
  throw new Error(`Could not parse JSON from result: ${result.substring(0, 300)}...`);
}

/**
 * Run Claude and ensure the result is valid JSON.
 * If Claude returns markdown/text, a second "formatting" call converts it to JSON.
 * This is the recommended function for all pipeline agents.
 */
export async function runClaudeAndParseJson<T>(
  options: ClaudeRunOptions,
  jsonSchema: string, // Description of expected JSON format
  expectedLanguage: 'es' | 'en' = 'es'
): Promise<{ parsed: T; sessionId: string }> {
  const result = await runClaude(options);

  // Try to parse JSON directly
  try {
    const parsed = parseJsonFromResult<T>(result.result);
    return { parsed, sessionId: result.sessionId };
  } catch (parseError) {
    // Phase 2: Format the response as JSON
    logger.info({
      originalLength: result.result.length,
      resultPreview: result.result.substring(0, 200),
    }, 'Agent returned non-JSON, running formatting phase');

    // Truncate to avoid context issues
    const maxLen = 12000;
    const truncated = result.result.length > maxLen
      ? result.result.substring(0, maxLen) + '\n\n[... truncated ...]'
      : result.result;

    const formattingPrompt = expectedLanguage === 'es'
      ? `Basándote en el siguiente análisis, convierte la información a JSON.

ANÁLISIS:
${truncated}

FORMATO JSON REQUERIDO:
${jsonSchema}

REGLAS:
- Responde ÚNICAMENTE con JSON válido, sin texto antes o después
- NO uses markdown ni bloques de código
- Todos los textos en ESPAÑOL

Tu respuesta JSON:`
      : `Based on the following analysis, convert the information to JSON.

ANALYSIS:
${truncated}

REQUIRED JSON FORMAT:
${jsonSchema}

RULES:
- Respond ONLY with valid JSON, no text before or after
- DO NOT use markdown or code blocks
- All text in ENGLISH

Your JSON response:`;

    try {
      const formatResult = await runClaude({
        prompt: formattingPrompt,
        cwd: options.cwd,
        allowedTools: [],
        model: 'sonnet',
        maxTurns: 1,
      });

      const parsed = parseJsonFromResult<T>(formatResult.result);
      logger.info('Phase 2 formatting successful');
      return { parsed, sessionId: result.sessionId };
    } catch (formatError) {
      // If formatting also fails, throw the original error
      logger.error({ formatError }, 'Phase 2 formatting also failed');
      throw parseError;
    }
  }
}
