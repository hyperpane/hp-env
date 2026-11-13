// The server part: reads and changes the project's .env files where they
// are, on the server.

import { serve } from '@hyperpane/sdk/server';
import { plugin } from './plugin.ts';

serve(plugin);
