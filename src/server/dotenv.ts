// .env files, read and changed line by line: a change touches only the
// variable's own lines, so comments, blank lines, order, `export`, quotes
// elsewhere and line endings stay as they were.
//
// What's read (as dotenv does): `KEY=value` and `export KEY=value`;
// values bare (up to a ` #` comment), in 'single' quotes (as they are), in
// "double" quotes (with \n, \r, \t, \" and \\) or `backticks`, any quoted
// one over several lines; `#` lines are comments. Anything else is kept
// and counted as a line it couldn't read.

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
    if (!trimmed || trimmed.startsWith('#')) continue;
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
      entries.push({ key, value: q === '"' ? unescape(raw) : raw, start: i, end, line: i + 1, prefix, comment: /^\s*#/.test(after) ? after : '' });
      i = end;
    } else {
      // Bare: up to a comment (` #`), trimmed.
      const hash = rest.search(/(^|\s)#/);
      const before = hash < 0 ? rest : rest.slice(0, hash);
      // The comment with the spaces before it, as they were.
      const comment = hash < 0 ? '' : rest.slice(before.trimEnd().length);
      entries.push({ key, value: before.trim(), start: i, end: i, line: i + 1, prefix, comment: comment && !/^\s/.test(comment) ? ` ${comment}` : comment });
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

/** The file with KEY set to value: its line changed where it is (the last
 * one, when it's there twice), or a new line at the end. */
export function set(source: string, key: string, value: string): string {
  const p = parse(source);
  const e = p.entries.filter((x) => x.key === key).at(-1);
  const line = (prefix: string, comment: string) => `${prefix}${key}=${encode(value)}${comment}`;
  if (e) {
    p.lines.splice(e.start, e.end - e.start + 1, line(e.prefix, e.comment));
  } else {
    // A new one goes after the last line that isn't blank.
    let at = p.lines.length;
    while (at > 0 && !p.lines[at - 1].trim()) at--;
    p.lines.splice(at, 0, line('', ''));
    if (p.lines.length === 1) p.finalEol = true;
  }
  return text(p);
}

/** The file without KEY (every line of it, each time it's there). */
export function remove(source: string, key: string): string {
  const p = parse(source);
  for (const e of [...p.entries].reverse()) if (e.key === key) p.lines.splice(e.start, e.end - e.start + 1);
  return text(p);
}

/** The file with KEY called TO, its value and place kept. */
export function rename(source: string, key: string, to: string): string {
  const p = parse(source);
  for (const e of p.entries) {
    if (e.key !== key) continue;
    const first = p.lines[e.start];
    const at = first.indexOf(key, e.prefix.length);
    p.lines[e.start] = first.slice(0, at) + to + first.slice(at + key.length);
  }
  return text(p);
}

