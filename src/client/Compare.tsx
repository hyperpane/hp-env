// Compare: every variable in every file, in one table, the ones that differ
// marked, and a click on a missing one to add it there.

import { useMemo } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { cn } from '@hyperpane/ui';
import type { EnvFile } from '../shared/index.ts';
import { type Call, MASK } from './lib.ts';

/** Every variable (rows) in every file (columns): set, empty, or missing. */
export function Compare({ files, reveal, call }: { files: EnvFile[]; reveal: boolean; call: Call }) {
  const host = useHost();
  const shownFiles = files.filter((f) => !f.tooBig);
  const keys = useMemo(() => [...new Set(shownFiles.flatMap((f) => f.entries.map((e) => e.key)))].sort(), [shownFiles]);
  const value = (f: EnvFile, key: string) => f.entries.filter((e) => e.key === key).at(-1)?.value;
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="sticky top-0 bg-[var(--node-bg)]">
          <th className="border-b border-[var(--node-border)] px-2 py-1 text-left font-medium">Variable</th>
          {shownFiles.map((f) => (
            <th key={f.path} className={cn('border-b border-[var(--node-border)] px-2 py-1 text-left font-medium', f.example && 'italic')}>
              {f.path}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const values = shownFiles.map((f) => value(f, key));
          const differ = new Set(values.filter((x) => x !== undefined)).size > 1;
          return (
            <tr key={key} className="hover:bg-[var(--node-hover)]">
              <td className="border-b border-[var(--node-border)] px-2 py-1 font-mono">
                {key}
                {differ && (
                  <span className="ml-1 text-[var(--node-muted)]" title="Not the same in every file">
                    ≠
                  </span>
                )}
              </td>
              {shownFiles.map((f, i) => {
                const val = values[i];
                return (
                  <td key={f.path} className="max-w-48 truncate border-b border-[var(--node-border)] px-2 py-1 font-mono">
                    {val === undefined ? (
                      <button
                        type="button"
                        className="text-[var(--ansi-1)] hover:underline"
                        title={`Not in ${f.path}: add it`}
                        onClick={async () => {
                          const v = await host.ui.prompt({ title: `${key} in ${f.path}`, label: 'Its value', value: f.example ? '' : (values.find((x) => x !== undefined) ?? '') });
                          if (v !== null) void call({ op: 'set', file: f.path, version: f.version, key, value: v });
                        }}
                      >
                        missing
                      </button>
                    ) : val === '' ? (
                      <span className="text-[var(--node-muted)] italic">empty</span>
                    ) : reveal || f.example ? (
                      val
                    ) : (
                      <span className="text-[var(--node-muted)]">{MASK}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
