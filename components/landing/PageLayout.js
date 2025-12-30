// components/landing/PageLayout.js
// Shared layout for landing pages with consistent styling and floating navigation

import Head from 'next/head';
import { Box, Container, Typography } from '@mui/material';
import FloatingNav, { NAV_LINKS } from './FloatingNav';
import Footer from './Footer';

// Ethereal Sky Palette
const SKY = {
  deepCyan: '#4FB3CE',
  steelBlue: '#6A9FC9',
  deepLavender: '#9A8AC8',
  mauveRose: '#C490B0',
  warmPeach: '#E8A99A',
  goldenHour: '#F0D98A',
  skyReturn: '#6EC5D8',
};


// Ethereal background orbs
function EtherealBackground() {
  const orbConfigs = [
    { color: SKY.deepCyan, size: 400, top: '5%', left: '-5%' },
    { color: SKY.deepLavender, size: 350, top: '45%', left: '75%' },
    { color: SKY.mauveRose, size: 300, top: '70%', left: '10%' },
    { color: SKY.warmPeach, size: 280, top: '20%', left: '60%' },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {orbConfigs.map((orb, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}25 0%, ${orb.color}05 45%, transparent 70%)`,
            filter: 'blur(80px)',
            top: orb.top,
            left: orb.left,
          }}
        />
      ))}
    </Box>
  );
}

export default function PageLayout({
  title,
  description,
  children,
  maxWidth = 'md',
}) {
  return (
    <>
      <Head>
        <title>{title} | Ontographia Lab</title>
        <meta name="description" content={description} />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0a0a14 0%, #080810 50%, #05050a 100%)',
        }}
      >
        <EtherealBackground />
        <FloatingNav alwaysLeft />

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            position: 'relative',
            zIndex: 1,
            pt: { xs: 12, md: 14 }, // Extra padding for fixed nav
            pb: { xs: 4, md: 8 },
          }}
        >
          <Container maxWidth={maxWidth}>
            {children}
          </Container>
        </Box>

        <Footer />
      </Box>
    </>
  );
}

// Reusable section component
export function PageSection({ title, children, sx = {} }) {
  return (
    <Box sx={{ mb: 6, ...sx }}>
      {title && (
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: 24, md: 28 },
            fontWeight: 600,
            mb: 3,
            background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {title}
        </Typography>
      )}
      <Box sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.8, fontSize: 16 }}>
        {children}
      </Box>
    </Box>
  );
}

// Export palette and nav links for use in other components
export { SKY, NAV_LINKS };
