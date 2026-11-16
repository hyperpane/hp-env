// .env files, read and changed line by line: a change touches only the
// variable's own lines, so comments, blank lines, order, `export`, quotes
// elsewhere and line endings stay as they were.
//
// What's read (as dotenv does): `KEY=value` and `export KEY=value`;
// values bare (up to a ` #` comment), in 'single' quotes (as they are), in
// "double" quotes (with \n, \r, \t, \" and \\) or `backticks`, any quoted
// one over several lines; `#` lines are comments. A comment that is a
// variable (`# KEY=value`, `#export KEY=value`: the name right before the
// `=`, on one line) is a disabled one: shown, and turned on by taking its
// `#` away. Anything else is kept and counted as a line it couldn't read.

export interface Entry {
  key: string;
  value: string;
  /** Its first and last line (0-based). */
  start: number;
  end: number;
  /** 1-based, for people. */
  line: number;
  /** What came before the key (spaces, `export `). */
  prefix: string;
  /** A comment after the value (` # …`), kept when it's changed. */
  comment: string;
  /** Commented out (`# KEY=value`): there, but not used. */
  disabled: boolean;
  /** What comments it out (`# `, `#`), '' when it's on. */
  hash: string;
}

export interface Parsed {
  lines: string[];
  eol: '\n' | '\r\n';
  /** The file ends with a line break. */
  finalEol: boolean;
  entries: Entry[];
  /** Lines that aren't a variable, a comment or blank (1-based). */
  unreadable: number[];
}

const KEY = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s?(.*)$/;
/** A commented-out variable: `#`, perhaps a space, then a variable. */
const DISABLED = /^(\s*#+\s*)((?:export\s+)?)([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s?(.*)$/;

/** A value on one line: quoted (to its quote) or bare (to a ` #`), and the
 * comment after it; null when a quote isn't closed on the line. */
function oneLine(rest: string): { value: string; comment: string } | null {
  const q = rest[0];
  if (q === '"' || q === "'" || q === '`') {
    const body = rest.slice(1);
    const close = closing(body, q);
    if (close < 0) return null;
    const after = body.slice(close + 1);
    const raw = body.slice(0, close);
    return { value: q === '"' ? unescape(raw) : raw, comment: /^\s*#/.test(after) ? after : '' };
  }
  const hash = rest.search(/(^|\s)#/);
  const before = hash < 0 ? rest : rest.slice(0, hash);
  const comment = hash < 0 ? '' : rest.slice(before.trimEnd().length);
  return { value: before.trim(), comment: comment && !/^\s/.test(comment) ? ` ${comment}` : comment };
}

export function parse(text: string): Parsed {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const finalEol = text.endsWith('\n');
  const lines = text.split(/\r?\n/);
  if (finalEol) lines.pop();
  const entries: Entry[] = [];
  const unreadable: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      const d = DISABLED.exec(line);
      const v = d ? oneLine(d[4].replace(/^\s+/, '')) : null;
      if (d && v) entries.push({ key: d[3], value: v.value, start: i, end: i, line: i + 1, prefix: d[2], comment: v.comment, disabled: true, hash: d[1] });
      continue;
    }
    const m = KEY.exec(line);
    if (!m) {
      unreadable.push(i + 1);
      continue;
    }
    const [, prefix, key] = m;
    const rest = m[3].replace(/^\s+/, '');
    const q = rest[0];
    if (q === '"' || q === "'" || q === '`') {
      // Quoted: to the closing quote, perhaps lines later.
      let body = rest.slice(1);
      let end = i;
      let close = closing(body, q);
      while (close < 0 && end + 1 < lines.length) {
        end++;
        body += `\n${lines[end]}`;
        close = closing(body, q);
      }
      if (close < 0) {
        unreadable.push(i + 1);
        continue;
      }
      const raw = body.slice(0, close);
      const after = body.slice(close + 1);
      entries.push({
        key,
        value: q === '"' ? unescape(raw) : raw,
        start: i,
        end,
        line: i + 1,
        prefix,
        comment: /^\s*#/.test(after) ? after : '',
        disabled: false,
        hash: '',
      });
      i = end;
    } else {
      // Bare: up to a comment (` #`), trimmed.
      const hash = rest.search(/(^|\s)#/);
      const before = hash < 0 ? rest : rest.slice(0, hash);
      // The comment with the spaces before it, as they were.
      const comment = hash < 0 ? '' : rest.slice(before.trimEnd().length);
      entries.push({
        key,
        value: before.trim(),
        start: i,
        end: i,
        line: i + 1,
        prefix,
        comment: comment && !/^\s/.test(comment) ? ` ${comment}` : comment,
        disabled: false,
        hash: '',
      });
    }
  }
  return { lines, eol, finalEol, entries, unreadable };
}

/** Where the closing quote is, skipping escaped ones in "…" and `…`. */
function closing(body: string, q: string): number {
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\' && q !== "'") {
      i++;
      continue;
    }
    if (body[i] === q) return i;
  }
  return -1;
}

