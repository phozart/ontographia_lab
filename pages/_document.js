// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Critical CSS to prevent white flash on dark landing pages */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { background: #0d0d1a; }
        `}} />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.svg" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color */}
        <meta name="theme-color" content="#0d0d1a" />
        <meta name="msapplication-TileColor" content="#7A8EE8" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=TASA+Explorer:wght@400..800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
