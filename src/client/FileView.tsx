// One .env file in the Env window: a warning when git has it or doesn't
// ignore it, a bar with its counts (on, off), a filter and whether to show
// the ones that are off, its variables as a table in the file's order (the
// commented-out ones too, unticked: tick one to use it), a row to add one,
// and what its example has that it hasn't, a click to add each.

import { useState } from 'react';
import { Plus, Search, TriangleAlert } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { Checkbox, NodeButton, NodeInput, NodeMessage, cn, styles } from '@hyperpane/ui';
import { type EnvFile, KEY_NAME } from '../shared/index.ts';
import { type Call, warning } from './lib.ts';
import { COLUMNS, Row } from './Row.tsx';

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

  if (file.tooBig) return <NodeMessage>{file.path} is over 1 MB: open it in the Editor.</NodeMessage>;

  const toggle = (line: number) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(line)) n.delete(line);
      else n.add(line);
      return n;
    });
  const keyProblem = adding.key && !KEY_NAME.test(adding.key) ? 'Letters, digits and _, not starting with a digit' : keys.has(adding.key) ? 'It’s there already' : null;

  return (
    <div className="flex flex-col">
      {warn && (
        <div className="flex items-start gap-1.5 border-b border-[var(--node-border)] bg-[color-mix(in_srgb,var(--ansi-3)_12%,transparent)] px-2 py-1.5">
          <TriangleAlert className="mt-px size-3.5 flex-none text-[var(--ansi-3)]" />
          <span>{warn}</span>
        </div>
      )}
      {file.example && <div className="border-b border-[var(--node-border)] px-2 py-1.5 text-[var(--node-muted)]">An example: the variables the project needs, with placeholder values. Its values are shown.</div>}
      {file.unreadable.length > 0 && (
        <div className="border-b border-[var(--node-border)] px-2 py-1.5 text-[var(--ansi-3)]">
          {file.unreadable.length === 1 ? `Line ${file.unreadable[0]} isn’t` : `Lines ${file.unreadable.slice(0, 8).join(', ')} aren’t`} a variable: kept as they are.
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-[var(--node-border)] px-2 py-1.5">
        <span className="text-[var(--node-muted)] tabular-nums">
          <span className="text-[var(--node-fg)]">{on.length}</span> on{offCount > 0 && <> · {offCount} off</>}
        </span>
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-1.5 size-3 -translate-y-1/2 text-[var(--node-muted)]" />
          <NodeInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" className="h-6 w-40 pl-6 font-mono" aria-label="Filter by name" />
        </label>
        {offCount > 0 && (
          <Checkbox className="gap-1.5 text-xs text-[var(--node-muted)] hover:text-[var(--node-fg)]" label="Show off" checked={!hideOff} onCheckedChange={(v) => setHideOff(!v)} />
        )}
      </div>

      {rows.length > 0 && (
        <div className={cn(COLUMNS, styles.stickyTop, 'border-b border-[var(--node-border)] bg-[var(--node-bg)] pr-1 text-[10.5px] font-medium tracking-wide text-[var(--node-muted)] uppercase')}>
          <span className="flex h-6 items-center justify-center" title="On: used. Off: commented out (# NAME=value).">
            ✓
          </span>
          <span>Name</span>
          <span>Value</span>
          <span />
        </div>
      )}
      {rows.length === 0 && <p className="px-2 py-3 text-[var(--node-muted)]">Nothing in it yet</p>}
      {rows.length > 0 && visible.length === 0 && <p className="px-2 py-3 text-[var(--node-muted)]">No variable matches “{filter}”.</p>}
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
            if (await host.ui.confirm({ title: `Remove ${e.key}?`, message: `Line ${e.line} of ${file.path}${e.disabled ? ' (it’s commented out)' : ''}`, confirm: 'Remove', destructive: true })) void call({ op: 'remove', ...v, key: e.key, line: e.line });
          }}
        />
      ))}
      <form
        className={cn(COLUMNS, 'gap-y-1 py-1.5 pr-1')}
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!adding.key || keyProblem) return;
          if (await call({ op: 'set', ...v, key: adding.key, value: adding.value })) setAdding({ key: '', value: '' });
        }}
      >
        <span className="flex justify-center text-[var(--node-muted)]">
          <Plus className="size-3.5" />
        </span>
        <NodeInput className={cn('mr-2 h-6 font-mono', keyProblem && 'border-[var(--ansi-1)]')} placeholder="NEW_VARIABLE" title={keyProblem ?? undefined} value={adding.key} onChange={(e) => setAdding({ ...adding, key: e.target.value.trim() })} aria-label="Name" />
        <NodeInput className="h-6 min-w-0 font-mono" placeholder="value" value={adding.value} onChange={(e) => setAdding({ ...adding, value: e.target.value })} aria-label="Value" />
        <span className="pl-1">
          <NodeButton type="submit" disabled={!adding.key || !!keyProblem}>
            Add
          </NodeButton>
        </span>
      </form>
      {missing.length > 0 && example && (
        <div className="border-t border-[var(--node-border)] px-2 py-2">
          <p className="mb-1.5 text-[var(--node-muted)]">
            In {example.path}, not here ({missing.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {missing.map((e) => (
              <NodeButton key={e.key} className="font-mono" title={`Add ${e.key} with the example’s value (${e.value || 'empty'})`} onClick={() => void call({ op: 'set', ...v, key: e.key, value: e.value })}>
                <Plus />
                {e.key}
              </NodeButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
