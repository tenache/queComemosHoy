// The blob store of the friends' group (#23), shared by the functions.
// Only published production deploys use the real groups; deploy previews,
// branch deploys and `netlify dev` get their own store, so testing a PR
// never reaches real groups.

import { getStore } from '@netlify/blobs';

export function groupStore(context) {
  const name = context?.deploy?.context === 'production' ? 'groups' : 'groups-preview';
  return getStore({ name, consistency: 'strong' });
}
