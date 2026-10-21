// pages/oauth/authorize.js
// GET /oauth/authorize: the authorization endpoint (ADR-0005 5.2). Validation, login detour and the consent screen.
// Errors found before client_id and redirect_uri are validated are shown HERE and never redirected.

import Head from 'next/head';
import { signOut } from 'next-auth/react';
import ConsentForm from '../../components/oauth/ConsentForm';
import { isOAuthEnabled } from '../../lib/oauth/config';
import { runAuthorizeFlow } from '../../lib/oauth/authorizeFlow';
import { rateLimit, getClientId } from '../../lib/rateLimit';

const limiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'oauth-authorize' });
// Per address cap on NEW requests (the ones that store a row): 10 every 10 minutes.
const newRequestLimiter = rateLimit({ interval: 10 * 60 * 1000, limit: 10, prefix: 'oauth-authorize-new' });

const MESSAGES = {
  disabled: ['Sign-in for connected apps is not available', 'This server does not accept connected apps right now. You can still use a personal API token (Account, API tokens).'],
  unknown_client: ['Unknown app', 'This app is not allowed to connect to Ontographia Lab. Nothing was shared.'],
  client_unavailable: ['App unavailable', 'We could not verify the app that sent you here. Try again in a few minutes.'],
  invalid_redirect_uri: ['Invalid request', 'The app sent an address that is not registered for it. Nothing was shared.'],
  expired: ['Request expired', 'This sign-in request has expired or was already used. Start again from the app.'],
  inactive: ['Account not active', 'Your account is not active yet, so it cannot be connected.'],
  other_user: ['Different account', 'This request was opened by another account. Start again from the app.'],
  too_many_pending: ['Too many requests', 'You have too many unfinished sign-in requests. Wait a few minutes and start again from the app.'],
  busy: ['Busy', 'Too many sign-in requests are waiting right now. Please try again in a few minutes.'],
  rate_limited: ['Too many requests', 'Please wait a minute and try again.'],
};

export async function getServerSideProps({ req, res, query }) {
  res.setHeader('Cache-Control', 'no-store');
  // same-origin, not no-referrer: with no-referrer browsers send `Origin: null` on the consent form POST (Fetch spec), which
  // the same-origin check rightly refuses. same-origin still sends no Referer (so no rid) to any other site.
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  if (!isOAuthEnabled()) return { props: { view: 'error', code: 'disabled' } };
  if (!limiter.consume(getClientId(req)).success) {
    res.statusCode = 429;
    return { props: { view: 'error', code: 'rate_limited' } };
  }

  if (query.rid === undefined && !newRequestLimiter.consume(getClientId(req)).success) {
    res.statusCode = 429;
    return { props: { view: 'error', code: 'rate_limited' } };
  }

  let user = null;
  if (query.rid !== undefined) {
    const { getServerUser } = await import('../../lib/useAuth');
    user = await getServerUser(req, res);
  }
  const out = await runAuthorizeFlow({ query, user });
  if (out.type === 'redirect') return { redirect: { destination: out.destination, permanent: false } };
  if (out.type === 'login') return { redirect: { destination: `/login?callbackUrl=${encodeURIComponent(out.callbackUrl)}`, permanent: false } };
  if (out.type === 'error') {
    res.statusCode = out.code === 'unknown_client' || out.code === 'invalid_redirect_uri' ? 400 : 200;
    return { props: { view: 'error', code: MESSAGES[out.code] ? out.code : 'expired' } };
  }
  return { props: { view: 'consent', consent: out.props } };
}

export default function OAuthAuthorize({ view, code, consent }) {
  if (view === 'consent') {
    return (
      <>
        <Head>
          <title>Connect an app | Ontographia Lab</title>
          <meta name="robots" content="noindex" />
        </Head>
        <ConsentForm {...consent} />
      </>
    );
  }
  const [title, body] = MESSAGES[code] || MESSAGES.expired;
  return (
    <main style={{ maxWidth: 480, margin: '15vh auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <Head>
        <title>{title} | Ontographia Lab</title>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 style={{ fontSize: 22 }}>{title}</h1>
      <p>{body}</p>
      {code === 'other_user' && (
        <p><button type="button" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button></p>
      )}
    </main>
  );
}
