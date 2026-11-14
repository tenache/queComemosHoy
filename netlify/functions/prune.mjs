// Every hour, deletes what the friends' groups (#23) promise not to keep:
// picks older than 3 days, picks of people who left, and members not seen
// for LIMITS.inactiveDays. Netlify runs scheduled functions on the published
// deploy only; they have no public address.

import { prune } from '../group-core.mjs';
import { groupStore } from '../store.mjs';

export default async (request, context) => {
  const deleted = await prune(groupStore(context));
  // The context shows the run cleaned the real groups ('production'), not the preview store.
  console.log(`prune (${context?.deploy?.context}): deleted ${deleted} keys`);
};

// Hourly, so "se borran a los 3 días" holds to within an hour, even in a group with no new picks.
export const config = { schedule: '@hourly' };
