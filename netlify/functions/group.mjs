// The friends' group (#23): POST /api/group. The logic is in ../group-core.mjs,
// the store in ../store.mjs.

import { handle } from '../group-core.mjs';
import { groupStore } from '../store.mjs';

export default async (request, context) => handle(request, groupStore(context));

export const config = {
  path: '/api/group',
  // Per phone (IP): a phone lists every few minutes and sends a pick now and
  // then, so this only stops someone hammering the endpoint. Netlify answers 429.
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
