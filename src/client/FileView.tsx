// One .env file in the Env window: a warning when git has it or doesn't
// ignore it, a bar with its counts (on, off), a filter and whether to show
// the ones that are off, its variables as a table in the file's order (the
// commented-out ones too, unticked: tick one to use it), a row to add one,
// and what its example has that it hasn't, a click to add each.

import { useState } from 'react';
import { FileWarning, Info, Plus, Search, TriangleAlert } from '@hyperpane/icons';
import { Banner } from './Banner.tsx';
import { useHost } from '@hyperpane/sdk/client';
import { Button, Checkbox, Empty, Input, SectionHeader, cn, styles } from '@hyperpane/ui';
import { type EnvFile, KEY_NAME } from '../shared/index.ts';
import { type Call, warning } from './lib.ts';
import { COLUMNS, Row, UNDER } from './Row.tsx';

export function FileView({ file, files, revealAll, call }: { file: EnvFile; files: EnvFile[]; revealAll: boolean; call: Call }) {
  const host = useHost();
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState({ key: '', value: '' });
  const [filter, setFilter] = useState('');
  const [hideOff, setHideOff] = useState(false);
  // The rows: every line of a variable but the ones a later one hides.
  const rows = file.entries.filter((e) => !e.shadowed);
  const on = rows.filter((e) => !e.disabled);
  const offCount = rows.length - on.length;
  const keys = new Set(on.map((e) => e.key));
  const q = filter.trim().toLowerCase();
  const visible = rows.filter((e) => (!hideOff || !e.disabled) && (!q || e.key.toLowerCase().includes(q)));
  // The example beside it (same folder) has these, and this file hasn't.
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : '';
  const example = file.example ? null : files.find((f) => f.example && f.path.startsWith(dir) && !f.path.slice(dir.length).includes('/'));
  const missing = example ? example.entries.filter((e) => !e.shadowed && !e.disabled && !keys.has(e.key)) : [];
  const warn = warning(file);
  const v = { file: file.path, version: file.version };

  if (file.tooBig)
    return (
      <Empty
        size="compact"
        className="h-full"
        icon={<FileWarning />}
        title="Too big to show"
        description={`${file.path} is over 1 MB: open it in the Editor.`}
      />
    );

  const toggle = (line: number) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(line)) n.delete(line);
      else n.add(line);
      return n;
    });
  const keyProblem =
    adding.key && !KEY_NAME.test(adding.key) ? 'Letters, digits and _, not starting with a digit' : keys.has(adding.key) ? 'It’s there already' : null;

  return (
    <div className="flex flex-col pb-3">
      {/* What needs saying about the file, one notice to a line, above the table. */}
      {(warn || file.example || file.unreadable.length > 0) && (
        <div className="flex flex-col gap-2 px-3 pt-3">
          {warn && <Banner>{warn}</Banner>}
          {file.example && (
            <p className="flex items-start gap-2 px-1 text-xs text-[var(--node-muted)]">
              <Info className="mt-0.5 size-3.5 flex-none" />
              An example: the variables the project needs, with placeholder values. Its values are shown.
            </p>
          )}
          {file.unreadable.length > 0 && (
            <p className="flex items-start gap-2 px-1 text-xs text-[var(--amber-soft-foreground)]">
              <TriangleAlert className="mt-0.5 size-3.5 flex-none" />
              <span>
                {file.unreadable.length === 1 ? `Line ${file.unreadable[0]} isn’t` : `Lines ${file.unreadable.slice(0, 8).join(', ')} aren’t`} a variable: kept
                as they are.
              </span>
            </p>
          )}
        </div>
      )}

      {/* Its counts and the filter. */}
      <div className="flex h-11 flex-none items-center gap-3 px-3 touch:h-13">
        <span className="text-xs text-[var(--node-muted)] tabular-nums">
          <span className="font-medium text-[var(--node-fg)]">{on.length}</span> on{offCount > 0 && <> · {offCount} off</>}
        </span>
        <span className="ms-auto flex min-w-0 items-center gap-3">
          {offCount > 0 && (
            <Checkbox
              className="gap-1.5 text-xs text-[var(--node-muted)] hover:text-[var(--node-fg)]"
              label="Show off"
              checked={!hideOff}
              onCheckedChange={(v) => setHideOff(!v)}
            />
          )}
          <Input
            size="sm"
            variant="secondary"
            icon={<Search className="size-3.5" />}
            clearable
            onClear={() => setFilter('')}
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            placeholder="Filter by name"
            containerClassName="w-48 max-sm:w-36"
            aria-label="Filter by name"
          />
        </span>
      </div>

      {rows.length > 0 && (
        <div className={cn(styles.stickyTop, 'border-b border-[var(--hairline)] bg-[var(--node-bg)] px-1.5')}>
          <div className={cn(COLUMNS, 'h-8 px-0 text-xs font-medium text-[var(--node-muted)] touch:h-10')}>
            <span className="flex items-center justify-center" title="On: used. Off: commented out (# NAME=value).">
              On
            </span>
            <span>
              Name<span className="sm:hidden"> and value</span>
            </span>
            <span className="max-sm:hidden">Value</span>
            <span className="max-sm:hidden" />
          </div>
        </div>
      )}
      {rows.length === 0 && <p className="px-4 py-3 text-xs text-[var(--node-muted)]">Nothing in it yet</p>}
      {rows.length > 0 && visible.length === 0 && <p className="px-4 py-3 text-xs text-[var(--node-muted)]">No variable matches “{filter}”.</p>}
      <div className="flex flex-col px-1.5 pt-1">
        {visible.map((e) => (
          <Row
            key={e.line}
            name={e.key}
            value={e.value}
            line={e.line}
            disabled={e.disabled}
            twice={!e.disabled && file.entries.some((x) => x.shadowed && x.key === e.key)}
            reveal={file.example || revealAll || shown.has(e.line)}
            onToggle={() => toggle(e.line)}
            onEnable={(enable) => void call({ op: 'toggle', ...v, line: e.line, on: enable })}
            onCopy={() => void host.app.clipboardWrite({ text: e.value }).then(() => host.app.toast(`${e.key} copied`))}
            onSave={(value) => call({ op: 'set', ...v, key: e.key, value, line: e.line })}
            onRename={(to) => call({ op: 'rename', ...v, key: e.key, to, line: e.line })}
            onRemove={async () => {
              if (
                await host.ui.confirm({
                  title: `Remove ${e.key}?`,
                  message: `Line ${e.line} of ${file.path}${e.disabled ? ' (it’s commented out)' : ''}`,
                  confirm: 'Remove',
                  destructive: true,
                })
              )
                void call({ op: 'remove', ...v, key: e.key, line: e.line });
            }}
          />
        ))}
        {/* A new variable, as a row of its own. */}
        <form
          className={cn(COLUMNS, 'gap-y-1 py-1.5')}
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!adding.key || keyProblem) return;
            if (await call({ op: 'set', ...v, key: adding.key, value: adding.value })) setAdding({ key: '', value: '' });
          }}
        >
          <span className="flex justify-center text-[var(--node-muted)]">
            <Plus className="size-4" />
          </span>
          <Input
            size="sm"
            variant="secondary"
            containerClassName="mr-2"
            className="font-mono text-xs"
            error={!!keyProblem}
            placeholder="NEW_VARIABLE"
            title={keyProblem ?? undefined}
            value={adding.key}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdding({ ...adding, key: e.target.value.trim() })}
            aria-label="Name"
          />
          <Input
            size="sm"
            variant="secondary"
            containerClassName={cn(UNDER, 'min-w-0')}
            className="font-mono text-xs"
            placeholder="value"
            value={adding.value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdding({ ...adding, value: e.target.value })}
            aria-label="Value"
          />
          <span className="flex justify-end ps-2">
            <Button type="submit" size="sm" variant="secondary" disabled={!adding.key || !!keyProblem}>
              Add
            </Button>
          </span>
        </form>
        {keyProblem && <p className="ps-9 text-xs text-[var(--destructive-soft-foreground)]">{keyProblem}</p>}
      </div>
      {missing.length > 0 && example && (
        <div className="mt-3 px-1.5">
          <SectionHeader label={<>In <span className="font-mono normal-case tracking-normal">{example.path}</span>, not here</>} count={missing.length} />
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-1">
            {missing.map((e) => (
              <Button
                key={e.key}
                size="xs"
                variant="secondary"
                className="font-mono"
                title={`Add ${e.key} with the example’s value (${e.value || 'empty'})`}
                onClick={() => void call({ op: 'set', ...v, key: e.key, value: e.value })}
              >
                <Plus className="size-3.5" />
                {e.key}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
