// One variable in a file: its name (double-click to rename), its value,
// hidden until revealed (double-click to change it; Enter saves, Escape
// cancels), and show, copy, change and remove.

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import { NodeInput, ToolButton, cn } from '@hyperpane/ui';
import { KEY_NAME } from '../shared/index.ts';
import { MASK } from './lib.ts';

export function Row(props: {
  name: string;
  value: string;
  line: number;
  twice: boolean;
  reveal: boolean;
  onToggle(): void;
  onCopy(): void;
  onSave(value: string): Promise<boolean>;
  onRename(to: string): Promise<boolean>;
  onRemove(): void;
}) {
  const [editing, setEditing] = useState<'value' | 'name' | null>(null);
  const [draft, setDraft] = useState('');
  const start = (what: 'value' | 'name') => {
    setDraft(what === 'value' ? props.value : props.name);
    setEditing(what);
  };
  const save = async () => {
    const ok = editing === 'value' ? (draft === props.value ? true : await props.onSave(draft)) : draft === props.name ? true : KEY_NAME.test(draft) && (await props.onRename(draft));
    if (ok) setEditing(null);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') setEditing(null);
  };
  const multiline = props.value.includes('\n');
  return (
    <div className="group flex min-h-8 items-center gap-2 border-b border-[var(--node-border)] px-2 py-1 hover:bg-[var(--node-hover)]">
      {editing === 'name' ? (
        <NodeInput autoFocus className="w-40 flex-none font-mono" value={draft} onChange={(e) => setDraft(e.target.value.trim())} onKeyDown={keys} onBlur={() => setEditing(null)} />
      ) : (
        <button type="button" className="w-40 flex-none truncate text-left font-mono" title={`${props.name} (line ${props.line}). Double-click to rename.`} onDoubleClick={() => start('name')}>
          {props.name}
          {props.twice && (
            <span className="ml-1 text-[var(--ansi-3)]" title="It’s in the file more than once: this one counts (the last).">
              ×2
            </span>
          )}
        </button>
      )}
      {editing === 'value' ? (
        <textarea
          autoFocus
          rows={Math.min(6, draft.split('\n').length)}
          className="rounded-control min-w-0 flex-1 resize-none border border-[var(--node-accent)] bg-transparent px-1.5 py-0.5 font-mono text-xs outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={keys}
          spellCheck={false}
        />
      ) : (
        <button type="button" className={cn('min-w-0 flex-1 truncate text-left font-mono', !props.reveal && 'text-[var(--node-muted)]')} onDoubleClick={() => start('value')} title="Double-click to change it">
          {props.value === '' ? <span className="text-[var(--node-muted)] italic">empty</span> : props.reveal ? (multiline ? props.value.replace(/\n/g, '⏎') : props.value) : MASK}
        </button>
      )}
      {editing ? (
        <>
          <ToolButton label="Save (Enter)" icon={Check} onClick={() => void save()} />
          <ToolButton label="Cancel (Escape)" icon={X} onClick={() => setEditing(null)} />
        </>
      ) : (
        <div className="flex flex-none opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <ToolButton label={props.reveal ? 'Hide' : 'Show'} icon={props.reveal ? EyeOff : Eye} onClick={props.onToggle} />
          <ToolButton label="Copy the value" icon={Copy} onClick={props.onCopy} />
          <ToolButton label="Change the value" icon={Pencil} onClick={() => start('value')} />
          <ToolButton label="Remove" icon={Trash2} onClick={props.onRemove} />
        </div>
      )}
    </div>
  );
}
