// What git says about a project's .env files: which are committed (a
// secret in history) and which it ignores. Each answer is null when there's
// no repository, or no git, or it took too long.

import type { Host } from '@hyperpane/sdk/server';

export type GitState = { tracked: boolean | null; ignored: boolean | null };

/** Which files git has committed, and which it ignores (null each when
 * there's no repository or no git). */
export async function gitState(host: Host, root: string, paths: string[]): Promise<Map<string, GitState>> {
  const out = new Map<string, GitState>(paths.map((p) => [p, { tracked: null, ignored: null }]));
  if (!paths.length) return out;
  const tracked = await gitLines(host, root, ['ls-files', '-z', '--', ...paths]);
  // check-ignore takes -z only with --stdin: one path a line (.env names have no line breaks).
  const ignored = await gitLines(host, root, ['check-ignore', '--no-index', '--', ...paths], '\n');
  for (const p of paths) {
    out.set(p, { tracked: tracked ? tracked.has(p) : null, ignored: ignored ? ignored.has(p) : null });
  }
  return out;
}

/** git's NUL-separated answer, or null when git can't say. */
function gitLines(host: Host, root: string, args: string[], sep = '\0'): Promise<Set<string> | null> {
  return new Promise((resolve) => {
    let out = '';
    let child: ReturnType<Host['spawn']>;
    try {
      child = host.spawn('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => child.kill(), 5000);
    child.stdout?.on('data', (d: Buffer) => (out += d.toString('utf8')));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    // ls-files: 0; check-ignore: 0 (some ignored) or 1 (none); 128: no repository.
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(
        code === 0 || code === 1
          ? new Set(
              out
                .split(sep)
                .map((l) => l.replace(/\r$/, ''))
                .filter(Boolean),
            )
          : null,
      );
    });
  });
}
