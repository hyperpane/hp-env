// Finding a project's .env files: in its folder and a few levels down, not
// in node_modules, build output and the like, and only so many (a huge
// tree stops the search rather than slowing every look).

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isEnvName } from '../shared/index.ts';

const SKIP = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  'coverage',
  '.hyperpane',
  '.idea',
  '.vscode',
]);
const DEPTH = 3;
const MAX_FILES = 60;
const MAX_DIRS = 4000;

/** The .env files under `root`, as paths from it with `/`. */
export async function find(root: string): Promise<string[]> {
  const found: string[] = [];
  let dirs = 0;
  async function walk(dir: string, depth: number) {
    if (found.length >= MAX_FILES || ++dirs > MAX_DIRS) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isFile() && isEnvName(e.name) && found.length < MAX_FILES) found.push(path.relative(root, path.join(dir, e.name)).split(path.sep).join('/'));
    }
    if (depth >= DEPTH) return;
    for (const e of entries) if (e.isDirectory() && !SKIP.has(e.name)) await walk(path.join(dir, e.name), depth + 1);
  }
  await walk(root, 0);
  // The project's own first, then by folder.
  return found.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}
