// pages/oauth/authorize.js
// Placeholder until slice O2 ships the authorization endpoint (ADR-0005). Never redirects anywhere.
import Head from 'next/head';

export default function OAuthAuthorize() {
  return (
    <main style={{ maxWidth: 480, margin: '15vh auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <Head>
        <title>Sign-in not available | Ontographia Lab</title>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 style={{ fontSize: 22 }}>Sign-in for connected apps is not available yet</h1>
      <p>Connecting apps with this flow is not enabled on this server. You can still use a personal API token (Account, API tokens).</p>
    </main>
  );
}
