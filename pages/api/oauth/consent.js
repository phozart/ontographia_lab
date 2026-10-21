// pages/api/oauth/consent.js
// POST /api/oauth/consent: approve / deny / switch account for a pending authorization request (ADR-0005 5.4).
import { createConsentHandler } from '../../../lib/oauth/consentEndpoint';
import { getServerUser } from '../../../lib/useAuth';

export default createConsentHandler({ getUser: getServerUser });
