// Reading .env files as dotenv does, and changing one variable while every
// other byte stays as it was.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encode, parse, remove, rename, set, toggle } from '../../src/server/dotenv.ts';

const FILE = `# The database
DATABASE_URL=postgres://localhost/app   # local
export API_KEY="abc\\"def"
SINGLE='it''s #not a comment'
EMPTY=
SPACED = some value with spaces
MULTI="line one
line two"
  INDENTED=yes
not a variable
TWICE=first
TWICE=second
`;

test('reads what dotenv reads', () => {
  const p = parse(FILE);
  const v = Object.fromEntries(p.entries.map((e) => [e.key, e.value]));
  assert.equal(v.DATABASE_URL, 'postgres://localhost/app');
  assert.equal(v.API_KEY, 'abc"def');
  assert.equal(v.SINGLE, 'it');
  assert.equal(v.EMPTY, '');
  assert.equal(v.SPACED, 'some value with spaces');
  assert.equal(v.MULTI, 'line one\nline two');
  assert.equal(v.INDENTED, 'yes');
  assert.equal(v.TWICE, 'second', 'the last one counts');
  assert.deepEqual(p.unreadable, [10]);
  assert.equal(p.entries.find((e) => e.key === 'MULTI')!.line, 7);
});

test('a change touches only that variable’s lines', () => {
  const out = set(FILE, 'DATABASE_URL', 'postgres://db/prod');
  assert.equal(out, FILE.replace('postgres://localhost/app   # local', 'postgres://db/prod   # local'));
  assert.equal(set(FILE, 'MULTI', 'one line'), FILE.replace('MULTI="line one\nline two"', "MULTI='one line'"));
  // export and indentation are kept.
  assert.match(set(FILE, 'API_KEY', 'x'), /^export API_KEY=x$/m);
  assert.match(set(FILE, 'INDENTED', 'no'), /^ {2}INDENTED=no$/m);
  // Twice: the one that counts changes.
  assert.match(set(FILE, 'TWICE', 'third'), /TWICE=first\nTWICE=third\n$/);
});

test('a new variable goes at the end; removing takes every line of it', () => {
  assert.equal(set('A=1\n\n\n', 'B', '2'), 'A=1\nB=2\n\n\n');
  assert.equal(set('', 'A', '1'), 'A=1\n');
  assert.equal(set('A=1', 'B', '2'), 'A=1\nB=2');
  assert.equal(remove(FILE, 'MULTI'), FILE.replace('MULTI="line one\nline two"\n', ''));
  assert.equal(remove(FILE, 'TWICE'), FILE.replace('TWICE=first\nTWICE=second\n', ''));
  assert.equal(rename(FILE, 'API_KEY', 'TOKEN'), FILE.replace('export API_KEY=', 'export TOKEN='));
});

test('Windows line endings stay', () => {
  const crlf = 'A=1\r\n# x\r\nB=2\r\n';
  assert.equal(set(crlf, 'B', '3'), 'A=1\r\n# x\r\nB=3\r\n');
  assert.equal(set(crlf, 'C', '4'), 'A=1\r\n# x\r\nB=2\r\nC=4\r\n');
});

test('values are written so they read back the same', () => {
  for (const value of ['plain', '', 'has space', 'a#b', 'it\'s', 'say "hi"', 'two\nlines', 'back\\slash', '=equals=', ' padded ', 'tab\there', "both ' and \""]) {
    const back = parse(`K=${encode(value)}\n`).entries[0].value;
    assert.equal(back, value, `${JSON.stringify(value)} written as ${encode(value)}`);
  }
});

test('a commented variable is a disabled one; a plain comment isn’t', () => {
  const p = parse('# Database\n# DATABASE_URL=postgres://prod\nDATABASE_URL=postgres://local\n#export TOKEN="a b" # old\n#   DEBUG=1\n# Set this = later\n## Notes\n');
  assert.deepEqual(
    p.entries.map((e) => [e.key, e.value, e.line, e.disabled]),
    [
      ['DATABASE_URL', 'postgres://prod', 2, true],
      ['DATABASE_URL', 'postgres://local', 3, false],
      ['TOKEN', 'a b', 4, true],
      ['DEBUG', '1', 5, true],
    ],
  );
  assert.deepEqual(p.unreadable, []);
});

test('turning one on turns the other of its name off, as written', () => {
  const src = '# DATABASE_URL=postgres://prod\nDATABASE_URL=postgres://local\n';
  assert.equal(toggle(src, 1, true), 'DATABASE_URL=postgres://prod\n# DATABASE_URL=postgres://local\n');
  assert.equal(toggle(src, 2, false), '# DATABASE_URL=postgres://prod\n# DATABASE_URL=postgres://local\n');
  assert.equal(toggle('#export TOKEN=x # old\r\n', 1, true), 'export TOKEN=x # old\r\n');
  assert.equal(toggle(src, 2, true), src);
});

test('an edit goes to its own line: a disabled one stays disabled', () => {
  const src = '# URL=prod\nURL=local\n';
  assert.equal(set(src, 'URL', 'staging', 1), '# URL=staging\nURL=local\n');
  assert.equal(set(src, 'URL', 'dev'), '# URL=prod\nURL=dev\n');
  assert.equal(remove(src, 'URL', 1), 'URL=local\n');
  assert.equal(rename(src, 'URL', 'OLD_URL', 1), '# OLD_URL=prod\nURL=local\n');
  assert.equal(remove(src, 'URL'), '\n');
});
