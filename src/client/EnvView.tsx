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
import { CircleAlert, Eye, EyeOff, FileKey, FilePlus, FolderOpen, Rows3, Server, Table2, TriangleAlert } from '@hyperpane/icons';
import { useBack, useData, useHost, useProject } from '@hyperpane/sdk/client';
import { Button, Empty, HeaderBar, Picker, Spinner, ToolButton, cn } from '@hyperpane/ui';
import type { EnvFile, EnvState } from '../shared/index.ts';
import { Banner } from './Banner.tsx';
import { Compare } from './Compare.tsx';
import { FileView } from './FileView.tsx';
import { type Call, newFile, warning } from './lib.ts';
import { ACCENT } from './accent.ts';


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
  // Back: from Compare to the one file, as its button does.
  useBack(compare ? () => setCompare(false) : null);
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

  if (!project)
    return <Empty size="compact" className="h-full" icon={<FolderOpen />} title="No project" description="Open a project to see its .env files." />;
  if (error)
    return (
      <Empty
        size="compact"
        className="h-full"
        icon={<CircleAlert className="text-[var(--destructive-soft-foreground)]" />}
        title="Couldn’t read the .env files"
        description={error}
      />
    );
  if (!state)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[var(--node-muted)]">
        <Spinner size="sm" />
        Looking for .env files
      </div>
    );
  if (state.elsewhere)
    return <Empty size="compact" className="h-full" icon={<Server />} title="On another server" description="This project’s folder is on another server." />;

  const call: Call = (req) =>
    host.call(ID, { project: project.id, ...req }).then(
      () => true,
      (e: Error) => {
        host.app.toast(e.message, { error: true });
        return false;
      },
    );
  const files = state.files;
  const notHere = opened && !files.some((f) => f.path === opened) ? opened : null;
  const file = files.find((f) => f.path === chosen) ?? files.find((f) => !f.example) ?? files[0] ?? null;

  if (!files.length) return <NoFiles call={call} />;

  return (
    <div className="flex h-full flex-col text-[13px] leading-5 text-[var(--node-fg)]" style={ACCENT}>
      {/* The window's one bar: which file (or Compare), then the tools. */}
      <HeaderBar className="gap-1 px-2">
        <div className="flex min-w-0 flex-1 items-center">
          {compare ? (
            <span className="flex h-7 min-w-0 items-center gap-2 px-2.5 font-medium">
              <Table2 className="size-4 flex-none text-[var(--node-muted)]" />
              <span className="truncate">Every variable in every file</span>
              <span className="flex-none text-xs font-normal text-[var(--node-muted)] tabular-nums">{files.length} files</span>
            </span>
          ) : (
            <Picker
              label="File"
              size="sm"
              ghost
              className={cn('font-mono text-[13px] [&_svg]:size-4', file?.example && 'italic')}
              icon={file && warning(file) ? <TriangleAlert className="text-[var(--amber-soft-foreground)]" /> : <FileKey className="text-[var(--node-muted)]" />}
              value={file?.path ?? null}
              options={files.map((f) => ({ value: f.path, label: f.path, detail: `${count(f)}${warning(f) ? ' ⚠' : ''}` }))}
              onValueChange={setChosen}
            />
          )}
        </div>
        <ToolButton
          label={revealAll ? 'Hide the values' : 'Show the values'}
          icon={revealAll ? EyeOff : Eye}
          active={revealAll}
          onClick={() => setRevealAll(!revealAll)}
        />
        <ToolButton
          label={compare ? 'One file' : 'Compare the files'}
          icon={compare ? Rows3 : Table2}
          active={compare}
          onClick={() => setCompare(!compare)}
          disabled={files.length < 2 && !compare}
        />
        <ToolButton label="New .env file" icon={FilePlus} onClick={() => void newFile(host, call, files)} />
      </HeaderBar>
      {notHere && (
        <div className="flex-none px-3 pt-3">
          <Banner>
            <span className="font-mono text-xs">{notHere}</span> isn’t one of this project’s .env files: it’s outside the project’s folder, or more than three
            folders down, or not named as one.
          </Banner>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {compare ? (
          <Compare files={files} reveal={revealAll} call={call} />
        ) : (
          file && <FileView key={file.path} file={file} files={files} revealAll={revealAll} call={call} />
        )}
      </div>
    </div>
  );
}

function NoFiles({ call }: { call: Call }) {
  return (
    <Empty
      size="compact"
      className="h-full"
      icon={<FileKey />}
      title="No .env files"
      description="This project has no .env file yet."
      action={
        <Button size="sm" onClick={() => void call({ op: 'create', file: '.env' })}>
          <FilePlus className="size-3.5" />
          Create .env
        </Button>
      }
    />
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
