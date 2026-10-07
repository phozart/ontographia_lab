// pages/api/diagrams/[id]/access.js
// GET - who has access to this diagram (owner, direct members). Requires share.read (editor and owner).
// `invitations` and `links` are empty until the invitation (slice 7) and share-link (slice 6) slices.

import { withDiagramAuth } from '../../../../lib/authz/next';
import { memberRepository } from '../../../../lib/memberRepository';

export default withDiagramAuth({ GET: 'share.read' }, async (req, res, { diagram, user, role }) => {
  const access = await memberRepository.listAccess(diagram.id);
  return res.status(200).json({
    owner: access.owner,
    members: access.members,
    invitations: [],
    links: [],
    you: { userId: user.id, role },
  });
});
