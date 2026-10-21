# ADR-0005 — OAuth sign-in for the MCP server (claude.ai, Desktop, mobile)

- Status: **Accepted** (2026-10-21). O1 implemented; see "As built" at the end
- Supersedes: slice **M5** in [mcp-and-embedding.md](../investigations/mcp-and-embedding.md) §6 (scope sharpened here)
- Personas: **AI/MCP agent** (primary): the same agent principal, reached from hosted Claude apps instead of only from developer hosts. Solution Architect, CX/UX and PM benefit indirectly: they can work on their maps from claude.ai or a phone.
- Primitive exposed: **connected app** (an OAuth grant: user × client × role cap × diagram allowlist), a sibling of the personal API token. No new authorization concepts: both resolve to the existing `agent` principal.

## 1. Context

- `/api/mcp` (stateless Streamable HTTP, `@modelcontextprotocol/sdk` 1.32.1) accepts only personal bearer tokens `ogl_…` (`lib/apiTokens.js`, migrations 0004/0009). A token carries a role cap (viewer/commenter/editor) and an optional diagram allowlist; an editor cap requires an allowlist (Q-MCP2). `verifyToken` maps it to `{kind:'agent', userId, tokenId, roleCap, diagramScope}`, and `lib/authz` computes `min(user role, cap)` inside the allowlist.
- Developer hosts (Claude Code, Cursor, VS Code) send that token as a header. **claude.ai, Claude Desktop and the Claude mobile apps cannot**: their custom connectors sign in with the MCP authorization flow (OAuth 2.1). So the lab cannot be used from the web or a phone today.
- Users sign in with next-auth v4 (JWT sessions, 30 days; email/password plus Google/GitHub). next-auth is an OAuth _client_, not an authorization server (AS).
- One Node process behind nginx, PostgreSQL, in-memory rate limiters.

## 2. Research (accessed 2026-10-21)

**MCP authorization spec.** The current revision is **2026-07-28**; 2025-11-25 is the previous one. Both require: the MCP server **MUST** publish Protected Resource Metadata (RFC 9728) and point to it from a `401` `WWW-Authenticate` header or a well-known URI; the AS **MUST** publish RFC 8414 or OIDC discovery metadata; clients **MUST** use PKCE S256 and refuse an AS whose metadata lacks `code_challenge_methods_supported`; clients **MUST** send `resource` (RFC 8707) on authorize and token requests, and servers **MUST** accept only tokens issued for them (no passthrough); the AS **MUST** validate exact redirect URIs and **MUST** rotate refresh tokens for public clients. Client ID Metadata Documents (CIMD) are **SHOULD**. Dynamic Client Registration (DCR, RFC 7591) is **MAY** and, in 2026-07-28, **deprecated** and kept for backwards compatibility. New in 2026-07-28: the AS **SHOULD** return `iss` in authorization responses (RFC 9207) and advertise `authorization_response_iss_parameter_supported`; the PRM **SHOULD NOT** list `offline_access`. For CIMD the AS **MUST** display the redirect URI host, **SHOULD** guard the metadata fetch against SSRF, and **MAY** apply a domain allowlist. [S1, S2]

**What Claude's connectors do today** (Claude docs, pages current on 2026-10-21) [S3, S4, S5]:

| Topic           | Behavior                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces        | One auth infrastructure for claude.ai, Desktop, mobile and Cowork. Custom connectors are added by URL on Free (one connector), Pro, Max, Team and Enterprise plans                                                                                                                                                                              |
| Client identity | "Use Claude's published identity" (CIMD, recommended), "Register automatically" (DCR), or "Use your own OAuth client" (client ID, optional secret). Claude picks CIMD **only if** the AS metadata has `client_id_metadata_document_supported: true` **and** `"none"` in `token_endpoint_auth_methods_supported`; otherwise it falls back to DCR |
| Hosted client   | `client_id` = `https://claude.ai/oauth/mcp-oauth-client-metadata`, `token_endpoint_auth_method: none`, single redirect URI `https://claude.ai/api/mcp/auth_callback` (docs warn it may move to `https://claude.com/api/mcp/auth_callback`)                                                                                                      |
| Claude Code     | Own CIMD `https://claude.ai/oauth/claude-code-client-metadata`, loopback redirects `http://localhost/callback` and `http://127.0.0.1/callback` on any port                                                                                                                                                                                      |
| Discovery       | Sign-in starts **only** on HTTP `401` with `WWW-Authenticate: Bearer resource_metadata="…"`; the PRM `resource` must equal the URL the user entered; only the first `authorization_servers` entry is used; RFC 8414 is tried before OIDC discovery; discovery is cached about five minutes                                                      |
| PKCE / scopes   | Always S256. Scopes: the `scope` in the 401 challenge, else PRM `scopes_supported`; `offline_access` appended when the AS lists it                                                                                                                                                                                                              |
| Tokens          | Token endpoint must accept `application/x-www-form-urlencoded`. Refresh proactively up to five minutes before expiry and on `401`; rotation expected for public clients; an invalid refresh token must yield `invalid_grant`. Timeouts: 10 s (discovery, token), 30 s (refresh)                                                                 |
| Step-up         | `403` + `WWW-Authenticate: Bearer error="insufficient_scope", scope="…"` triggers re-authorization; any other `403` is terminal; a `200` tool error never triggers sign-in                                                                                                                                                                      |
| Network         | Requests come from Anthropic's egress range `160.79.104.0/21`; redirects to another host drop the `Authorization` header                                                                                                                                                                                                                        |
| Request headers | A static `Authorization` header can be configured instead of OAuth, but only in a **limited beta** for some organizations [S4]                                                                                                                                                                                                                  |

