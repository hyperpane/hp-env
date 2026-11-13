// The server part's calls, apart from main.ts so the tests can make it with
// a test host: `watch` (the project's .env files, again on every change),
// `state`, `set`, `remove`, `rename` and `create`.

import { type Host, json } from '@hyperpane/sdk/server';
import { Env, type Options } from './env.ts';

export function make(o: Options = {}) {
  return json((host: Host) => {
    const env = new Env(host, o);
    return {
      calls: {
        state: ({ project }) => env.state(String(project)),
        set: ({ project, file, key, value, version }) => env.setVar(String(project), file, key, value, version),
        remove: ({ project, file, key, version }) => env.removeVar(String(project), file, key, version),
        rename: ({ project, file, key, to, version }) => env.renameVar(String(project), file, key, to, version),
        create: ({ project, file, from }) => env.create(String(project), file, from),
      },
      subscriptions: {
        watch: ({ project }, out) => env.watch(String(project), (s) => out.emit(s), out.signal),
      },
    };
  });
}

export const plugin = make();
