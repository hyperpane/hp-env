// Compare: every variable in every file, in one table, the ones that differ
// marked, and a click on a missing one to add it there. Each column is as
// wide as it was dragged (kept on this machine, a file's by its path); what's
// left over stays empty at the end.

import { useMemo } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { Chip, ColumnResizer, cn, styles, useColumnWidths } from '@hyperpane/ui';
import type { EnvFile } from '../shared/index.ts';
import { type Call, MASK } from './lib.ts';

/** The first widths: the variables', and each file's. */
const VARIABLE = 220;
const FILE = 192;

/** Every variable (rows) in every file (columns): set, empty, or missing. */
export function Compare({ files, reveal, call }: { files: EnvFile[]; reveal: boolean; call: Call }) {
  const host = useHost();
  const shownFiles = files.filter((f) => !f.tooBig);
  // What counts: the variables that are on (a commented-out one isn't there).
  const keys = useMemo(() => [...new Set(shownFiles.flatMap((f) => f.entries.filter((e) => !e.disabled).map((e) => e.key)))].sort(), [shownFiles]);
  const value = (f: EnvFile, key: string) => f.entries.filter((e) => e.key === key && !e.disabled).at(-1)?.value;
  // `variable` is the first column; every other key is a file's path.
  const cols = useColumnWidths<string>(
    'env.compare',
    { variable: VARIABLE, ...Object.fromEntries(shownFiles.map((f) => [f.path, FILE])) },
    { min: 48, max: 800 },
  );
  // A file opened since: as wide as a file's column starts.
  const width = (k: string) => cols.widths[k] ?? (k === 'variable' ? VARIABLE : FILE);
  const resizer = (k: string) => (
    <ColumnResizer width={width(k)} onResize={(w) => cols.set(k, w)} onReset={() => cols.set(k, k === 'variable' ? VARIABLE : FILE)} />
  );
  return (
    <table className="w-full table-fixed border-collapse text-[13px]">
      <colgroup>
        <col style={{ width: width('variable') }} />
        {shownFiles.map((f) => (
          <col key={f.path} style={{ width: width(f.path) }} />
        ))}
        <col />
      </colgroup>
      <thead className={cn(styles.stickyTableHead, 'bg-[var(--node-bg)]')}>
        <tr>
          <th className="relative h-8 truncate border-b border-[var(--hairline)] px-3 text-left text-xs font-medium text-[var(--node-muted)]">
            Variable
            {resizer('variable')}
          </th>
          {shownFiles.map((f) => (
            <th
              key={f.path}
              className={cn(
                'relative h-8 truncate border-b border-[var(--hairline)] px-3 text-left font-mono text-xs font-medium text-[var(--node-muted)]',
                f.example && 'italic',
              )}
              title={f.path}
            >
              {f.path}
              {resizer(f.path)}
            </th>
          ))}
          <th className="border-b border-[var(--hairline)]" />
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const values = shownFiles.map((f) => value(f, key));
          const differ = new Set(values.filter((x) => x !== undefined)).size > 1;
          return (
            <tr key={key} className="transition-colors duration-100 hover:bg-[var(--node-hover)]">
              <td className="h-8 truncate px-3 font-mono text-xs touch:h-11" title={key}>
                {key}
                {differ && (
                  <Chip color="amber" className="ms-2 font-sans" title="Not the same in every file">
                    ≠
                  </Chip>
                )}
              </td>
              {shownFiles.map((f, i) => {
                const val = values[i];
                return (
                  <td key={f.path} className="h-8 truncate px-3 font-mono text-xs touch:h-11">
                    {val === undefined ? (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex h-5 rounded-full items-center bg-[color-mix(in_srgb,var(--destructive-soft-foreground)_12%,transparent)] px-1.5 font-sans text-[11px] font-medium text-[var(--destructive-soft-foreground)] transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--destructive-soft-foreground)_20%,transparent)]',
                          styles.focusRing,
                        )}
                        title={`Not in ${f.path}: add it`}
                        onClick={async () => {
                          const v = await host.ui.prompt({
                            title: `${key} in ${f.path}`,
                            label: 'Its value',
                            value: f.example ? '' : (values.find((x) => x !== undefined) ?? ''),
                          });
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
              <td />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
