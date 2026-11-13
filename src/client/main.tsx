// The client part: the Env window. The files are read and written by the
// server part, where the project is.

import { mount } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';
import { EnvView } from './EnvView.tsx';

mount((host) => (host.view.type === 'node' && host.view.kind === 'env' ? <EnvView /> : <NodeMessage error>Env has no “{host.view.type}” view here.</NodeMessage>));
