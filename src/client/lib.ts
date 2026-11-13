// What the Env window's parts share: how values are hidden, the call to the
// server part, why a file needs a look, and making a new file.

import type { useHost } from '@hyperpane/sdk/client';
import type { EnvFile } from '../shared/index.ts';

export const MASK = '••••••••';

export type Call = (req: Record<string, unknown>) => Promise<boolean>;

/** Why a file needs a look: a secrets file git has, or doesn't ignore. */
export function warning(f: EnvFile): string | null {
  if (f.example) return null;
  if (f.tracked) return `${f.path} is committed to git: its secrets are in the repository’s history. Remove it from git (git rm --cached ${f.path}), add it to .gitignore, and change the secrets.`;
  if (f.ignored === false) return `${f.path} isn’t ignored by git: it could be committed. Add it to .gitignore.`;
  return null;
}

export async function newFile(host: ReturnType<typeof useHost>, call: Call, files: EnvFile[]) {
  const example = files.find((f) => f.example && !f.path.includes('/'));
  const name = await host.ui.prompt({
    title: 'New .env file',
    label: example ? `Starts as a copy of ${example.path}.` : 'An empty file in the project’s folder (or a folder in it: apps/web/.env).',
    value: files.some((f) => f.path === '.env') ? '.env.local' : '.env',
  });
  if (!name) return;
  const dir = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
  const from = files.find((f) => f.example && f.path.startsWith(dir) && !f.path.slice(dir.length).includes('/'));
  await call({ op: 'create', file: name.trim(), from: from?.path });
}