**Origin header.** Claude's docs say nothing about it. Two independent public reports say the hosted connector sends **`Origin: https://claude.ai`**: a 2026-09-08 issue on the Claude MCP tracker (an SDK origin guard returned 403 until it was allowlisted) and a 2026-10-13 server change that set `MCP_ALLOWED_ORIGINS = "claude.ai,claude.com"` to stop the same 403 [S6, S7]. **Our `/api/mcp` would answer that request with 403 before the 401**, so discovery would never start. Treat this as likely but unverified; slice O1 confirms it from logs.

**SDK support.** 1.32.1 ships an Express-based AS kit (`mcpAuthRouter`, `authorizationHandler`, `tokenHandler`, `OAuthServerProvider`, `requireBearerAuth`) built around DCR. It has CIMD fields in its metadata schemas but no server-side CIMD fetching. In SDK v2 these AS helpers are **frozen and deprecated** (`@modelcontextprotocol/server-legacy/auth`), with advice to use a dedicated OAuth library [S8]. Useful to us: the zod metadata and token schemas, `redirectUriMatches` (RFC 8252 loopback rule), and the SDK _client_ `auth()` flow as a black-box conformance driver in tests. The certified `oidc-provider` (v9) has CIMD as an **experimental** feature [S9].

## 3. Real-world analogy

**A hotel front desk issuing key cards to a concierge service.** The guest (the user) is at the desk in person (signed in). A concierge company (Claude) asks for access. The desk checks that the company is on its **approved vendor list** (allowlisted CIMD URL), that the card will be handed to the company's **registered pickup counter** (exact redirect URI), and asks the guest which rooms the card opens and whether it opens the minibar (role cap, diagram allowlist). The card works **for an hour** and is renewed by swapping the old renewal slip for a new one (refresh rotation). A slip presented twice means it was copied, so **every card of that arrangement is cancelled** (reuse detection). The guest sees and cancels arrangements at the desk (Connected apps). Personal keys the guest cut earlier (API tokens) keep working unchanged.

Consequences: a closed vendor list (no self-registration), consent per arrangement, short cards plus rotating slips, revocation at the arrangement level.

## 4. Options

| Option                                                                              | Fit                                                                                                                                                  | Verdict                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. SDK 1.32 `mcpAuthRouter`**                                                     | Express inside Next routes; DCR-centric; no CIMD fetch; frozen in SDK v2                                                                             | Rejected: we would adopt a deprecated kit and still write CIMD, consent and storage ourselves                                                   |
| **B. `oidc-provider` embedded** (in the app or as a sidecar)                        | Certified core, RFC 8707, rotation; CIMD experimental; needs a Koa mount, a PostgreSQL adapter, interaction pages and a token-to-principal mapping   | Viable fallback. Too heavy for one client family, one grant type and one resource; OIDC features unused                                         |
| **C. Hosted IdP** (Auth0, WorkOS, Stytch, …)                                        | Fast discovery and DCR                                                                                                                               | Rejected: identity data and the consent decision (role cap, allowlist) move off our infrastructure; recurring cost; custom consent still needed |
| **D. Minimal in-app AS (chosen)**                                                   | Authorization code + PKCE S256 + refresh only; public clients only; CIMD with a closed allowlist; no DCR; opaque hashed tokens; same agent principal | Smallest attack surface that satisfies the spec and Claude. About five endpoints plus one page                                                  |
| **E. Static request header** (Claude's beta "Request headers" with an `ogl_` token) | Zero AS code, but limited beta for some organizations only, and it is an organization-wide credential                                                | Not a solution; useful as an interim workaround if the account has it (needs the Origin fix from O1)                                            |

## 5. Decision

Build **D**, behind `MCP_OAUTH_ENABLED` (off: no behavior change). Revisit **B** if we need more than allowlisted public clients (DCR, confidential clients, other grant types, many third-party clients).

### 5.1 Endpoints and metadata

Canonical resource `R` = `${MCP_PUBLIC_URL}` = `https://lab.ontographia.com/api/mcp`. Issuer `I` = `https://lab.ontographia.com`.

| Path                                                                                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-protected-resource` | PRM: `{resource: R, authorization_servers: [I], scopes_supported: ["diagrams:read","diagrams:comment","diagrams:write"], bearer_methods_supported: ["header"], resource_name: "Ontographia Lab"}`                                                                                                                                                                                                                                                                                                                                                           |
| `GET /.well-known/oauth-authorization-server`                                                   | AS metadata: `issuer`, `authorization_endpoint: I/oauth/authorize`, `token_endpoint: I/api/oauth/token`, `revocation_endpoint: I/api/oauth/revoke`, `response_types_supported: ["code"]`, `grant_types_supported: ["authorization_code","refresh_token"]`, `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]`, `client_id_metadata_document_supported: true`, `authorization_response_iss_parameter_supported: true`, `scopes_supported`: the three scopes + `offline_access`. **No `registration_endpoint`.** |
| `GET /oauth/authorize`                                                                          | Page (pages router). Validates, stores the request, sends to login if needed, renders consent                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `POST /api/oauth/consent`                                                                       | Approve or deny (form post, 303 to the client)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /api/oauth/token`                                                                         | `authorization_code` and `refresh_token` grants, form-urlencoded, `Cache-Control: no-store`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `POST /api/oauth/revoke`                                                                        | RFC 7009, for clients that disconnect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

The `/.well-known/*` paths are served through **rewrites in `next.config.js`** to `pages/api/oauth/*` handlers (a config change: needs owner approval in O1; nginx must keep proxying `/.well-known/` apart from ACME). The `401` from `/api/mcp` gains `resource_metadata="I/.well-known/oauth-protected-resource/api/mcp"` and no `scope` (so Claude requests all three and the user picks the cap). Metadata responses get `Access-Control-Allow-Origin: *`.

