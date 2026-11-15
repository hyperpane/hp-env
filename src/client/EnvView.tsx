// The Env window: the project's .env files, picked from a list, each one's variables
// with their values hidden until you reveal them, edited in place (Enter
// saves, Escape cancels); what its example has that it hasn't; a warning
// when git has a secrets file committed or doesn't ignore it; and Compare,
// every variable against every file.
//
// The list is the kit's Picker (each file's count of variables on, ⚠ when
// git has it or doesn't ignore it), a file is FileView.tsx (each variable
// a Row.tsx), Compare is Compare.tsx.

import { useEffect, useState } from 'react';
import { Eye, EyeOff, FileKey, FilePlus, Rows3, Table2, TriangleAlert } from 'lucide-react';
import { useData, useHost, useProject } from '@hyperpane/sdk/client';
import { NodeButton, NodeMessage, Picker, ToolButton, cn } from '@hyperpane/ui';
import type { EnvFile, EnvState } from '../shared/index.ts';
import { Compare } from './Compare.tsx';
import { FileView } from './FileView.tsx';
import { type Call, newFile, warning } from './lib.ts';

const ID = 'env';

/** How many of a file's variables are on. */
const count = (f: EnvFile) => f.entries.filter((e) => !e.shadowed && !e.disabled).length;

export function EnvView() {
  const host = useHost();
  const project = useProject();
  const [state, setState] = useState<EnvState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  // A file it was opened with (from Explorer, or dropped): its tab.
  const data = useData();
  const opened = relative(project?.folder ?? null, data.path ?? null);

  // A .env file opened later shows here, not in a window of its own.
  useEffect(() => {
    if (data.unlocked !== '1') host.win.setData('unlocked', '1');
  }, [host]);
  useEffect(() => {
    if (!opened) return;
    setChosen(opened);
    setCompare(false);
  }, [opened, data.line]);

  useEffect(() => {
    if (!project) return;
    setState(null);
    setError(null);
    return host.subscribe<EnvState>(ID, { op: 'watch', project: project.id }, setState, { onEnd: (e) => e && setError(e) });
  }, [project?.id, host]);

  if (!project) return <NodeMessage>Open a project to see its .env files</NodeMessage>;
  if (error) return <NodeMessage error>{error}</NodeMessage>;
  if (!state) return <NodeMessage>Looking for .env files</NodeMessage>;
  if (state.elsewhere) return <NodeMessage>This project’s folder is on another server</NodeMessage>;

  const call: Call = (req) =>
    host.call(ID, { project: project.id, ...req }).then(
      () => true,
      (e: Error) => (host.app.toast(e.message, { error: true }), false),
    );
  const files = state.files;
  const notHere = opened && !files.some((f) => f.path === opened) ? opened : null;
  const file = files.find((f) => f.path === chosen) ?? files.find((f) => !f.example) ?? files[0] ?? null;

  if (!files.length) return <NoFiles call={call} />;

  return (
    <div className="flex h-full flex-col text-xs text-[var(--node-fg)]">
      <div className="flex items-center gap-1 border-b border-[var(--node-border)] px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center">
          {compare ? <span className="flex h-6 items-center px-1 text-[var(--node-muted)]">Every variable in every file</span> : (
            <Picker
              label="File"
              className={cn('font-mono', file?.example && 'italic')}
              icon={file && warning(file) ? <TriangleAlert className="text-[var(--ansi-3)]" /> : <FileKey className="text-[var(--node-muted)]" />}
              value={file?.path ?? null}
              options={files.map((f) => ({ value: f.path, label: f.path, detail: `${count(f)}${warning(f) ? ' ⚠' : ''}` }))}
              onValueChange={setChosen}
            />
          )}
        </div>
        <ToolButton label={revealAll ? 'Hide the values' : 'Show the values'} icon={revealAll ? EyeOff : Eye} active={revealAll} onClick={() => setRevealAll(!revealAll)} />
        <ToolButton label={compare ? 'One file' : 'Compare the files'} icon={compare ? Rows3 : Table2} active={compare} onClick={() => setCompare(!compare)} disabled={files.length < 2 && !compare} />
        <ToolButton label="New .env file" icon={FilePlus} onClick={() => void newFile(host, call, files)} />
      </div>
      {notHere && (
        <div className="border-b border-[var(--node-border)] bg-[color-mix(in_srgb,var(--ansi-3)_12%,transparent)] px-3 py-1.5 text-[var(--node-fg)]">
          {notHere} isn’t one of this project’s .env files: it’s outside the project’s folder, or more than three folders down, or not named as one.
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {compare ? <Compare files={files} reveal={revealAll} call={call} /> : file && <FileView key={file.path} file={file} files={files} revealAll={revealAll} call={call} />}
      </div>
    </div>
  );
}

function NoFiles({ call }: { call: Call }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[var(--node-muted)]">
      <p>No .env files in this project</p>
      <NodeButton onClick={() => void call({ op: 'create', file: '.env' })}>
        <FilePlus />
        Create .env
      </NodeButton>
    </div>
  );
}

/** A path on the server as the project's files name it (`apps/web/.env`),
 * or as it is when it isn't in the project's folder. */
function relative(folder: string | null, path: string | null): string | null {
  if (!path) return null;
  const p = path.replace(/\\/g, '/');
  const f = folder?.replace(/\\/g, '/').replace(/\/+$/, '');
  return f && p.startsWith(`${f}/`) ? p.slice(f.length + 1) : p;
}
