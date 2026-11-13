// A project's .env files: found in its folder (and a few levels down, not
// in node_modules and the like), read, watched while a window shows them,
// and changed one variable at a time. An edit names the version of the file
// it was made on; if the file changed since, it's refused and the window
// gets the new one.
//
// Finding the files is find.ts, asking git about them git.ts.

import { createHash } from 'node:crypto';
import { readFile, rename as renameFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Host, PluginError } from '@hyperpane/sdk/server';
import { type EnvFile, type EnvState, KEY_NAME, isEnvName, isExampleName } from '../shared/index.ts';
import { parse, remove, rename, set } from './dotenv.ts';
import { find } from './find.ts';
import { type GitState, gitState } from './git.ts';

export { find };

const MAX_SIZE = 1024 * 1024;

export interface Options {
  /** How often watched files are checked, in ms. */
  pollEvery?: number;
  /** How often the folder is looked through again for new files, in ms. */
  rescanEvery?: number;
}

const version = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

export class Env {
  readonly #host: Host;
  readonly #o: Required<Options>;
  /** What git says, by project, refreshed with the list of files. */
  readonly #git = new Map<string, Map<string, GitState>>();

  constructor(host: Host, o: Options = {}) {
    this.#host = host;
    this.#o = { pollEvery: o.pollEvery ?? 2000, rescanEvery: o.rescanEvery ?? 10_000 };
  }

