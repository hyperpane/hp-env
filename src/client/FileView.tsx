// One .env file in the Env window: a warning when git has it or doesn't
// ignore it, its variables (values hidden until revealed), a row to add
// one, and what its example has that it hasn't, a click to add each.

import { useState } from 'react';
import { Plus, TriangleAlert } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { NodeButton, NodeInput, NodeMessage, cn } from '@hyperpane/ui';
import { type EnvFile, KEY_NAME } from '../shared/index.ts';
import { type Call, warning } from './lib.ts';
import { Row } from './Row.tsx';

export function FileView({ file, files, revealAll, call }: { file: EnvFile; files: EnvFile[]; revealAll: boolean; call: Call }) {
  const host = useHost();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState({ key: '', value: '' });
  const live = file.entries.filter((e) => !e.shadowed);
  const keys = new Set(live.map((e) => e.key));
  // The example beside it (same folder) has these, and this file hasn't.
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : '';
  const example = file.example ? null : files.find((f) => f.example && f.path.startsWith(dir) && !f.path.slice(dir.length).includes('/'));
  const missing = example ? example.entries.filter((e) => !e.shadowed && !keys.has(e.key)) : [];
  const warn = warning(file);
  const v = { file: file.path, version: file.version };

  if (file.tooBig) return <NodeMessage>{file.path} is over 1 MB: open it in the Editor.</NodeMessage>;

  const toggle = (key: string) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const keyProblem = adding.key && !KEY_NAME.test(adding.key) ? 'Letters, digits and _, not starting with a digit.' : keys.has(adding.key) ? 'It’s there already.' : null;

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
      {live.length === 0 && <p className="px-2 py-3 text-[var(--node-muted)]">Nothing in it yet.</p>}
      {live.map((e) => (
        <Row
          key={e.key}
          name={e.key}
          value={e.value}
          line={e.line}
          twice={file.entries.some((x) => x.shadowed && x.key === e.key)}
          reveal={file.example || revealAll || shown.has(e.key)}
          onToggle={() => toggle(e.key)}
          onCopy={() => void host.app.clipboardWrite({ text: e.value }).then(() => host.app.toast(`${e.key} copied`))}
          onSave={(value) => call({ op: 'set', ...v, key: e.key, value })}
          onRename={(to) => call({ op: 'rename', ...v, key: e.key, to })}
          onRemove={async () => {
            if (await host.ui.confirm({ title: `Remove ${e.key}?`, message: `From ${file.path}.`, confirm: 'Remove', destructive: true })) void call({ op: 'remove', ...v, key: e.key });
          }}
        />
      ))}
      <form
        className="flex items-center gap-1.5 px-2 py-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!adding.key || keyProblem) return;
          if (await call({ op: 'set', ...v, key: adding.key, value: adding.value })) setAdding({ key: '', value: '' });
        }}
      >
        <NodeInput className={cn('w-40 font-mono', keyProblem && 'border-[var(--ansi-1)]')} placeholder="NEW_VARIABLE" title={keyProblem ?? undefined} value={adding.key} onChange={(e) => setAdding({ ...adding, key: e.target.value.trim() })} aria-label="Name" />
        <NodeInput className="min-w-0 flex-1 font-mono" placeholder="value" value={adding.value} onChange={(e) => setAdding({ ...adding, value: e.target.value })} aria-label="Value" />
        <NodeButton type="submit" disabled={!adding.key || !!keyProblem}>
          <Plus />
          Add
        </NodeButton>
      </form>
      {missing.length > 0 && example && (
        <div className="border-t border-[var(--node-border)] px-2 py-2">
          <p className="mb-1 text-[var(--node-muted)]">
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
