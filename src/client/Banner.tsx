// A notice above a file's table: a card tinted amber, a round icon tile,
// the words.

import { TriangleAlert } from '@hyperpane/icons';

/** A notice in amber: a card tinted in the colour, a round icon tile, the words. */
export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card flex items-start gap-2.5 bg-[color-mix(in_srgb,var(--amber-soft-foreground)_9%,transparent)] p-2.5 ring-1 ring-[color-mix(in_srgb,var(--amber-soft-foreground)_18%,transparent)] ring-inset">
      <span className="grid size-6 flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--amber-soft-foreground)_16%,transparent)] text-[var(--amber-soft-foreground)]">
        <TriangleAlert className="size-3.5" />
      </span>
      <span className="min-w-0 pt-0.5 text-xs leading-[18px] [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}
