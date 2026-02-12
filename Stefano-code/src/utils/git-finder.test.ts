import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { findGitRoot, getRelativePathFromGitRoot } from './git-finder.js';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('git-finder', () => {
  let testDir: string;
  let gitDir: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `git-finder-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Create .git directory
    gitDir = join(testDir, '.git');
    mkdirSync(gitDir);
  });

  afterEach(() => {
    // Cleanup
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('findGitRoot', () => {
    it('should find git root from a file in the root directory', async () => {
      const testFile = 'test.txt';
      writeFileSync(join(testDir, testFile), 'test content');

      const result = await findGitRoot(testDir, [testFile]);

      expect(result).toBe(testDir);
    });

    it('should find git root from a nested file', async () => {
      const nestedDir = join(testDir, 'src', 'components');
      mkdirSync(nestedDir, { recursive: true });

      const testFile = 'src/components/Button.tsx';
      writeFileSync(join(testDir, testFile), 'export const Button = () => {}');

      const result = await findGitRoot(testDir, [testFile]);

      expect(result).toBe(testDir);
    });

    it('should return null when no git root is found', async () => {
      // Remove .git directory
      rmSync(gitDir, { recursive: true, force: true });

      const result = await findGitRoot(testDir, ['test.txt']);

      expect(result).toBeNull();
    });

    it('should return null when no files are provided', async () => {
      const result = await findGitRoot(testDir, []);

      expect(result).toBeNull();
    });

    it('should work with absolute file paths', async () => {
      const absolutePath = join(testDir, 'absolute-test.txt');
      writeFileSync(absolutePath, 'test');

      const result = await findGitRoot(testDir, [absolutePath]);

      expect(result).toBe(testDir);
    });
  });

  describe('getRelativePathFromGitRoot', () => {
    it('should return relative path from git root', () => {
      const gitRoot = testDir;
      const filePath = 'src/components/Button.tsx';
      const baseDir = testDir;

      const result = getRelativePathFromGitRoot(gitRoot, filePath, baseDir);

      expect(result).toBe(filePath);
    });

    it('should handle absolute file paths', () => {
      const gitRoot = testDir;
      const absoluteFilePath = join(testDir, 'src', 'test.ts');
      const baseDir = testDir;

      const result = getRelativePathFromGitRoot(gitRoot, absoluteFilePath, baseDir);

      expect(result).toContain('src');
      expect(result).toContain('test.ts');
    });

    it('should handle Windows paths correctly', () => {
      const gitRoot = 'C:\\Users\\test\\project';
      const filePath = 'src/components/Header.tsx';
      const baseDir = 'C:\\Users\\test\\project';

      const result = getRelativePathFromGitRoot(gitRoot, filePath, baseDir);

      expect(result).toBeTruthy();
    });
  });
});