**Scopes mirror the role cap**: viewer = `diagrams:read`; commenter = `+ diagrams:comment`; editor = `+ diagrams:write`. The requested scope is the **ceiling** offered on the consent screen. The granted scope is returned in the token response, and the cap, not the scope string, is what `lib/authz` enforces.

### 5.2 Flow

```mermaid
sequenceDiagram
  autonumber
  participant U as User (browser / in-app browser)
  participant C as Claude (claude.ai backend)
  participant M as /api/mcp (resource server)
  participant A as Lab AS (/oauth/*, /api/oauth/*)
  participant D as claude.ai CIMD URL
  C->>M: POST (no token), Origin: https://claude.ai
  M-->>C: 401 WWW-Authenticate: Bearer resource_metadata="…/oauth-protected-resource/api/mcp"
  C->>M: GET PRM
  C->>A: GET /.well-known/oauth-authorization-server
  C->>U: open I/oauth/authorize?client_id=<CIMD URL>&redirect_uri&state&code_challenge(S256)&resource=R&scope
  U->>A: GET /oauth/authorize
  A->>A: client_id on allowlist?
  A->>D: GET CIMD (cached; HTTPS, no redirects, 5 s, 64 KB)
  A->>A: client_id matches, redirect_uri exact match, PKCE S256, resource == R → store request (10 min)
  alt no lab session
    A-->>U: 302 /login?callbackUrl=/oauth/authorize?rid=… (relative only)
    U->>A: sign in, return
  end
  A-->>U: consent page (client host, redirect host, account, cap, allowlist)
  U->>A: POST /api/oauth/consent (rid, csrf, decision, cap, diagramIds)
  A->>A: same-origin, CSRF, rid bound to user, cap/allowlist rules → grant + code (60 s, single use)
  A-->>U: 303 redirect_uri?code&state&iss=I
  U->>C: callback
  C->>A: POST /api/oauth/token (code, code_verifier, redirect_uri, client_id, resource)
  A-->>C: {access_token oga_… (1 h), refresh_token ogr_…, scope, token_type: Bearer, expires_in}
  C->>M: POST Bearer oga_…  → agent principal → tools
  Note over C,A: before expiry: grant_type=refresh_token → new pair; old refresh marked used
```

Errors before `client_id` and `redirect_uri` are validated are shown on our page and **never redirected**. Later errors redirect with `error`, `state` and `iss`.

### 5.3 Client registration

- **CIMD only, closed allowlist** of exact `client_id` URLs in `OAUTH_TRUSTED_CLIENT_IDS`, default `https://claude.ai/oauth/mcp-oauth-client-metadata`. Any other `client_id` gets an error page; no outbound fetch happens. This removes self-registration phishing and SSRF.
- We still **fetch** the document (rather than hard-coding it) so redirect changes (claude.ai → claude.com) are picked up. Fetch rules: HTTPS only, no redirects, 5 s timeout, 64 KB cap, JSON with `client_id` equal to the URL and non-empty `redirect_uris`, `token_endpoint_auth_method` `none`. Cache per `Cache-Control`, clamped to between 5 min and 24 h; on fetch failure use the last good copy for up to 7 days.
- **No DCR** (deprecated by the spec; Claude does not need it when CIMD is advertised correctly). **No pre-registered client secrets.**
- Claude Code keeps using **personal tokens**. Its CIMD (loopback redirects that any local process can claim) stays off the allowlist unless the owner opts in (Q-OA2).

### 5.4 Redirect URIs, PKCE, state, CSRF

