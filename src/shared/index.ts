// What both parts share: a project's .env files as the server part reads
// them.

export interface EnvEntry {
  key: string;
  value: string;
  /** 1-based. */
  line: number;
  /** The key is in the file more than once: this one isn't the one that
   * counts (the last one does). */
  shadowed: boolean;
}

export interface EnvFile {
  /** From the project's folder, with `/` (`.env`, `apps/web/.env.local`). */
  path: string;
  /** `.env.example`, `.env.sample`, `.env.template`…: the variables a
   * project needs, not its secrets. */
  example: boolean;
  entries: EnvEntry[];
  /** Lines it couldn't read (1-based). */
  unreadable: number[];
  /** What it holds now: an edit names it, and is refused when the file
   * changed since. */
  version: string;
  /** Whether git has it committed (null: not in a repository, or no git). */
  tracked: boolean | null;
  /** Whether git ignores it (null: not in a repository, or no git). */
  ignored: boolean | null;
  /** Too big to show (over 1 MB). */
  tooBig: boolean;
}

/** What the `watch` subscription sends, again on every change. */
export interface EnvState {
  files: EnvFile[];
  /** The project's folder isn't on this server. */
  elsewhere: boolean;
}

/** The names it looks for: `.env`, `.env.<anything>`, `<anything>.env`. */
export function isEnvName(name: string): boolean {
  return /^\.env(\.[^/\\]+)?$/.test(name) || /^[^/\\]+\.env$/.test(name);
}

export function isExampleName(name: string): boolean {
  return /[.-](example|sample|template|dist|defaults?)$/i.test(name) || /^(example|sample|template)\.env$/i.test(name);
}

export const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