  #root(project: string): string | null {
    return typeof project === 'string' && project ? this.#host.projectFolder(project) : null;
  }

  /** A file the window names: one of the project's .env files, inside its
   * folder. */
  #file(root: string, file: unknown): string {
    if (typeof file !== 'string' || !file || file.includes('\\') || file.split('/').some((p) => p === '..' || p === '' || p === '.') || path.isAbsolute(file))
      throw new PluginError('That isn’t a file in this project.');
    if (!isEnvName(path.posix.basename(file))) throw new PluginError(`${file} isn’t a .env file.`);
    return path.join(root, ...file.split('/'));
  }

  async state(project: string): Promise<EnvState> {
    const root = this.#root(project);
    if (!root) return { files: [], elsewhere: true };
    const paths = await find(root);
    const git = await gitState(this.#host, root, paths);
    this.#git.set(project, git);
    const files = await Promise.all(paths.map((p) => this.#read(root, p, git.get(p))));
    return { files: files.filter((f): f is EnvFile => !!f), elsewhere: false };
  }

  async #read(root: string, rel: string, git?: GitState): Promise<EnvFile | null> {
    const full = path.join(root, ...rel.split('/'));
    const base = { path: rel, example: isExampleName(path.posix.basename(rel)), tracked: git?.tracked ?? null, ignored: git?.ignored ?? null };
    let size: number;
    try {
      size = (await stat(full)).size;
    } catch {
      return null;
    }
    if (size > MAX_SIZE) return { ...base, entries: [], unreadable: [], version: `size-${size}`, tooBig: true };
    const bytes = await readFile(full).catch(() => null);
    if (!bytes) return null;
    const p = parse(bytes.toString('utf8'));
    const last = new Map(p.entries.map((e, i) => [e.key, i]));
    return {
      ...base,
      entries: p.entries.map((e, i) => ({ key: e.key, value: e.value, line: e.line, shadowed: last.get(e.key) !== i })),
      unreadable: p.unreadable,
      version: version(bytes),
      tooBig: false,
    };
  }

  /** Sends the project's files now and whenever they change, until
   * `signal` aborts. */
  async watch(project: string, send: (s: EnvState) => void, signal: AbortSignal): Promise<void> {
    let last = '';
    let paths: string[] = [];
    let busy = false;
    const emit = async (rescan: boolean) => {
      if (busy || signal.aborted) return;
      busy = true;
      try {
        const root = this.#root(project);
        let s: EnvState;
        if (rescan || !root) {
          s = await this.state(project);
          paths = s.files.map((f) => f.path);
        } else {
          // Between rescans: only the known files, git's answer kept.
          const git = this.#git.get(project);
          const files = await Promise.all(paths.map((p) => this.#read(root, p, git?.get(p))));
          s = { files: files.filter((f): f is EnvFile => !!f), elsewhere: false };
        }
        const key = JSON.stringify(s);
        if (key !== last && !signal.aborted) {
          last = key;
          send(s);
        }
      } finally {
        busy = false;
      }
    };
    await emit(true);
    const poll = setInterval(() => void emit(false), this.#o.pollEvery);
    const rescan = setInterval(() => void emit(true), this.#o.rescanEvery);
    this.#refreshers.add(emit);
    try {
      await new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener('abort', () => resolve(), { once: true });
      });
    } finally {
      clearInterval(poll);
      clearInterval(rescan);
      this.#refreshers.delete(emit);
    }
  }

  readonly #refreshers = new Set<(rescan: boolean) => Promise<void>>();

  /** Changes a file: `change` gets its text and gives the new one. */
  async #change(project: string, file: unknown, expected: unknown, change: (text: string) => string): Promise<null> {
    const root = this.#root(project);
    if (!root) throw new PluginError('This project’s folder isn’t on this server.');
    const full = this.#file(root, file);
    let bytes: Buffer;
    try {
      bytes = await readFile(full);
    } catch {
      throw new PluginError(`${file} isn’t there any more.`);
    }
    if (bytes.length > MAX_SIZE) throw new PluginError(`${file} is too big to change here.`);
    if (typeof expected === 'string' && expected !== version(bytes)) throw new PluginError(`${file} changed on disk: here it is again, as it is now. Make the change again.`);
    const next = change(bytes.toString('utf8'));
    const mode = (await stat(full)).mode & 0o777;
    await writeFile(`${full}.hyperpane-tmp`, next, { mode });
    await renameFile(`${full}.hyperpane-tmp`, full);
    for (const refresh of this.#refreshers) void refresh(false);
    return null;
  }

  setVar(project: string, file: unknown, key: unknown, value: unknown, expected: unknown) {
    const k = this.#key(key);
    if (typeof value !== 'string') throw new PluginError('A value is text.');
    if (value.length > 65_536) throw new PluginError('That value is too long (64 KB at most).');
    return this.#change(project, file, expected, (text) => set(text, k, value));
  }

  removeVar(project: string, file: unknown, key: unknown, expected: unknown) {
    const k = this.#key(key);
    return this.#change(project, file, expected, (text) => {
      if (!parse(text).entries.some((e) => e.key === k)) throw new PluginError(`${k} isn’t in ${file}.`);
      return remove(text, k);
    });
  }

  renameVar(project: string, file: unknown, key: unknown, to: unknown, expected: unknown) {
    const k = this.#key(key);
    const t = this.#key(to);
    return this.#change(project, file, expected, (text) => {
      const keys = parse(text).entries.map((e) => e.key);
      if (!keys.includes(k)) throw new PluginError(`${k} isn’t in ${file}.`);
      if (k !== t && keys.includes(t)) throw new PluginError(`${file} already has ${t}.`);
      return rename(text, k, t);
    });
  }

  /** A new .env file: empty, or a copy of another (an example's). */
  async create(project: string, file: unknown, from: unknown): Promise<null> {
    const root = this.#root(project);
    if (!root) throw new PluginError('This project’s folder isn’t on this server.');
    const full = this.#file(root, file);
    let text = '';
    if (from !== undefined && from !== null) text = (await readFile(this.#file(root, from)).catch(() => Buffer.from(''))).toString('utf8');
    try {
      await writeFile(full, text, { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new PluginError(`${file} is already there.`);
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new PluginError(`There’s no folder for ${file}.`);
      throw e;
    }
    for (const refresh of this.#refreshers) void refresh(true);
    return null;
  }

  #key(key: unknown): string {
    if (typeof key !== 'string' || !KEY_NAME.test(key)) throw new PluginError(`“${String(key)}” isn’t a variable’s name: letters, digits and _ (and . or -), not starting with a digit.`);
    return key;
  }
}
