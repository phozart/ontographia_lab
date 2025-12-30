// components/landing/FloatingNav.js
// Shared floating navigation for all landing pages

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Box, Typography, Button, IconButton, Drawer } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { LogoIcon } from '../ui/Logo';

// Ethereal Sky Palette
const SKY = {
  deepCyan: '#4FB3CE',
  steelBlue: '#6A9FC9',
  deepLavender: '#9A8AC8',
  mauveRose: '#C490B0',
  warmPeach: '#E8A99A',
  goldenHour: '#F0D98A',
};

export const NAV_LINKS = [
  { label: 'Product', href: '/product' },
  { label: 'Guide', href: '/guide' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'About', href: '/about' },
];

export default function FloatingNav({ alwaysLeft = false }) {
  const { data: session } = useSession();
  const isLoggedIn = session?.user?.status === 'active';
  const [mobileOpen, setMobileOpen] = useState(false);

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
          backdropFilter: 'blur(20px)',
          background: 'rgba(10, 10, 20, 0.9)',
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

      {/* Top right - Dashboard/Login Button */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 100,
        }}
      >
        <Link href={isLoggedIn ? "/dashboard" : "/access"} style={{ textDecoration: 'none' }}>
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
              backdropFilter: 'blur(20px)',
              boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 4px 16px ${SKY.deepCyan}30`,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': {
                background: `linear-gradient(135deg, ${SKY.steelBlue}, ${SKY.mauveRose})`,
              },
            }}
          >
            {isLoggedIn ? 'Dashboard' : 'Get Access'}
          </Button>
        </Link>
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
            <Box sx={{ my: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />
            <Link href={isLoggedIn ? "/dashboard" : "/access"} style={{ textDecoration: 'none' }}>
              <Box
                onClick={() => setMobileOpen(false)}
                sx={{
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: 15,
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                  color: 'white',
                  textAlign: 'center',
                }}
              >
                {isLoggedIn ? 'Dashboard' : 'Get Access'}
              </Box>
            </Link>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
