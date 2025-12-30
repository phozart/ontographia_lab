// components/landing/GuideLayout.js
// Guide layout with chapter navigation sidebar

import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Box, Container, Typography, Button, IconButton, Drawer, Collapse } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { LogoIcon } from '../ui/Logo';
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

// Guide chapters structure
const GUIDE_CHAPTERS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    href: '/guide',
    sections: [],
  },
  {
    id: 'basics',
    title: 'Canvas Basics',
    href: '/guide/basics',
    sections: [
      { id: 'navigation', title: 'Navigation & Viewport' },
      { id: 'creating-elements', title: 'Creating Elements' },
      { id: 'selecting', title: 'Selecting & Moving' },
      { id: 'editing', title: 'Editing Properties' },
    ],
  },
  {
    id: 'connections',
    title: 'Connections',
    href: '/guide/connections',
    sections: [
      { id: 'creating-connections', title: 'Creating Connections' },
      { id: 'connection-styles', title: 'Line Styles' },
      { id: 'waypoints', title: 'Waypoints & Routing' },
    ],
  },
  {
    id: 'stencils',
    title: 'Stencil Packs',
    href: '/guide/stencils',
    sections: [
      { id: 'core-shapes', title: 'Core Shapes' },
      { id: 'process-flow', title: 'Process Flow' },
      { id: 'mind-maps', title: 'Mind Maps' },
      { id: 'uml', title: 'UML Diagrams' },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    href: '/guide/shortcuts',
    sections: [],
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    href: '/guide/collaboration',
    sections: [
      { id: 'sharing', title: 'Sharing Diagrams' },
      { id: 'real-time', title: 'Real-time Editing' },
      { id: 'comments', title: 'Comments & Feedback' },
    ],
  },
  {
    id: 'export',
    title: 'Export & Import',
    href: '/guide/export',
    sections: [],
  },
];

// Find current and adjacent chapters
function useChapterNavigation(currentPath) {
  const flatChapters = GUIDE_CHAPTERS;
  const currentIndex = flatChapters.findIndex(ch => ch.href === currentPath);

  return {
    current: flatChapters[currentIndex],
    prev: currentIndex > 0 ? flatChapters[currentIndex - 1] : null,
    next: currentIndex < flatChapters.length - 1 ? flatChapters[currentIndex + 1] : null,
  };
}

