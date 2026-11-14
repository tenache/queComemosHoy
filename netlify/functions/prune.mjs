// Once a day, deletes what the friends' groups (#23) promise not to keep:
// picks older than 3 days, picks of people who left, and members not seen
// for LIMITS.inactiveDays. Netlify runs scheduled functions on the published
// deploy only; they have no public address.

import { prune } from '../group-core.mjs';
import { groupStore } from '../store.mjs';

export default async (request, context) => {
  const deleted = await prune(groupStore(context));
  console.log(`prune: deleted ${deleted} keys`);
};

export const config = { schedule: '@daily' };
