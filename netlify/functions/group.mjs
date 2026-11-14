// The friends' group (#23): POST /api/group. The logic is in ../group-core.mjs;
// this file only picks the store. Deploy previews and branch deploys get their
// own store, so testing a PR never reaches real groups.

import { getStore } from '@netlify/blobs';

import { handle } from '../group-core.mjs';

export default async (request, context) => {
  const name = context.deploy?.context === 'production' ? 'groups' : 'groups-preview';
  return handle(request, getStore({ name, consistency: 'strong' }));
};

export const config = { path: '/api/group' };