// Sidebar navigation component
function GuideSidebar({ currentPath, onClose }) {
  const [expandedChapter, setExpandedChapter] = useState(null);

  return (
    <Box sx={{ py: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4, px: 1 }}>
        <MenuBookIcon sx={{ color: SKY.deepCyan, fontSize: 24 }} />
        <Typography
          sx={{
            fontSize: 16,
            fontWeight: 600,
            color: 'white',
          }}
        >
          User Guide
        </Typography>
      </Box>

      <Box component="nav">
        {GUIDE_CHAPTERS.map((chapter) => {
          const isActive = currentPath === chapter.href;
          const isExpanded = expandedChapter === chapter.id || isActive;
          const hasSections = chapter.sections.length > 0;

          return (
            <Box key={chapter.id} sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Link href={chapter.href} style={{ textDecoration: 'none', flex: 1 }}>
                  <Box
                    onClick={onClose}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1.25,
                      borderRadius: 1.5,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'white' : 'rgba(255, 255, 255, 0.6)',
                      background: isActive ? `${SKY.deepCyan}20` : 'transparent',
                      borderLeft: isActive ? `2px solid ${SKY.deepCyan}` : '2px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': {
                        color: 'white',
                        background: 'rgba(255, 255, 255, 0.05)',
                      },
                    }}
                  >
                    {chapter.title}
                  </Box>
                </Link>
                {hasSections && (
                  <IconButton
                    size="small"
                    onClick={() => setExpandedChapter(isExpanded ? null : chapter.id)}
                    sx={{ color: 'rgba(255, 255, 255, 0.4)' }}
                  >
                    {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </IconButton>
                )}
              </Box>

              {hasSections && (
                <Collapse in={isExpanded}>
                  <Box sx={{ pl: 3, py: 0.5 }}>
                    {chapter.sections.map((section) => (
                      <Link
                        key={section.id}
                        href={`${chapter.href}#${section.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Typography
                          onClick={onClose}
                          sx={{
                            px: 2,
                            py: 0.75,
                            fontSize: 13,
                            color: 'rgba(255, 255, 255, 0.5)',
                            borderRadius: 1,
                            transition: 'all 0.2s',
                            '&:hover': {
                              color: 'rgba(255, 255, 255, 0.8)',
                              background: 'rgba(255, 255, 255, 0.03)',
                            },
                          }}
                        >
                          {section.title}
                        </Typography>
                      </Link>
                    ))}
                  </Box>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// Ethereal background orbs
function EtherealBackground() {
  const orbConfigs = [
    { color: SKY.deepCyan, size: 400, top: '5%', left: '-5%' },
    { color: SKY.deepLavender, size: 350, top: '45%', left: '75%' },
    { color: SKY.mauveRose, size: 300, top: '70%', left: '10%' },
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
            background: `radial-gradient(circle, ${orb.color}20 0%, ${orb.color}05 45%, transparent 70%)`,
            filter: 'blur(80px)',
            top: orb.top,
            left: orb.left,
          }}
        />
      ))}
    </Box>
  );
}

export default function GuideLayout({ title, description, children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { prev, next } = useChapterNavigation(router.pathname);

  return (
    <>
      <Head>
        <title>{title} | Ontographia Lab Guide</title>
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

        {/* Header */}
        <Box
          component="header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            py: 2,
            px: 3,
            backdropFilter: 'blur(20px)',
            background: 'rgba(8, 8, 16, 0.85)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Link href="/" style={{ textDecoration: 'none' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <LogoIcon size={26} />
                    <Typography
                      sx={{
                        display: { xs: 'none', sm: 'block' },
                        fontSize: 15,
                        fontWeight: 600,
                        background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                      }}
                    >
                      Ontographia Lab
                    </Typography>
                  </Box>
                </Link>
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    alignItems: 'center',
                    gap: 0.5,
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <MenuBookIcon sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
                  <Typography sx={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Documentation
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Link href="/access" style={{ textDecoration: 'none' }}>
                  <Button
                    size="small"
                    sx={{
                      display: { xs: 'none', sm: 'flex' },
                      background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                      color: 'white',
                      px: 2,
                      py: 0.75,
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 1.5,
                      textTransform: 'none',
                    }}
                  >
                    Get Access
                  </Button>
                </Link>
                <IconButton
                  onClick={() => setSidebarOpen(true)}
                  sx={{
                    display: { xs: 'flex', lg: 'none' },
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Main layout with sidebar */}
        <Box sx={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>
          {/* Desktop Sidebar */}
          <Box
            sx={{
              display: { xs: 'none', lg: 'block' },
              width: 280,
              flexShrink: 0,
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'rgba(8, 8, 16, 0.5)',
            }}
          >
            <Box sx={{ position: 'sticky', top: 72 }}>
              <GuideSidebar currentPath={router.pathname} onClose={() => {}} />
            </Box>
          </Box>

          {/* Mobile Sidebar Drawer */}
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            PaperProps={{
              sx: {
                width: 300,
                background: 'linear-gradient(180deg, #0a0a14 0%, #080810 100%)',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
              <IconButton
                onClick={() => setSidebarOpen(false)}
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <GuideSidebar currentPath={router.pathname} onClose={() => setSidebarOpen(false)} />
          </Drawer>

          {/* Content */}
          <Box
            component="main"
            sx={{
              flex: 1,
              minWidth: 0,
              py: { xs: 4, md: 6 },
              px: { xs: 3, md: 6 },
            }}
          >
            <Container maxWidth="md" sx={{ px: { xs: 0, md: 2 } }}>
              {children}

              {/* Chapter navigation */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 8,
                  pt: 4,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {prev ? (
                  <Link href={prev.href} style={{ textDecoration: 'none' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'rgba(255, 255, 255, 0.6)',
                        transition: 'color 0.2s',
                        '&:hover': { color: SKY.deepCyan },
                      }}
                    >
                      <ArrowBackIcon sx={{ fontSize: 18 }} />
                      <Box>
                        <Typography sx={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>
                          Previous
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                          {prev.title}
                        </Typography>
                      </Box>
                    </Box>
                  </Link>
                ) : (
                  <Box />
                )}

                {next && (
                  <Link href={next.href} style={{ textDecoration: 'none' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'rgba(255, 255, 255, 0.6)',
                        textAlign: 'right',
                        transition: 'color 0.2s',
                        '&:hover': { color: SKY.deepCyan },
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>
                          Next
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                          {next.title}
                        </Typography>
                      </Box>
                      <ArrowForwardIcon sx={{ fontSize: 18 }} />
                    </Box>
                  </Link>
                )}
              </Box>
            </Container>
          </Box>
        </Box>

        <Footer />
      </Box>
    </>
  );
}

// Export chapters for use in other components
export { GUIDE_CHAPTERS, SKY };