- `redirect_uri` is **required** and must exactly match an entry of the fetched document (string equality; the RFC 8252 any-port rule applies only to loopback, which is only relevant if Q-OA2 opens it). Non-loopback redirects must be HTTPS.
- PKCE: `code_challenge_method` must be `S256` (`plain` and missing are rejected); the challenge must be 43 base64url characters; the verifier is checked with a constant-time compare at the token endpoint.
- `state` is opaque, at most 1 KB, echoed unchanged. `iss` is added to every authorization response.
- `resource`: if present it must equal `R` (case-insensitive scheme and host, no trailing slash), else `invalid_target`. If absent, the grant is bound to `R` anyway (we serve a single resource).
- Consent POST protection: `requireSameOrigin`; a hidden CSRF token = HMAC(server key, `rid` + session user id); the request row is bound to the first signed-in user who views it (another user gets an error); the row is single-use and expires in 10 minutes; `SameSite=Lax` session cookie (unchanged). The consent page is served with `Content-Security-Policy: frame-ancestors 'none'` and `Referrer-Policy: no-referrer`.
- **Fix a related issue first:** `pages/login.js` pushes `callbackUrl` to the router unvalidated, and an absolute URL there navigates off-site after sign-in. The login detour must accept only same-origin relative paths (`/` followed by a non-`/`, non-`\` character). This is in O2 and benefits the whole app.

### 5.5 Consent screen

The user is signed in with an existing account (any provider; only `active` users). The consent page shows:

1. **Who is asking**: "**claude.ai** wants to use Ontographia Lab as _you@…_". The label is the **host of the `client_id` URL**, not the self-asserted `client_name`. A "Not you? Switch account" link is shown next to the account.
2. **Where you will be sent back**: the redirect URI host (spec MUST).
3. **Access level** (radios, default **Viewer**; options above the requested scope ceiling are disabled): Viewer (read diagrams), Commenter (read and comment), Editor (also change diagrams). These are the same rules as personal tokens (Q-MCP2):
   - Editor requires choosing **1–50 diagrams** from those the user can edit (`authorize(user, id, 'diagram.write')` on each, rechecked on submit). The picker reuses the API token form's allowlist component.
   - Viewer and Commenter may optionally be limited to selected diagrams.
4. **Plain-language effects**: "Claude can read the diagrams you choose. Every change it makes is versioned and can be restored from History. Diagram text is treated as data, not instructions." Also: "Disconnect at any time in Account → API tokens → Connected apps."
5. A **warning line**: "Only continue if you started connecting Claude yourself just now."
6. **Approve** / **Cancel**. Consent is always shown (no silent re-approval, even for a known client).

### 5.6 Token model

| Item                  | Format and storage                              | Lifetime                                                    | Notes                                                               |
| --------------------- | ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Authorization code    | 32 random bytes base64url; SHA-256 stored       | 60 s, single use                                            | Second use → revoke the grant (OAuth 2.1 §4.1.3)                    |
| Access token          | `oga_` + 32 bytes base64url; SHA-256 stored     | **1 h**                                                     | Opaque, never logged, never in URLs                                 |
| Refresh token         | `ogr_` + 32 bytes; SHA-256 stored               | 30 days idle (renewed on each rotation)                     | Issued when `offline_access` is requested. **Rotated on every use** |
| Grant (connected app) | Row with user, client, cap, allowlist, resource | Until revoked, idle-expired or the optional absolute expiry | Up to **10 active grants per user**                                 |

- **Reuse detection**: presenting a refresh token that is already used revokes the **whole grant** (all access and refresh tokens), returns `invalid_grant` and writes an audit event. **Retry tolerance**: if the successor has _never_ been used and the replay comes within 60 s (Claude retries when a refresh times out at 30 s), revoke the unused successor and issue a fresh pair instead (Q-OA4).
- **Verification** (`verifyToken`, dispatch by prefix): `ogl_` → `api_tokens` (unchanged); `oga_` → `oauth_tokens` ⋈ `oauth_grants` ⋈ `users`. It checks: kind is `access`, not expired, grant not revoked or expired, `grant.resource = R` (audience), user `active`, editor implies a non-empty allowlist. It returns the **same principal**: `{kind:'agent', userId, tokenId: grant.id, roleCap, diagramScope, credential:'oauth', clientId}`. `lib/authz` reads only `kind/userId/roleCap/diagramScope`, so authorization is identical. Rate limits key on `tokenId`, which is stable across rotations. Agent edits record `tokenId` (= grant id) and `credential` in `diagram.agent_edit`. `last_used_at` is updated on the grant at most every 5 minutes.
- **Revocation**: grant-level (`revoked_at`), effective on the next request because verification joins the grant. The user's suspension and deletion work as today (status join, `ON DELETE CASCADE`). Password **reset** revokes all of the user's grants (Q-OA5).

### 5.7 Connected apps (Account > API tokens)

A second list under the API tokens section: client host ("claude.ai"), access level, diagrams (count, expandable), connected date, last used, **Disconnect** (same-origin POST, revokes the grant). Admins see per-user counts only. Personal tokens stay as they are.

### 5.8 Data model (migration `0010_oauth.sql`, additive, idempotent)

```sql
CREATE TABLE IF NOT EXISTS oauth_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,                 -- CIMD URL (allowlisted)
  client_label VARCHAR(100) NOT NULL,      -- host of client_id, shown in UI
  redirect_uri TEXT NOT NULL,
  resource TEXT NOT NULL,                  -- audience (canonical MCP URL)
  scope TEXT NOT NULL,
  role_cap VARCHAR(20) NOT NULL,
  diagram_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ, revoked_reason VARCHAR(30),   -- user|reuse|code_reuse|password_reset|admin
  CONSTRAINT oauth_grants_role_cap_check CHECK (role_cap IN ('viewer','commenter','editor')),
  CONSTRAINT oauth_grants_editor_requires_allowlist
    CHECK (role_cap <> 'editor' OR (diagram_ids IS NOT NULL AND cardinality(diagram_ids) > 0))
);
-- Amended 2026-10-21: all_diagrams BOOLEAN NOT NULL DEFAULT FALSE; the editor CHECK becomes
--   role_cap <> 'editor' OR all_diagrams OR (diagram_ids IS NOT NULL AND cardinality(diagram_ids) > 0)
-- plus CHECK (NOT all_diagrams OR (role_cap = 'editor' AND diagram_ids IS NULL)). See 0010_oauth.sql.
CREATE INDEX IF NOT EXISTS idx_oauth_grants_user ON oauth_grants (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oauth_authorizations (     -- pending request, then its one-time code
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, state VARCHAR(1024),
  code_challenge CHAR(43) NOT NULL, resource TEXT NOT NULL, requested_scope TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,          -- bound on first signed-in view
  grant_id UUID REFERENCES oauth_grants(id) ON DELETE CASCADE,
  code_hash CHAR(64) UNIQUE, code_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('access','refresh')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  parent_id UUID REFERENCES oauth_tokens(id) ON DELETE SET NULL,  -- refresh chain
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_grant ON oauth_tokens (grant_id, kind, created_at DESC);
```

Cleanup (opportunistic on token issuance plus a daily job): authorizations more than 1 day old, tokens more than 30 days past expiry, revoked grants after 90 days. Audit keeps the history.

### 5.9 Abuse limits (in-process, like today)

`/oauth/authorize`: 30/min per IP. `/api/oauth/token`: 60/min per IP and 20/min per grant; failed grants share the existing auth-failure limiter. Consent POST: 10/min per user. At most 10 active grants and 20 pending authorizations per user. CIMD fetches go only to allowlisted URLs, at most 1 per URL per minute. MCP limits are unchanged (120 requests and 30 writes per minute per `tokenId`).

### 5.10 Audit events (`audit_events`, no IPs, no raw tokens)

`oauth.grant.create` (actor user; target `{grantId, client, roleCap, diagramCount}`), `oauth.consent.deny`, `oauth.grant.revoke` (user/admin), `oauth.grant.revoke_reuse` and `oauth.grant.revoke_code_reuse` (system; target `{grantId}`), `oauth.grants.revoke_all` (password reset). Agent edits keep `diagram.agent_edit`, with `credential: 'oauth'`.

### 5.11 Origin check and OPTIONS

- The Origin guard stays (DNS-rebinding defense, transport spec), still before authentication. Set `MCP_ALLOWED_ORIGINS=https://claude.ai,https://claude.com` (environment only) and **normalize** the incoming Origin (lowercase, strip a trailing `/`) before comparing.
- Allowing these origins grants nothing: `/api/mcp` never reads cookies, so a page on claude.ai still needs a bearer token.
- Answer `OPTIONS` from an allowed origin with `204` and CORS headers for `POST` and `Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Method, Mcp-Name`; other origins get 403. Today `OPTIONS` returns 405.
- The token and revoke endpoints send no CORS headers (they are server-to-server).

### 5.12 What stays the same

Personal tokens (`ogl_`), their UI, limits and semantics; Claude Code, Cursor and VS Code setups ([mcp-connect-howto.md](../investigations/mcp-connect-howto.md)); `lib/authz`; MCP tools, rate limits and versioning of agent edits. With the flag off, nothing changes. With it on, the only visible MCP change is the added `resource_metadata` in the `401` challenge, which header-token clients ignore.

## 6. Threat model (STRIDE-lite)

| Threat                                                                   | Vector                                                                                                                                                          | Mitigation                                                                                                                                                                                                     | Residual                                                                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **S** Phishing via malicious client registration                         | Attacker registers "Claude" with their redirect                                                                                                                 | No DCR; exact `client_id` allowlist; label = `client_id` host; redirect host shown                                                                                                                             | None while the allowlist is closed                                                                  |
| **S** Consent phishing / request forwarding                              | Attacker starts a flow in _their_ Claude and sends the victim the authorize link; the victim approves and the code lands at claude.ai under the attacker's flow | Consent always shown; account and "only continue if you started this" warning; requests expire in 10 min; Viewer default; editor needs a deliberate allowlist                                                  | Depends on the client binding the callback to the initiating session (claude.ai's side). Documented |
| **S** Loopback impersonation                                             | A local process claims to be Claude Code                                                                                                                        | Claude Code CIMD not allowlisted (Q-OA2)                                                                                                                                                                       | —                                                                                                   |
| **T** Open redirect                                                      | Crafted `redirect_uri` or login `callbackUrl`                                                                                                                   | Exact match against the CIMD document; no redirect before validation; relative-only `callbackUrl` fix                                                                                                          | —                                                                                                   |
| **T** Code injection / interception                                      | Stolen code redeemed elsewhere                                                                                                                                  | PKCE S256, 60 s single use, code bound to client + redirect + resource; reuse revokes the grant                                                                                                                | —                                                                                                   |
| **R** Denial of having connected or edited                               | —                                                                                                                                                               | Audit events for grant lifecycle; agent edits versioned and audited with grant id                                                                                                                              | —                                                                                                   |
| **I** Token leakage                                                      | Logs, URLs, Referer, DB dump                                                                                                                                    | Hashes only; tokens only in headers and bodies; `no-store`; `no-referrer`; 1 h access lifetime; refresh rotation and reuse revocation; confirm nginx does not log `Authorization` or `/api/oauth/token` bodies | A stolen refresh token works until its first legitimate rotation                                    |
| **I** Token for another resource accepted (confused deputy, passthrough) | Token minted for another server                                                                                                                                 | Opaque tokens only valid here; `grant.resource = R` checked on every request; we never forward tokens upstream                                                                                                 | The classic MCP proxy confused deputy does not apply (we are our own AS, no upstream)               |
| **D** CIMD SSRF / fetch flood                                            | `client_id` pointing at internal hosts                                                                                                                          | Fetch only allowlisted URLs; HTTPS; no redirects; size and time caps; cache                                                                                                                                    | —                                                                                                   |
| **D** Table growth                                                       | Many authorize requests or grants                                                                                                                               | Rate limits, per-user caps, expiry and cleanup                                                                                                                                                                 | —                                                                                                   |
| **E** Consent bypass                                                     | Forged POST, clickjacking, reused `rid`, another user's `rid`                                                                                                   | Same-origin + CSRF HMAC + `rid` bound to user and single use; `frame-ancestors 'none'`                                                                                                                         | —                                                                                                   |
| **E** Cap escalation                                                     | Request editor beyond the user's role, or no allowlist                                                                                                          | Cap ≤ requested scope; `min(user role, cap)` at runtime; editor allowlist rechecked with `diagram.write`; DB CHECK; verification refuses editor without allowlist                                              | —                                                                                                   |
| **E** Prompt injection steering the agent                                | Diagram text                                                                                                                                                    | Unchanged from M2: allowlist for editor, versioned edits, no deletes                                                                                                                                           | Same as personal tokens                                                                             |

## 7. Delivery slices

| Slice                              | Scope                                                                                                                                                                                                                                                  | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O1 Discovery + RS** (S)          | Flag; Origin normalization and allowlist env; `OPTIONS`; PRM and AS metadata handlers and `next.config.js` rewrites (owner-approved); `resource_metadata` in the 401 when the flag is on; `verifyToken` dispatch scaffold                              | Unit tests: metadata validates against the SDK zod schemas; the 401 carries `resource_metadata`; `Origin: https://claude.ai` (and with a trailing `/`) passes and an evil origin gets 403; `ogl_` regression suite green; flag off = byte-identical responses. On lab: `curl` of both well-known URLs returns 200 and adding the custom connector reaches our `/oauth/authorize` (which still returns "not available")                                                                                                                                                                                                                                                        |
| **O2 AS core** (M–L)               | Migration 0010; authorize validation + CIMD allowlist fetch/cache; consent page and POST; code, token (code + refresh with rotation/reuse/retry tolerance), revoke; `oga_` verification to the agent principal; audit; limits; login `callbackUrl` fix | An integration test drives the **SDK client `auth()`** (discovery → CIMD → PKCE → token → refresh) against the handlers with a stubbed CIMD fetch. Negative tests: unknown `client_id`, mismatched redirect, `plain`/missing PKCE, wrong verifier, code reuse revokes the grant, refresh reuse revokes the grant, retry within 60 s works, wrong `resource` → `invalid_target`, editor without allowlist refused, consent POST cross-origin / bad CSRF / other user's `rid` refused, revoked or suspended → 401 `invalid_token`, `invalid_grant` on expired refresh. Authz parity: the same tool calls with an `ogl_` and an `oga_` token of equal cap give identical results |
| **O3 Connected apps + enable** (S) | Account UI list + Disconnect; flag on in production; how-to section for claude.ai / Desktop / mobile                                                                                                                                                   | Owner adds the connector on claude.ai with "Use Claude's published identity", approves Viewer, lists diagrams; reconnects as Editor with an allowlist and applies ops; uses it from the mobile app; Disconnect → next call fails and Claude asks to reconnect; audit rows present; Claude Code with `ogl_` unaffected                                                                                                                                                                                                                                                                                                                                                         |
| **O4 Optional** (S)                | Step-up: `tools/call diagram_apply_ops` with a non-editor OAuth grant → `403 insufficient_scope scope="diagrams:read diagrams:comment diagrams:write"` from the HTTP gate; daily cleanup job; Claude Code CIMD if Q-OA2 = yes                          | Claude shows a re-authorization prompt and consent preselects Editor; the job deletes only expired rows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## 8. Open questions (recommended defaults)

> **Decision (2026-10-21):** the product owner approved this ADR with all recommended defaults, including the `next.config.js` rewrites for `/.well-known/*` (Q-OA8). Delivery starts with O1, then O2 and O3.
>
> **Amendment (2026-10-21, owner, this case only; overrides Q-MCP2 for OAuth connections of platform administrators):** the consent screen offers administrators (`users.role = 'admin'`) an extra choice for the Editor level, **"Edit all boards I can edit"**: an editor-capped connection WITHOUT a diagram allowlist that covers every diagram the admin can edit through their live role (owned, or Editor membership), including diagrams created later. It does not grant access to other users' boards: platform admins still have no implicit role on any diagram (Q-S1). Non-admins are unchanged (Editor requires choosing 1 to 50 diagrams they can edit; Viewer and Commenter may cover everything they can read). Personal `ogl_` tokens are unchanged (Editor still requires an allowlist). Modeled as `oauth_grants.all_diagrams` (section 5.8); see "As built" for the runtime re-check.

| ID    | Question                                                                                          | Recommended default                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-OA1 | Minimal in-app AS (D) or `oidc-provider` (B)?                                                     | **D**; revisit B if we add non-Claude clients, DCR or confidential clients                                                                                                            |
| Q-OA2 | Allow Claude Code's CIMD (loopback redirects) as well?                                            | **No**; Claude Code keeps personal tokens. Add later with a loopback warning on consent                                                                                               |
| Q-OA3 | Other hosted clients (e.g. ChatGPT) on the allowlist?                                             | **Not in v1**; adding one is an env change plus a consent-label check                                                                                                                 |
| Q-OA4 | 60 s refresh retry tolerance, or strict "any reuse revokes"?                                      | **Tolerance on**, only when the successor is unused                                                                                                                                   |
| Q-OA5 | Lifetimes                                                                                         | Access 1 h; refresh 30 days idle; grant until revoked with optional absolute expiry on consent (like tokens); password reset revokes all grants, a voluntary password change does not |
| Q-OA6 | Require a recent sign-in (for example within 12 h) before granting Editor?                        | **No** in v1 (OAuth-provider users have no password to re-enter); revisit with 2FA                                                                                                    |
| Q-OA7 | Max active grants per user                                                                        | **10**                                                                                                                                                                                |
| Q-OA8 | Approve the `next.config.js` rewrites for `/.well-known/*`?                                       | **Yes** (alternative: nginx `location` blocks, which keeps app config untouched but splits routing)                                                                                   |
| Q-OA9 | If the account has Claude's "Request headers" beta, use an `ogl_` header as an interim before O2? | **Yes, only after O1** (needs the Origin fix); remove once OAuth ships                                                                                                                |

## 9. Sources (accessed 2026-10-21)

- [S1] MCP Authorization, revision 2026-07-28 (current): <https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization>
- [S2] MCP Authorization, revision 2025-11-25: <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>
- [S3] Claude docs, Authentication for connectors (types, CIMD/DCR selection, callback URLs, refresh, timeouts, egress range): <https://claude.com/docs/connectors/building/authentication>
- [S4] Claude docs, Add a connector that isn't in the directory (plans, auth settings dialog, request-header beta): <https://claude.com/docs/connectors/custom/add-unlisted>
- [S5] Claude docs, Lazy authentication (401 shape, PRM paths, CIMD checks, loopback matching, 403 step-up, discovery cache) and Troubleshooting (redirects, WAF, discovery): <https://claude.com/docs/connectors/building/lazy-authentication>, <https://claude.com/docs/connectors/building/troubleshooting>. Client metadata documents: <https://claude.ai/oauth/mcp-oauth-client-metadata>, <https://claude.ai/oauth/claude-code-client-metadata>
- [S6] Public issue on the Claude MCP tracker, 2026-09-08 (Origin `https://claude.ai` rejected by an SDK origin guard): <https://github.com/anthropics/claude-ai-mcp/issues/1005>
- [S7] Public server change, 2026-10-13 ("Claude's custom connector sends `Origin: https://claude.ai`"; allowlist `claude.ai,claude.com`): <https://github.com/setluca/luca-mcp/pull/13>
- [S8] TypeScript SDK v2 migration guide (AS helpers moved to `server-legacy/auth`, deprecated): <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md>; local inspection of `@modelcontextprotocol/sdk` 1.32.1 `dist/esm/server/auth/*`
- [S9] `oidc-provider` (CIMD experimental in v9): <https://github.com/panva/node-oidc-provider>

## 10. As built

### O1 Discovery + resource server

- **Flag and config:** `lib/oauth/config.js`. `MCP_OAUTH_ENABLED` (`true` or `1`; default off), `OAUTH_ISSUER` (default: origin of `NEXTAUTH_URL`), `MCP_PUBLIC_URL` (default `<issuer>/api/mcp`), `OAUTH_TRUSTED_CLIENT_IDS` (default Claude's hosted client; used from O2).
- **Metadata:** `lib/oauth/metadata.js` builds both documents exactly as in section 5.1 (validated against the SDK zod schemas in tests); `pages/api/oauth/protected-resource.js` and `authorization-server.js` serve them with `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=300`, `OPTIONS` 204. With the flag off they answer 404.
- **Rewrites (owner-approved, the only config change):** `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server` in `next.config.js`. nginx must keep proxying `/.well-known/` to the app (apart from ACME).
- **401 challenge:** `resource_metadata="<issuer>/.well-known/oauth-protected-resource/api/mcp"` is appended to the bare and the `invalid_token` challenges only when the flag is on (`createMcpHandler({ resourceMetadataUrl })`). No `scope`. Flag off: byte-identical.
- **Origin and OPTIONS (unconditional, driven by `MCP_ALLOWED_ORIGINS`):** the Origin is normalized (trimmed, lowercased, trailing `/` removed) on both sides of the comparison; the guard now runs before the method check, so a disallowed origin gets 403 for any method. An allowed origin gets `Access-Control-Allow-Origin`, `Vary: Origin` and `Access-Control-Expose-Headers: WWW-Authenticate` on every response; `OPTIONS` from it answers 204 with the methods and headers of section 5.11. `OPTIONS` without an Origin keeps the old 405. Set `MCP_ALLOWED_ORIGINS=https://claude.ai,https://claude.com` on lab. Not verified from real claude.ai traffic yet (the ADR flagged this as "likely"): confirm from the first connection attempt.
- **Dispatch scaffold:** `lib/oauth/verify.js` `verifyBearer` sends `oga_` to the OAuth verifier (a stub in O1 that accepts nothing, and never called with the flag off) and everything else to `lib/apiTokens`.
- **Placeholder:** `/oauth/authorize` renders a static "not available yet" page (replaced in O2).

### O2 Authorization server core

Implemented in `lib/oauth/*`, `pages/oauth/authorize.js`, `pages/api/oauth/{consent,token,revoke}.js`, `components/oauth/ConsentForm.js`, migration `db/migrations/0010_oauth.sql`. Everything is behind `MCP_OAUTH_ENABLED` (token, revoke and consent answer 404; `/oauth/authorize` shows a static "not available" page; `oga_` tokens are never honored).

- **Flow as designed (5.2):** `GET /oauth/authorize` without `rid` validates the request (`lib/oauth/authorizeRequest.js`: client_id on the closed allowlist, exact redirect_uri from the CIMD document, S256 only, `resource` equals R, `state` at most 1 KB, `scope` ceiling) and redirects to `/oauth/authorize?rid=<uuid>`; client_id or redirect_uri errors are shown on our page and never redirected, every later error redirects with `error`, `state` and `iss`. With `rid`: signed out sends the browser to `/login?callbackUrl=/oauth/authorize?rid=<uuid>` (only the opaque id travels; the login page's `safeRedirectPath` from #47 accepts it, and the Google and GitHub buttons now carry the same validated callback); signed in binds the request to the user (another account gets "Different account"; "Not you? Switch account" releases it and signs out) and shows the consent screen.
- **CIMD (5.3):** `lib/oauth/clients.js`. Only exact entries of `OAUTH_TRUSTED_CLIENT_IDS` are fetched; HTTPS only (loopback `http` only when `NODE_ENV` is not `production`, which is how the end-to-end test runs a local "Claude"), no redirects, 5 s, 64 KB, `client_id` equal to the URL, `token_endpoint_auth_method: none`, non-empty `redirect_uris`; cache clamped to 5 min .. 24 h, stale copy up to 7 days, one fetch per URL per minute. The consent label is the host of the `client_id`.
- **Consent (5.5) and CSRF (5.4):** `lib/oauth/consent.js`, `consentEndpoint.js`. The POST checks same origin, form content type, a signed-in active user read live from the database, 10 requests a minute per user, the CSRF token (`HMAC-SHA256(key derived from NEXTAUTH_SECRET, rid + user id)`), then the consent rules. Refused forms redirect back to the consent page with a fixed error code (never reflected text). Page headers: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (deviation from `no-referrer`: with `no-referrer` browsers send `Origin: null` on the consent form POST, which the same-origin check refuses for users who open the page directly while signed in; `same-origin` still sends no Referer to any other site), `Cache-Control: no-store` (Next dev serves `no-cache`; production adds `no-store`). Optional absolute expiry (7, 30, 90, 365 days) is offered.
- **Tokens (5.6):** `lib/oauth/repository.js`. Codes, access and refresh tokens are 32 random bytes with SHA-256 stored. Code reuse revokes the grant (`code_reuse`); a failed redirect, client, resource or PKCE check burns the code and revokes the token-less grant (`exchange_failed`, a reason not in the ADR list). Refresh rotation with reuse detection (`reuse`) and the 60 s retry tolerance when the successor was never used; concurrent refreshes with the same token are serialized by a row lock and resolve through the same tolerance. Refresh tokens are issued only when `offline_access` was requested (Claude appends it). `verifyAccessToken` joins grant and user on every request, so revocation, suspension and role changes apply on the next call; the principal is `{kind:'agent', userId, tokenId: grantId, roleCap, diagramScope, allDiagrams, credential:'oauth', clientId}`.
- **All boards I can edit (amendment):** `all_diagrams` grants carry `diagramScope: null` and `allDiagrams: true`. `verifyAccessToken` reads `users.role` on every request: a user who is no longer an admin keeps a connection that can read and comment (`roleCap` drops to `commenter`) but cannot write. The write gate in `lib/mcp/server.js` accepts such a principal only when `credential === 'oauth'` and `allDiagrams === true`, and `authorize(..., 'diagram.write')` still applies per diagram: owned and Editor-membership diagrams succeed, Viewer/Commenter-membership diagrams are forbidden, other users' private diagrams answer "not found". The consent screen shows "Claude can change any board you can edit; every change is saved as a version you can restore". A crafted consent POST from a non-admin is refused (`all_boards_admin_only`), and a forged `all_diagrams` row for a non-admin is neutralized at verification.
- **Limits (5.9):** `/oauth/authorize` 30/min per address; `/api/oauth/token` 60/min per address plus a failure budget of 30/min per address and 20 failures/min per grant (answered 429; it counts failed attempts, not successful rotations, so a client that refreshes legitimately is never locked out); consent 10/min per user; at most 10 active grants and 20 pending requests per user (the latter checked when a request is bound to its user). Per-process, like the other limiters. `lib/rateLimit.js`'s housekeeping timer is now `unref`ed so test runs exit.
- **Revoke (5.1):** `POST /api/oauth/revoke` revokes the whole grant for a presented access or refresh token of the matching client; unknown tokens answer 200.
- **Password reset (Q-OA5):** `pages/api/auth/reset-password.js` revokes all of the user's grants (`password_reset`, audit `oauth.grants.revoke_all`); a failure is logged and does not block the reset.
- **Audit (5.10):** `oauth.grant.create`, `oauth.consent.deny`, `oauth.grant.revoke`, `oauth.grant.revoke_reuse`, `oauth.grant.revoke_code_reuse`, `oauth.grants.revoke_all`; agent edits record `credential: 'oauth'` next to `tokenId` (= grant id) in `diagram.agent_edit`.
- **Migration deviations:** `oauth_authorizations.code_used_at` was added (the ADR's `consumed_at` means "request decided"; redemption needs its own marker to detect a second use) and `oauth_grants.all_diagrams` for the amendment. No other schema differences. Cleanup (authorizations older than a day, tokens 30 days past expiry, grants revoked 90 days ago) runs opportunistically on each approval; the daily job stays in O4.
- **Tests:** unit (`oauthCrypto`, `oauthClients`, `oauthAuthorizeRequest`, `oauthVerifyDispatch`, `ConsentForm`), database (`oauthRepository`, `oauthConsent`, `oauthAllBoardsMcp`, `oauthEndpoints` including a drive of the MCP SDK client `auth()` through discovery, CIMD, PKCE, token and refresh with a stubbed CIMD fetch, `migrate0010`) and the browser end-to-end test `__tests__/e2e/oauth-connect.test.js`.

### Security review follow-ups (2026-10-21)

- **M1 refresh retry grace:** a successor token superseded by the 60 s retry path is marked `oauth_tokens.revoked_reason = 'grace_superseded'` (column added to 0010 before release). Presenting such a token means two parties hold the same chain, so it is treated as reuse and revokes the whole grant, which also kills the replayer's chain. The retry path is allowed at most once per token (a second replay of the same spent token revokes the grant).
- **L1 pending-request growth:** creating a request runs the cleanup (at most every 5 minutes per process; it also deletes expired unbound requests), the number of unbound pending requests is capped globally (1000; excess answers a "Busy" page), and new requests are limited to 10 per 10 minutes per address in addition to the 30/min page limit.
- **L2:** a successful authenticated password change revokes all connections too (`revoked_reason: password_change`); this supersedes the "a voluntary password change does not" half of Q-OA5.
- **L4 fail closed:** with `MCP_OAUTH_ENABLED` on, an unsafe configuration disables OAuth entirely and logs `OAUTH_DISABLED: ...` once: in production the issuer (`OAUTH_ISSUER`/`NEXTAUTH_URL`) and `MCP_PUBLIC_URL` must be https, and the MCP resource path must be `/api/mcp` (the rewrites and route exist only for that path; other paths are rejected, not derived).
- **Deployment note:** the production server must be able to fetch Claude's client metadata document (`https://claude.ai/oauth/mcp-oauth-client-metadata`) over HTTPS (outbound to claude.ai). If it cannot, authorization fails closed with "App unavailable" (`client_unavailable`); a stale cached copy is used for up to 7 days.
