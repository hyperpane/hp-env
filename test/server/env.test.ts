// The server part on a real folder (and a real git, when there is one):
// finding the files, git's warnings, changes refused on a file that changed
// since, new files, nothing outside the project, and the watch.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { invoke, stream, testHost } from '@hyperpane/sdk/testing';
import { make } from '../../src/server/plugin.ts';
import type { EnvState } from '../../src/shared/index.ts';

let git = true;
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  git = false;
}

function project() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const host = testHost({ id: 'env', projects: [{ id: 'p1', name: 'app', folder: dir }] });
  const plugin = make({ pollEvery: 30, rescanEvery: 60 })(host);
  const state = () => invoke<EnvState>(plugin, { op: 'state', project: 'p1' });
  const call = (req: Record<string, unknown>) => invoke(plugin, { project: 'p1', ...req });
  const write = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  return { dir, plugin, state, call, write, read: (rel: string) => readFileSync(path.join(dir, rel), 'utf8') };
}

test('finds the .env files, not those in node_modules, the project’s own first', async () => {
  const p = project();
  p.write('.env', 'A=1\n');
  p.write('.env.example', 'A=\nB=placeholder\n');
  p.write('apps/web/.env.local', 'C=3\n');
  p.write('docker/prod.env', 'D=4\n');
  p.write('node_modules/x/.env', 'NO=1\n');
  p.write('a/b/c/d/.env', 'TOO_DEEP=1\n');
  p.write('.envrc', 'not one\n');
  const s = await p.state();
  assert.deepEqual(
    s.files.map((f) => f.path),
    ['.env', '.env.example', 'docker/prod.env', 'apps/web/.env.local'],
  );
  assert.equal(s.files[1].example, true);
  assert.deepEqual(
    s.files[1].entries.map((e) => [e.key, e.value]),
    [
      ['A', ''],
      ['B', 'placeholder'],
    ],
  );
});

test('git: a committed secrets file, and one git doesn’t ignore', { skip: !git }, async () => {
  const p = project();
  const g = (...a: string[]) => execFileSync('git', ['-C', p.dir, ...a], { stdio: 'ignore' });
  g('init', '-q');
  p.write('.gitignore', '.env.local\n');
  p.write('.env', 'SECRET=1\n');
  p.write('.env.local', 'SECRET=2\n');
  p.write('.env.production', 'SECRET=3\n');
  p.write('.env.example', 'SECRET=\n');
  g('add', '.env', '.env.example', '.gitignore');
  const files = Object.fromEntries((await p.state()).files.map((f) => [f.path, f]));
  assert.deepEqual([files['.env'].tracked, files['.env'].ignored], [true, false]);
  assert.deepEqual([files['.env.local'].tracked, files['.env.local'].ignored], [false, true]);
  assert.deepEqual([files['.env.production'].tracked, files['.env.production'].ignored], [false, false]);
  assert.equal(files['.env.example'].tracked, true);
});

test('not a repository: git can’t say', async () => {
  const p = project();
  p.write('.env', 'A=1\n');
  const [f] = (await p.state()).files;
  assert.equal(f.tracked, null);
  assert.equal(f.ignored, null);
});

test('changes keep the rest of the file, and are refused on a file that changed since', async () => {
  const p = project();
  p.write('.env', '# comment\nA=1 # one\nB=2\n');
  let [f] = (await p.state()).files;
  await p.call({ op: 'set', file: '.env', key: 'A', value: 'new value', version: f.version });
  assert.equal(p.read('.env'), "# comment\nA='new value' # one\nB=2\n");
  // Someone else changed it: the old version is refused.
  p.write('.env', '# comment\nA=edited\nB=2\n');
  await assert.rejects(p.call({ op: 'set', file: '.env', key: 'B', value: 'x', version: f.version }), /changed on disk/);
  assert.equal(p.read('.env'), '# comment\nA=edited\nB=2\n');
  [f] = (await p.state()).files;
  await p.call({ op: 'set', file: '.env', key: 'C', value: '3', version: f.version });
  [f] = (await p.state()).files;
  await p.call({ op: 'rename', file: '.env', key: 'B', to: 'BEE', version: f.version });
  [f] = (await p.state()).files;
  await p.call({ op: 'remove', file: '.env', key: 'A', version: f.version });
  assert.equal(p.read('.env'), '# comment\nBEE=2\nC=3\n');
  [f] = (await p.state()).files;
  await assert.rejects(p.call({ op: 'rename', file: '.env', key: 'BEE', to: 'C', version: f.version }), /already has C/);
  await assert.rejects(p.call({ op: 'set', file: '.env', key: '1BAD', value: 'x', version: f.version }), /isn’t a variable’s name/);
});

test('a new file, from the example; never outside the project, never anything but a .env file', async () => {
  const p = project();
  p.write('.env.example', 'A=\n# needed\nB=placeholder\n');
  await p.call({ op: 'create', file: '.env', from: '.env.example' });
  assert.equal(p.read('.env'), 'A=\n# needed\nB=placeholder\n');
  await assert.rejects(p.call({ op: 'create', file: '.env' }), /already there/);
  await assert.rejects(p.call({ op: 'create', file: '../.env' }), /isn’t a file in this project/);
  await assert.rejects(p.call({ op: 'create', file: '/etc/.env' }), /isn’t a file in this project/);
  await assert.rejects(p.call({ op: 'set', file: 'package.json', key: 'A', value: '1' }), /isn’t a \.env file/);
  await assert.rejects(p.call({ op: 'create', file: 'missing/dir/.env' }), /no folder/);
});

test('watching: a change on disk, and a new file, arrive by themselves', async () => {
  const p = project();
  p.write('.env', 'A=1\n');
  const s = stream<EnvState>(p.plugin, { op: 'watch', project: 'p1' });
  const first = await s.next();
  assert.equal(first.files[0].entries[0].value, '1');
  p.write('.env', 'A=2\n');
  for (;;) if ((await s.next()).files[0]?.entries[0]?.value === '2') break;
  p.write('.env.local', 'B=1\n');
  for (;;) if ((await s.next()).files.some((f) => f.path === '.env.local')) break;
  s.cancel();
});
