// pages/index.js
// Ontographia Lab Landing Page - Immersive Canvas Edition
// "The page IS the canvas. You're not looking at a tool—you're inside it."

import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { Box, Typography, Button, IconButton, Drawer, Avatar, Menu, MenuItem, Divider, ListItemIcon } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { LogoIcon } from '../components/ui/Logo';
import Footer from '../components/landing/Footer';

const NAV_LINKS = [
  { label: 'Product', href: '/product' },
  { label: 'Guide', href: '/guide' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'About', href: '/about' },
];

// Ethereal Sky Palette - New pinwheel colors + legacy for orbs
const SKY = {
  // New logo colors
  skyCyan: '#5CC8E4',
  periwinkle: '#6E8CD8',
  lavender: '#9080C8',
  // Legacy orb colors (still used for background effects)
  deepCyan: '#5CC8E4',
  steelBlue: '#6A9FC9',
  deepLavender: '#9080C8',
  mauveRose: '#C490B0',
  warmPeach: '#E8A99A',
  goldenHour: '#F0D98A',
  skyReturn: '#6EC5D8',
};

// Floating Navigation Header
function FloatingNav({ isLoggedIn, user }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const userMenuOpen = Boolean(userMenuAnchor);

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    signOut({ callbackUrl: '/' });
  };

  return (
    <>
      {/* Left floating menu - Logo + Hamburger only */}
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1.5, md: 2 },
          px: { xs: 2, md: 2.5 },
          py: 1.5,
          borderRadius: 3,
          background: 'rgba(10, 10, 20, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LogoIcon size={26} />
            <Typography
              sx={{
                display: { xs: 'none', sm: 'block' },
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                whiteSpace: 'nowrap',
              }}
            >
              ONTOGRAPHIA LAB
            </Typography>
          </Box>
        </Link>

        {/* Hamburger Menu Button */}
        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <MenuIcon />
        </IconButton>
      </Box>

      {/* Top right - User Avatar (logged in) or Get Access button */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 100,
        }}
      >
        {isLoggedIn ? (
          <>
            <IconButton
              onClick={handleUserMenuOpen}
              sx={{
                p: 0.5,
                background: 'rgba(10, 10, 20, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                '&:hover': {
                  background: 'rgba(20, 20, 40, 0.95)',
                },
              }}
            >
              <Avatar
                src={user?.image}
                alt={user?.name}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: SKY.deepLavender,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={userMenuAnchor}
              open={userMenuOpen}
              onClose={handleUserMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 200,
                  background: 'rgba(10, 10, 20, 0.98)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  '& .MuiMenuItem-root': {
                    px: 2,
                    py: 1.5,
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: 14,
                    gap: 1.5,
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.08)',
                    },
                  },
                  '& .MuiDivider-root': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 14 }}>
                  {user?.name || 'User'}
                </Typography>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}>
                  {user?.email}
                </Typography>
              </Box>
              <MenuItem component={Link} href="/dashboard" onClick={handleUserMenuClose}>
                <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                  <DashboardIcon fontSize="small" />
                </ListItemIcon>
                Dashboard
              </MenuItem>
              <MenuItem component={Link} href="/account" onClick={handleUserMenuClose}>
                <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                  <AccountCircleIcon fontSize="small" />
                </ListItemIcon>
                Account Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: '#ef4444 !important' }}>
                <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Sign Out
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Link href="/access" style={{ textDecoration: 'none' }}>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              sx={{
                background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                color: 'white',
                px: 2.5,
                py: 1,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 4px 16px ${SKY.deepCyan}30`,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  background: `linear-gradient(135deg, ${SKY.steelBlue}, ${SKY.mauveRose})`,
                },
              }}
            >
              Get Access
            </Button>
          </Link>
        )}
      </Box>

      {/* Menu Drawer */}
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            background: 'linear-gradient(180deg, #0a0a14 0%, #080810 100%)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Drawer Header with Logo and Close */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Link href="/" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LogoIcon size={24} />
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  ONTOGRAPHIA LAB
                </Typography>
              </Box>
            </Link>
            <IconButton onClick={() => setMobileOpen(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
                <Box
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    px: 3,
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.6)',
                    '&:hover': {
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.06)',
                    },
                  }}
                >
                  {link.label}
                </Box>
              </Link>
            ))}
            <Box sx={{ mt: 2, px: 3 }}>
              <Link href="/access" style={{ textDecoration: 'none', width: '100%' }}>
                <Button
                  fullWidth
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                    color: 'white',
                    py: 1.5,
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: 'none',
                  }}
                >
                  Get Access
                </Button>
              </Link>
            </Box>
            {isLoggedIn && (
              <Box sx={{ mt: 1, px: 3 }}>
                <Link href="/dashboard" style={{ textDecoration: 'none', width: '100%' }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      py: 1.5,
                      fontSize: 14,
                      borderRadius: 2,
                      textTransform: 'none',
                    }}
                  >
                    Dashboard
                  </Button>
                </Link>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

// Ethereal floating orbs - simplified for performance
function EtherealOrbs() {
  // Reduced orb count for better performance
  const orbConfigs = [
    { color: SKY.deepCyan, size: 500, top: '5%', left: '-10%' },
    { color: SKY.deepLavender, size: 450, top: '55%', left: '65%' },
    { color: SKY.mauveRose, size: 380, top: '25%', left: '50%' },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        // GPU acceleration
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    >
      <style>
        {`
          @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) { .ethereal-orb, .float-anim { animation: none !important; } }
        `}
      </style>

      {/* Static colored orbs - no animation for better scroll performance */}
      {orbConfigs.map((orb, i) => (
        <Box
          key={i}
          className="ethereal-orb"
          sx={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}30 0%, ${orb.color}08 45%, transparent 70%)`,
            filter: 'blur(60px)',
            top: orb.top,
            left: orb.left,
            opacity: 0.5,
            willChange: 'transform',
          }}
        />
      ))}

      {/* Single subtle wandering glow */}
      <Box
        sx={{
          position: 'absolute',
          width: '50vw',
          height: '50vw',
          maxWidth: 600,
          maxHeight: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${SKY.periwinkle}12 0%, transparent 60%)`,
          filter: 'blur(40px)',
          top: '30%',
          left: '25%',
          opacity: 0.4,
        }}
      />
    </Box>
  );
}

// Constellation Effect - Static decorative elements (simplified for performance)
function GlassWindowLogo() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Static connection lines - decorative web */}
      <Box
        component="svg"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.06,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Radial lines from center */}
        <line x1="50" y1="50" x2="10" y2="20" stroke={SKY.skyCyan} strokeWidth="0.1" />
        <line x1="50" y1="50" x2="90" y2="15" stroke={SKY.periwinkle} strokeWidth="0.1" />
        <line x1="50" y1="50" x2="85" y2="85" stroke={SKY.lavender} strokeWidth="0.1" />
        <line x1="50" y1="50" x2="12" y2="75" stroke={SKY.skyCyan} strokeWidth="0.1" />
        {/* Outer connecting web */}
        <line x1="10" y1="20" x2="50" y2="5" stroke={SKY.periwinkle} strokeWidth="0.08" strokeDasharray="1 3" />
        <line x1="50" y1="5" x2="90" y2="15" stroke={SKY.lavender} strokeWidth="0.08" strokeDasharray="1 3" />
        <line x1="90" y1="15" x2="85" y2="85" stroke={SKY.skyCyan} strokeWidth="0.08" strokeDasharray="1 3" />
        <line x1="85" y1="85" x2="12" y2="75" stroke={SKY.lavender} strokeWidth="0.08" strokeDasharray="1 3" />
        <line x1="12" y1="75" x2="10" y2="20" stroke={SKY.periwinkle} strokeWidth="0.08" strokeDasharray="1 3" />
      </Box>

      {/* Static decorative nodes at fixed positions */}
      {[
        { top: '25%', left: '15%', size: 4, color: SKY.skyCyan },
        { top: '20%', left: '80%', size: 5, color: SKY.periwinkle },
        { top: '70%', left: '85%', size: 4, color: SKY.lavender },
        { top: '75%', left: '12%', size: 5, color: SKY.skyCyan },
      ].map((node, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: node.size,
            height: node.size,
            borderRadius: '50%',
            bgcolor: node.color,
            boxShadow: `0 0 ${node.size * 2}px ${node.color}50`,
            opacity: 0.5,
            top: node.top,
            left: node.left,
          }}
        />
      ))}
    </Box>
  );
}

// Feature card with timeline node
function FeatureCard({ feature, index, isLast, totalCount }) {
  // Alternate left/right positioning
  const isLeft = index % 2 === 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 2, md: 4 },
        flexDirection: { xs: 'column', md: isLeft ? 'row' : 'row-reverse' },
        position: 'relative',
        mb: { xs: 4, md: 6 },
      }}
    >
      {/* Timeline node */}
      <Box
        sx={{
          position: { xs: 'relative', md: 'absolute' },
          left: { md: '50%' },
          transform: { md: 'translateX(-50%)' },
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Glowing dot */}
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: feature.color,
            boxShadow: `0 0 20px ${feature.color}, 0 0 40px ${feature.color}60`,
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        />
        {/* Connecting line down */}
        {!isLast && (
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              width: 2,
              height: 80,
              background: `linear-gradient(to bottom, ${feature.color}60, ${SKY.deepLavender}30)`,
              mt: 1,
            }}
          />
        )}
      </Box>

      {/* Card */}
      <Box
        sx={{
          flex: 1,
          maxWidth: { xs: '100%', md: 480 },
          p: { xs: 3, md: 4 },
          background: 'rgba(15, 15, 25, 0.9)',
          borderRadius: 3,
          border: `1px solid ${feature.color}20`,
          borderLeft: { md: isLeft ? 'none' : `3px solid ${feature.color}60` },
          borderRight: { md: isLeft ? `3px solid ${feature.color}60` : 'none' },
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          ml: { md: isLeft ? 0 : 'auto' },
          mr: { md: isLeft ? 'auto' : 0 },
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 15px 40px ${feature.color}15`,
          },
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: feature.color,
              boxShadow: `0 0 12px ${feature.color}`,
            }}
          />
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: feature.color,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {feature.tag}
          </Typography>
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: 'white',
            mb: 2,
            fontSize: { xs: 22, md: 26 },
            letterSpacing: '-0.02em',
          }}
        >
          {feature.title}
        </Typography>

        <Typography
          sx={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: { xs: 15, md: 16 },
            lineHeight: 1.7,
          }}
        >
          {feature.description}
        </Typography>
      </Box>
    </Box>
  );
}

