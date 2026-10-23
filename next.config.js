const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, './'),

  // pptxgenjs (ADR-0007 P3, loaded by dynamic import on export only) names node:fs and node:https behind a runtime "is this
  // Node" check that is false in a browser. Webpack cannot read the node: scheme in a client bundle, so those two requests are
  // ignored there (the import then throws if it were ever run, which the browser path never does).
  webpack(config, { isServer, webpack }) {
    if (!isServer) config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^node:(fs|https)$/, contextRegExp: /pptxgenjs[\\/]dist/ }));
    return config;
  },

  // OAuth discovery documents (ADR-0005, Q-OA8). The handlers answer 404 unless MCP_OAUTH_ENABLED is on.
  async rewrites() {
    return [
      { source: '/.well-known/oauth-protected-resource', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-protected-resource/api/mcp', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/api/oauth/authorization-server' },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
      // self-hosted theme fonts (ADR-0007 P2): cached for a year (immutable): file names are NOT content-hashed, so a new font version must use a NEW file name, never an in-place edit
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
