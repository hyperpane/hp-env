// One variable in a file, as a row of the file's table: a checkbox (on, or
// commented out), its name (double-click to rename), its value hidden until
// revealed (double-click to change it; Enter saves, Shift+Enter is a new
// line, Escape cancels), and show, copy, change and remove on hover (always,
// with a finger). A narrow window puts the value under the name.

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import { Checkbox, NodeInput, ToolButton, cn } from '@hyperpane/ui';
import { KEY_NAME } from '../shared/index.ts';
import { MASK } from './lib.ts';

/** The table's columns, shared by its header, rows and the add row. Narrow:
 * the name and the actions on a line, the value (`UNDER`) on the next. */
export const COLUMNS = 'grid grid-cols-[28px_minmax(120px,34%)_minmax(0,1fr)_auto] items-center max-sm:grid-cols-[28px_minmax(0,1fr)_auto]';
/** The value's place in a narrow window: under the name, to the end. */
export const UNDER = 'max-sm:col-[2/4] max-sm:row-start-2';

export function Row(props: {
  name: string;
  value: string;
  line: number;
  disabled: boolean;
  twice: boolean;
  reveal: boolean;
  onToggle(): void;
  onEnable(on: boolean): void;
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
    const ok =
      editing === 'value'
        ? draft === props.value
          ? true
          : await props.onSave(draft)
        : draft === props.name
          ? true
          : KEY_NAME.test(draft) && (await props.onRename(draft));
    if (ok) setEditing(null);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') setEditing(null);
  };
  const multiline = props.value.includes('\n');
  const off = props.disabled;
  return (
    <div
      className={cn(
        COLUMNS,
        'group min-h-8 border-b border-[color-mix(in_srgb,var(--node-border)_70%,transparent)] pr-1 hover:bg-[var(--node-hover)] touch:min-h-10 max-sm:pb-1.5',
        editing && 'bg-[var(--node-hover)]',
      )}
    >
      <label className="flex h-8 cursor-pointer items-center justify-center touch:h-10">
        <Checkbox
          checked={!off}
          onCheckedChange={props.onEnable}
          label={off ? `Off: commented out on line ${props.line}. Tick to use it.` : `On (line ${props.line}). Untick to comment it out.`}
          hideLabel
        />
      </label>
      {editing === 'name' ? (
        <NodeInput
          autoFocus
          className="mr-2 h-6 font-mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value.trim())}
          onKeyDown={keys}
          onBlur={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          className={cn('flex min-w-0 items-center gap-1.5 pr-2 text-left font-mono', off && 'text-[var(--node-muted)]')}
          title={`${props.name} (line ${props.line}). Double-click to rename.`}
          onDoubleClick={() => start('name')}
        >
          <span className={cn('truncate', off && 'line-through decoration-[color-mix(in_srgb,var(--node-muted)_60%,transparent)]')}>{props.name}</span>
          {props.twice && !off && (
            <span
              className="flex-none rounded-[3px] bg-[color-mix(in_srgb,var(--ansi-3)_18%,transparent)] px-1 text-[10px] text-[var(--ansi-3)]"
              title="It’s on more than once: this one counts (the last)"
            >
              ×2
            </span>
          )}
          {off && (
            <span className="flex-none rounded-[3px] border border-[var(--node-border)] px-1 text-[9.5px] tracking-wide text-[var(--node-muted)] uppercase no-underline">
              off
            </span>
          )}
        </button>
      )}
      {editing === 'value' ? (
        <textarea
          autoFocus
          rows={Math.min(6, draft.split('\n').length)}
          className={cn(
            UNDER,
            'rounded-control my-1 min-w-0 resize-none border border-[var(--node-accent)] bg-[var(--node-bg)] px-1.5 py-0.5 font-mono text-xs outline-none',
          )}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={keys}
          spellCheck={false}
        />
      ) : (
        <button
          type="button"
          className={cn(UNDER, 'min-w-0 truncate text-left font-mono', (!props.reveal || off) && 'text-[var(--node-muted)]', off && 'opacity-70')}
          onDoubleClick={() => start('value')}
          title="Double-click to change it"
        >
          {props.value === '' ? (
            <span className="italic opacity-70">empty</span>
          ) : props.reveal ? (
            multiline ? (
              props.value.replace(/\n/g, '⏎')
            ) : (
              props.value
            )
          ) : (
            <span className="tracking-widest">{MASK}</span>
          )}
        </button>
      )}
      {editing ? (
        <div className="flex flex-none pl-1">
          <ToolButton label="Save (Enter)" icon={Check} onClick={() => void save()} />
          <ToolButton label="Cancel (Escape)" icon={X} onClick={() => setEditing(null)} />
        </div>
      ) : (
        <div className="flex flex-none pl-1 opacity-0 group-hover:opacity-100 has-[:focus-visible]:opacity-100 touch:opacity-100">
          <ToolButton label={props.reveal ? 'Hide' : 'Show'} icon={props.reveal ? EyeOff : Eye} onClick={props.onToggle} />
          <ToolButton label="Copy the value" icon={Copy} onClick={props.onCopy} />
          <ToolButton label="Change the value" icon={Pencil} onClick={() => start('value')} />
          <ToolButton label="Remove" icon={Trash2} onClick={props.onRemove} />
        </div>
      )}
    </div>
  );
}