export default function LandingPage() {
  const { data: session, status } = useSession();
  const isLoggedIn = session?.user?.status === 'active';
  const [scrollY, setScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [heroAnimKey, setHeroAnimKey] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          setScrollY(y);
          setScrolled(y > 100);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for hero text animation - replay when scrolling back
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Increment key to force animation replay
            setHeroAnimKey(prev => prev + 1);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (status === 'loading') {
    return null;
  }

  const features = [
    {
      tag: 'Process',
      title: 'BPMN & Business Flows',
      description: 'Design business processes with industry-standard BPMN 2.0 notation. Swimlanes, pools, events, gateways—everything you need for professional process modeling.',
      color: SKY.deepCyan,
    },
    {
      tag: 'Architecture',
      title: 'UML & System Design',
      description: 'Class diagrams, sequence diagrams, C4 models, and component architecture. From code to cloud, visualize your entire system.',
      color: SKY.deepLavender,
    },
    {
      tag: 'Data',
      title: 'ERD & Database Modeling',
      description: 'Entity relationships, schemas, and data flows. Design your database architecture with precise control over every relationship.',
      color: SKY.mauveRose,
    },
    {
      tag: 'Ideation',
      title: 'Mind Maps & Brainstorming',
      description: 'Rapid keyboard-driven brainstorming. Tab to create children, Enter to branch. Ideas flow as fast as you can think.',
      color: SKY.warmPeach,
    },
  ];

  return (
    <>
      <Head>
        <title>Ontographia Lab - Visualize ideas. Build faster.</title>
        <meta
          name="description"
          content="Professional diagramming for modern teams. Create BPMN, UML, ERD, and mind map diagrams with real-time collaboration."
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      {/* Dark page wrapper */}
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#0a0a14', // Solid fallback color
          background: 'linear-gradient(180deg, #0d0d1a 0%, #0a0a14 50%, #080810 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <EtherealOrbs />
        <FloatingNav isLoggedIn={isLoggedIn} user={session?.user} />

      {/* Hero Section - Centered Logo with Animated Brand Name */}
      <Box
        component="section"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'sticky',
          top: 0,
          px: { xs: 2, md: 6 },
          zIndex: 1,
          transform: `translateY(${scrollY * 0.3}px)`,
          opacity: Math.max(0, 1 - scrollY / 600),
          transition: 'opacity 0.1s ease-out',
        }}
      >
        <style>
          {`
            @keyframes letterSlideIn {
              0% { opacity: 0; transform: translateY(12px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes labSlideIn {
              0% { opacity: 0; transform: translateX(-10px); }
              100% { opacity: 1; transform: translateX(0); }
            }
            @keyframes logoReveal {
              0% { opacity: 0; transform: scale(0.8); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes taglineFade {
              0% { opacity: 0; transform: translateY(10px); }
              100% { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>

        {/* Full-page constellation effect - orbiting nodes as background */}
        <GlassWindowLogo />

        {/* Central brand lockup - Logo above, text below */}
        <Box
          ref={heroRef}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Logo - large and centered */}
          <Box
            sx={{
              width: { xs: 80, sm: 100, md: 120, lg: 140 },
              height: { xs: 80, sm: 100, md: 120, lg: 140 },
              mb: { xs: 3, md: 4 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              animation: 'logoReveal 0.8s ease-out 0.2s forwards',
              filter: `drop-shadow(0 0 30px ${SKY.periwinkle}40)`,
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 512 512"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="heroArmA" x1="160" y1="130" x2="260" y2="260">
                  <stop offset="0%" stopColor="#7AD9E8"/>
                  <stop offset="100%" stopColor="#5FB8E6"/>
                </linearGradient>
                <linearGradient id="heroArmB" x1="260" y1="260" x2="440" y2="260">
                  <stop offset="0%" stopColor="#7A8EE8"/>
                  <stop offset="100%" stopColor="#5E6FD6"/>
                </linearGradient>
                <linearGradient id="heroArmC" x1="260" y1="260" x2="190" y2="440">
                  <stop offset="0%" stopColor="#9C8FE8"/>
                  <stop offset="100%" stopColor="#7A6AD6"/>
                </linearGradient>
              </defs>
              <path d="M256 256 C232 216, 198 182, 164 138" stroke="url(#heroArmA)" strokeWidth="54" strokeLinecap="round" fill="none"/>
              <path d="M256 256 C308 236, 370 242, 438 268" stroke="url(#heroArmB)" strokeWidth="54" strokeLinecap="round" fill="none"/>
              <path d="M256 256 C258 318, 228 368, 204 432" stroke="url(#heroArmC)" strokeWidth="54" strokeLinecap="round" fill="none"/>
              <circle cx="256" cy="256" r="36" fill="#6F7FDB" opacity="0.95"/>
              <circle cx="256" cy="256" r="7" fill="#3F466E" opacity="0.95"/>
            </svg>
          </Box>

          {/* ONTOGRAPHIA LAB - together as one unit */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: { xs: 1, sm: 1.5, md: 2 },
            }}
          >
            <Typography
              component="span"
              sx={{
                display: 'flex',
                fontSize: { xs: 20, sm: 28, md: 36, lg: 44 },
                fontFamily: '"TASA Explorer", sans-serif',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#FAF8F3', // Subtle warm sepia white - classic clean text
              }}
            >
              {'ONTOGRAPHIA'.split('').map((letter, i) => (
                <Box
                  key={`onto-${i}`}
                  component="span"
                  sx={{
                    display: 'inline-block',
                    opacity: 0,
                    animation: `letterSlideIn 0.4s ease-out ${0.6 + i * 0.04}s forwards`,
                  }}
                >
                  {letter}
                </Box>
              ))}
            </Typography>
            <Typography
              component="span"
              sx={{
                display: 'flex',
                fontSize: { xs: 20, sm: 28, md: 36, lg: 44 },
                fontFamily: '"TASA Explorer", sans-serif',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: SKY.skyCyan,
              }}
            >
              {'LAB'.split('').map((letter, i) => (
                <Box
                  key={`lab-${i}`}
                  component="span"
                  sx={{
                    display: 'inline-block',
                    opacity: 0,
                    animation: `letterSlideIn 0.4s ease-out ${1.1 + i * 0.06}s forwards`,
                  }}
                >
                  {letter}
                </Box>
              ))}
            </Typography>
          </Box>
        </Box>

        {/* Tagline below */}
        <Box
          sx={{
            mt: { xs: 3, md: 5 },
            textAlign: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: { xs: 14, sm: 16, md: 18 },
              fontWeight: 400,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              opacity: 0,
              animation: 'taglineFade 0.6s ease-out 1.6s forwards',
            }}
          >
            Visualize ideas. Build faster.
          </Typography>
        </Box>

        {/* CTA Button */}
        <Box
          sx={{
            mt: { xs: 3, md: 4 },
            position: 'relative',
            zIndex: 2,
            opacity: 0,
            animation: 'taglineFade 0.6s ease-out 1.9s forwards',
          }}
        >
          <Button
            component={Link}
            href={isLoggedIn ? '/dashboard' : '/login'}
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{
              background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
              py: 1.5,
              px: 4,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 3,
              boxShadow: `0 8px 40px ${SKY.deepLavender}30`,
              transition: 'all 0.3s ease',
              pointerEvents: 'auto',
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: `0 16px 50px ${SKY.deepLavender}40`,
              },
            }}
          >
            {isLoggedIn ? 'Open Dashboard' : 'Start Creating'}
          </Button>
        </Box>

        {/* Scroll indicator */}
        <Box
          className="float-anim"
          sx={{
            position: 'absolute',
            bottom: { xs: 24, md: 40 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            animation: 'float 3s ease-in-out infinite',
            zIndex: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Explore
          </Typography>
          <KeyboardArrowDownIcon
            sx={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 24,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        </Box>
      </Box>

      {/* Content that scrolls over hero - Parallax overlay */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          background: 'linear-gradient(180deg, #0d0d1a00 0%, #0a0a14 8%, #080810 100%)',
          mt: '-20vh',
          pt: '25vh',
          borderTopLeftRadius: 40,
          borderTopRightRadius: 40,
        }}
      >
      {/* Features Section - Timeline with connected cards */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          py: { xs: 8, md: 12 },
          px: { xs: 2, md: 6 },
          maxWidth: 1000,
          mx: 'auto',
          contentVisibility: 'auto',
          containIntrinsicSize: '0 800px',
        }}
      >
        {/* Central timeline line (desktop only) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute',
            left: '50%',
            top: 60,
            bottom: 60,
            width: 2,
            background: `linear-gradient(to bottom, transparent, ${SKY.deepCyan}30 10%, ${SKY.deepLavender}30 50%, ${SKY.warmPeach}30 90%, transparent)`,
            transform: 'translateX(-50%)',
            zIndex: 1,
          }}
        />

        {features.map((feature, index) => (
          <FeatureCard
            key={feature.tag}
            feature={feature}
            index={index}
            isLast={index === features.length - 1}
            totalCount={features.length}
          />
        ))}
      </Box>

      {/* Industry Stats Section */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          py: { xs: 10, md: 14 },
          px: { xs: 2, md: 6 },
          contentVisibility: 'auto',
          containIntrinsicSize: '0 600px',
        }}
      >
        {/* Background accent */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 30% 50%, ${SKY.deepCyan}08 0%, transparent 50%),
                         radial-gradient(ellipse at 70% 50%, ${SKY.deepLavender}08 0%, transparent 50%)`,
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ maxWidth: 1100, mx: 'auto', position: 'relative' }}>
          <Typography
            sx={{
              textAlign: 'center',
              fontSize: { xs: 12, md: 13 },
              fontWeight: 600,
              color: SKY.deepLavender,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              mb: 2,
            }}
          >
            Why Visual Thinking Matters
          </Typography>

          <Typography
            variant="h2"
            sx={{
              textAlign: 'center',
              fontSize: { xs: 24, md: 32 },
              fontWeight: 700,
              color: 'white',
              mb: { xs: 6, md: 8 },
              letterSpacing: '-0.02em',
            }}
          >
            The power of visualization
          </Typography>

          {/* Stats Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: { xs: 3, md: 4 },
            }}
          >
            {[
              {
                value: '65%',
                label: 'of people are visual learners',
                subtext: 'VARK Learning Model',
                color: SKY.deepCyan,
              },
              {
                value: '60,000×',
                label: 'faster visual processing',
                subtext: 'vs. text-based information',
                color: SKY.steelBlue,
              },
              {
                value: '400%',
                label: 'better comprehension',
                subtext: 'with visual documentation',
                color: SKY.deepLavender,
              },
              {
                value: '89%',
                label: 'of enterprises',
                subtext: 'use process modeling tools',
                color: SKY.mauveRose,
              },
            ].map((stat, index) => (
              <Box
                key={index}
                sx={{
                  textAlign: 'center',
                  p: { xs: 3, md: 4 },
                  background: 'rgba(15, 15, 25, 0.85)',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'transform 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: 32, md: 42 },
                    fontWeight: 800,
                    background: `linear-gradient(135deg, ${stat.color}, ${stat.color}99)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    lineHeight: 1,
                    mb: 1.5,
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: 14, md: 15 },
                    fontWeight: 600,
                    color: 'white',
                    mb: 0.5,
                  }}
                >
                  {stat.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: 11, md: 12 },
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {stat.subtext}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Frameworks supported callout */}
          <Box
            sx={{
              mt: { xs: 6, md: 8 },
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: 13, md: 14 },
                color: 'rgba(255,255,255,0.5)',
                mb: 3,
              }}
            >
              Supporting industry-standard frameworks
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: { xs: 1.5, md: 2 },
              }}
            >
              {['BPMN 2.0', 'UML 2.5', 'ERD', 'C4 Model', 'TOGAF', 'ArchiMate', 'Mind Maps'].map((framework) => (
                <Box
                  key={framework}
                  sx={{
                    px: { xs: 2, md: 3 },
                    py: 1,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: { xs: 12, md: 13 },
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.7)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: `${SKY.deepLavender}15`,
                      borderColor: `${SKY.deepLavender}40`,
                      color: 'white',
                    },
                  }}
                >
                  {framework}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Final CTA */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          py: { xs: 12, md: 16 },
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, ${SKY.deepLavender}10 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />

        <Button
          component={Link}
          href={isLoggedIn ? '/dashboard' : '/login'}
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          sx={{
            position: 'relative',
            background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
            py: 2,
            px: 6,
            fontSize: 18,
            fontWeight: 600,
            borderRadius: 3,
            boxShadow: `0 8px 40px ${SKY.deepLavender}30`,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: `0 16px 50px ${SKY.deepLavender}40`,
            },
          }}
        >
          {isLoggedIn ? 'Open Dashboard' : 'Start Creating'}
        </Button>
      </Box>

      {/* Professional Footer with Sitemap */}
      <Footer />
      </Box>{/* Close parallax overlay wrapper */}

      </Box>{/* Close dark page wrapper */}
    </>
  );
}