function unescape(raw: string): string {
  return raw.replace(/\\(.)/gs, (_, c: string) => ({ n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' })[c] ?? `\\${c}`);
}

/** A value as it's written: bare when it can be, 'single' quotes when it
 * has spaces or #, "double" with escapes for line breaks or quotes. */
export function encode(value: string): string {
  if (value === '') return '';
  if (/^[^\s'"`#\\]+$/.test(value)) return value;
  if (!/[\n\r']/.test(value)) return `'${value}'`;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
}

export function text(p: Parsed): string {
  return p.lines.join(p.eol) + (p.finalEol || p.lines.length === 0 ? p.eol : '');
}

/** The entry an edit is about: the one on `line` (1-based) when it's
 * given, else the KEY that counts (the last one on). */
function pick(p: Parsed, key: string, line?: number): Entry | undefined {
  if (line !== undefined) return p.entries.find((e) => e.line === line && e.key === key);
  return p.entries.filter((e) => e.key === key && !e.disabled).at(-1);
}

const write = (e: Pick<Entry, 'hash' | 'prefix' | 'comment'>, key: string, value: string) => `${e.hash}${e.prefix}${key}=${encode(value)}${e.comment}`;

/** The file with KEY set to value: its line changed where it is (the one on
 * `line`, or the one that counts; a disabled one stays disabled), or a new
 * line at the end. */
export function set(source: string, key: string, value: string, line?: number): string {
  const p = parse(source);
  const e = pick(p, key, line);
  if (e) {
    p.lines.splice(e.start, e.end - e.start + 1, write(e, key, value));
  } else {
    // A new one goes after the last line that isn't blank.
    let at = p.lines.length;
    while (at > 0 && !p.lines[at - 1].trim()) at--;
    p.lines.splice(at, 0, write({ hash: '', prefix: '', comment: '' }, key, value));
    if (p.lines.length === 1) p.finalEol = true;
  }
  return text(p);
}

/** The file without KEY: the one on `line`, or every line of it (on and
 * off). */
export function remove(source: string, key: string, line?: number): string {
  const p = parse(source);
  for (const e of [...p.entries].reverse()) if (e.key === key && (line === undefined || e.line === line)) p.lines.splice(e.start, e.end - e.start + 1);
  return text(p);
}

/** The file with KEY called TO (the one on `line`, or every one), its value
 * and place kept. */
export function rename(source: string, key: string, to: string, line?: number): string {
  const p = parse(source);
  for (const e of p.entries) {
    if (e.key !== key || (line !== undefined && e.line !== line)) continue;
    const first = p.lines[e.start];
    const at = first.indexOf(key, e.hash.length + e.prefix.length);
    p.lines[e.start] = first.slice(0, at) + to + first.slice(at + key.length);
  }
  return text(p);
}

/** Turns the variable on `line` on (its `#` taken away, and any other line
 * of it that's on turned off, so it's the one that counts) or off (`# `
 * before each of its lines). */
export function toggle(source: string, line: number, on: boolean): string {
  const p = parse(source);
  const e = p.entries.find((x) => x.line === line);
  if (!e) return source;
  const off = (x: Entry) => {
    for (let i = x.start; i <= x.end; i++) p.lines[i] = `# ${p.lines[i]}`;
  };
  if (on) {
    if (!e.disabled) return source;
    p.lines[e.start] = p.lines[e.start].slice(e.hash.length);
    for (const x of p.entries) if (x !== e && x.key === e.key && !x.disabled) off(x);
  } else {
    if (e.disabled) return source;
    off(e);
  }
  return text(p);
}
