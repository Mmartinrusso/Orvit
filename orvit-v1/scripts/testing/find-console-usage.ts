/**
 * Script to find all console.log/warn/error usage in the codebase
 *
 * Usage: npx tsx scripts/find-console-usage.ts [--summary] [--dir <path>]
 *
 * Options:
 *   --summary   Show only summary counts per directory
 *   --dir       Limit search to a specific directory
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.turbo',
  'coverage',
]);

// Files/dirs that are allowed to use console directly
const ALLOWED_PATTERNS = [
  'scripts/',
  'sentry.',
  'instrumentation',
  'next.config',
];

interface Match {
  file: string;
  line: number;
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  allowed: boolean;
}

const CONSOLE_REGEX = /console\.(log|warn|error|info|debug)\s*\(/g;

function isAllowed(filePath: string): boolean {
  const rel = relative(process.cwd(), filePath).replace(/\\/g, '/');
  return ALLOWED_PATTERNS.some((p) => rel.includes(p));
}

function scanFile(filePath: string): Match[] {
  const matches: Match[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const allowed = isAllowed(filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip commented-out lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    let match;
    CONSOLE_REGEX.lastIndex = 0;
    while ((match = CONSOLE_REGEX.exec(line)) !== null) {
      matches.push({
        file: relative(process.cwd(), filePath).replace(/\\/g, '/'),
        line: i + 1,
        type: match[1] as Match['type'],
        text: trimmed.substring(0, 120),
        allowed,
      });
    }
  }

  return matches;
}

function scanDir(dir: string): Match[] {
  const matches: Match[] = [];

  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      matches.push(...scanDir(fullPath));
    } else if (EXTENSIONS.has(extname(entry))) {
      matches.push(...scanFile(fullPath));
    }
  }

  return matches;
}

// Parse CLI args
const args = process.argv.slice(2);
const summaryMode = args.includes('--summary');
const dirIdx = args.indexOf('--dir');
const targetDir = dirIdx >= 0 ? args[dirIdx + 1] : '.';

console.log('Scanning for console.* usage...\n');

const allMatches = scanDir(join(process.cwd(), targetDir));
const actionable = allMatches.filter((m) => !m.allowed);

if (!summaryMode) {
  // Group by file
  const byFile = new Map<string, Match[]>();
  for (const m of actionable) {
    if (!byFile.has(m.file)) byFile.set(m.file, []);
    byFile.get(m.file)!.push(m);
  }

  for (const [file, matches] of byFile) {
    console.log(`\n${file} (${matches.length} occurrences):`);
    for (const m of matches) {
      console.log(`  L${m.line} [${m.type}] ${m.text}`);
    }
  }
}

// Summary
const byDir = new Map<string, { log: number; warn: number; error: number; info: number; debug: number }>();
for (const m of actionable) {
  const dir = m.file.split('/').slice(0, 2).join('/');
  if (!byDir.has(dir)) byDir.set(dir, { log: 0, warn: 0, error: 0, info: 0, debug: 0 });
  byDir.get(dir)![m.type]++;
}

console.log('\n========== SUMMARY ==========');
console.log(`Total: ${allMatches.length} (${actionable.length} actionable, ${allMatches.length - actionable.length} allowed)`);
console.log('\nBy directory:');

const sorted = [...byDir.entries()].sort((a, b) => {
  const totalA = Object.values(a[1]).reduce((s, v) => s + v, 0);
  const totalB = Object.values(b[1]).reduce((s, v) => s + v, 0);
  return totalB - totalA;
});

for (const [dir, counts] of sorted) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  console.log(
    `  ${dir.padEnd(40)} total: ${String(total).padStart(4)}  log: ${String(counts.log).padStart(4)}  error: ${String(counts.error).padStart(4)}  warn: ${String(counts.warn).padStart(4)}`
  );
}

console.log('\nBy type:');
const typeTotal = { log: 0, warn: 0, error: 0, info: 0, debug: 0 };
for (const m of actionable) typeTotal[m.type]++;
for (const [type, count] of Object.entries(typeTotal)) {
  if (count > 0) console.log(`  console.${type}: ${count}`);
}
