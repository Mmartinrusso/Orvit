import { existsSync, statSync } from 'fs';
import { join, dirname, resolve, isAbsolute, parse } from 'path';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('git-finder');

/**
 * Find the git root directory by navigating up from a given path
 */
function findGitRootFromPath(startPath: string): string | null {
  let currentPath = resolve(startPath);

  // Get the root properly for both Windows (C:\) and Unix (/)
  const parsedPath = parse(currentPath);
  const root = parsedPath.root;

  // Limit iterations to prevent infinite loops
  let iterations = 0;
  const maxIterations = 50;

  while (iterations < maxIterations) {
    const gitPath = join(currentPath, '.git');

    if (existsSync(gitPath)) {
      // Check if it's a directory (normal git repo) or file (git worktree/submodule)
      const stat = statSync(gitPath);
      if (stat.isDirectory() || stat.isFile()) {
        logger.debug({ gitRoot: currentPath, startPath }, 'Found git root');
        return currentPath;
      }
    }

    // Move up one directory
    const parentPath = dirname(currentPath);

    // Stop if we've reached the root or can't go up anymore
    if (parentPath === currentPath || currentPath === root) {
      break;
    }

    currentPath = parentPath;
    iterations++;
  }

  logger.debug({ startPath, iterations }, 'No git root found');
  return null;
}

/**
 * Find the git root directory for modified files.
 * Navigates up from the first modified file to find the nearest .git folder.
 *
 * @param baseDir - The base directory (TARGET_REPO)
 * @param modifiedFiles - List of modified file paths (relative to baseDir)
 * @returns The git root directory or null if not found
 */
export async function findGitRoot(
  baseDir: string,
  modifiedFiles: string[]
): Promise<string | null> {
  if (modifiedFiles.length === 0) {
    logger.warn('No modified files provided, cannot determine git root');
    return null;
  }

  // Get the first modified file to start searching from
  const firstFile = modifiedFiles[0];

  // Resolve the full path
  const fullPath = isAbsolute(firstFile)
    ? firstFile
    : join(resolve(baseDir), firstFile);

  // Start from the file's directory
  const startDir = dirname(fullPath);

  logger.debug({ startDir, firstFile }, 'Searching for git root');

  const gitRoot = findGitRootFromPath(startDir);

  if (gitRoot) {
    logger.info({ gitRoot, startedFrom: startDir }, 'Found git root');
  } else {
    logger.warn({ startDir }, 'No git root found');
  }

  return gitRoot;
}

/**
 * Get the relative path from git root to a file
 */
export function getRelativePathFromGitRoot(
  gitRoot: string,
  filePath: string,
  baseDir: string
): string {
  const absoluteFilePath = isAbsolute(filePath)
    ? filePath
    : join(resolve(baseDir), filePath);

  const relativePath = absoluteFilePath.replace(gitRoot + '/', '');
  return relativePath;
}
