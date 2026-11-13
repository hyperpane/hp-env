// The Env window: the project's .env files as tabs, each one's variables
// with their values hidden until you reveal them, edited in place (Enter
// saves, Escape cancels); what its example has that it hasn't; a warning
// when git has a secrets file committed or doesn't ignore it; and Compare,
// every variable against every file.
//
// A file's tab is FileView.tsx (each variable a Row.tsx), Compare is
// Compare.tsx.

import { useEffect, useState } from 'react';
import { Eye, EyeOff, FilePlus, Rows3, Table2, TriangleAlert } from 'lucide-react';
import { useHost, useProject } from '@hyperpane/sdk/client';
import { NodeButton, NodeMessage, ToolButton, cn } from '@hyperpane/ui';
import type { EnvState } from '../shared/index.ts';
import { Compare } from './Compare.tsx';
import { FileView } from './FileView.tsx';
import { type Call, newFile, warning } from './lib.ts';

const ID = 'env';

export function EnvView() {
  const host = useHost();
  const project = useProject();
  const [state, setState] = useState<EnvState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [revealAll, setRevealAll] = useState(false);

  useEffect(() => {
    if (!project) return;
    setState(null);
    setError(null);
    return host.subscribe<EnvState>(ID, { op: 'watch', project: project.id }, setState, { onEnd: (e) => e && setError(e) });
  }, [project?.id, host]);

  if (!project) return <NodeMessage>Open a project to see its .env files.</NodeMessage>;
  if (error) return <NodeMessage error>{error}</NodeMessage>;
  if (!state) return <NodeMessage>Looking for .env files…</NodeMessage>;
  if (state.elsewhere) return <NodeMessage>This project’s folder is on another server.</NodeMessage>;

  const call: Call = (req) =>
    host.call(ID, { project: project.id, ...req }).then(
      () => true,
      (e: Error) => (host.app.toast(e.message, { error: true }), false),
    );
  const files = state.files;
  const file = files.find((f) => f.path === chosen) ?? files.find((f) => !f.example) ?? files[0] ?? null;

  if (!files.length) return <NoFiles call={call} />;

  return (
    <div className="flex h-full flex-col text-xs text-[var(--node-fg)]">
      <div className="flex items-center gap-1 border-b border-[var(--node-border)] px-2 py-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {!compare &&
            files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setChosen(f.path)}
                title={f.path}
                className={cn(
                  'rounded-control flex h-6 flex-none items-center gap-1 px-2 transition-colors duration-100',
                  f.path === file?.path ? 'bg-[color-mix(in_srgb,var(--node-accent)_22%,transparent)]' : 'text-[var(--node-muted)] hover:bg-[var(--node-hover)]',
                )}
              >
                {warning(f) && <TriangleAlert className="size-3 text-[var(--ansi-3)]" />}
                <span className={cn(f.example && 'italic')}>{f.path}</span>
                <span className="text-[var(--node-muted)]">{f.entries.filter((e) => !e.shadowed).length}</span>
              </button>
            ))}
          {compare && <span className="flex h-6 items-center px-1 text-[var(--node-muted)]">Every variable in every file</span>}
        </div>
        <ToolButton label={revealAll ? 'Hide the values' : 'Show the values'} icon={revealAll ? EyeOff : Eye} active={revealAll} onClick={() => setRevealAll(!revealAll)} />
        <ToolButton label={compare ? 'One file' : 'Compare the files'} icon={compare ? Rows3 : Table2} active={compare} onClick={() => setCompare(!compare)} disabled={files.length < 2 && !compare} />
        <ToolButton label="New .env file" icon={FilePlus} onClick={() => void newFile(host, call, files)} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {compare ? <Compare files={files} reveal={revealAll} call={call} /> : file && <FileView key={file.path} file={file} files={files} revealAll={revealAll} call={call} />}
      </div>
    </div>
  );
}

function NoFiles({ call }: { call: Call }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[var(--node-muted)]">
      <p>No .env files in this project.</p>
      <NodeButton onClick={() => void call({ op: 'create', file: '.env' })}>
        <FilePlus />
        Create .env
      </NodeButton>
    </div>
  );
}
