// components/ui/ResponsiveNav.js
// Shared responsive navigation for app-shell pages: inline AppSidebar on
// desktop, temporary Drawer (opened from a menu button) below the md breakpoint.

import { useState } from 'react';
import { Box, Drawer, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import AppSidebar from './AppSidebar';
import { LogoIcon } from './Logo';

export function useResponsiveNav() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [navOpen, setNavOpen] = useState(false);
  return { isMobile, navOpen, openNav: () => setNavOpen(true), closeNav: () => setNavOpen(false) };
}

export function ResponsiveSidebar({ nav, onCreateWorkspace }) {
  if (!nav.isMobile) return <AppSidebar onCreateWorkspace={onCreateWorkspace} />;
  return (
    <Drawer
      anchor="left"
      open={nav.navOpen}
      onClose={nav.closeNav}
      PaperProps={{ sx: { width: 240 } }}
    >
      {/* Any nav item click (link or button) bubbles here and closes the drawer */}
      <div style={{ height: '100%' }} onClick={nav.closeNav}>
        <AppSidebar forceExpanded onCreateWorkspace={onCreateWorkspace} />
      </div>
    </Drawer>
  );
}

export function MobileNavBar({ nav }) {
  if (!nav.isMobile) return null;
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderBottom: '1px solid var(--border, #e2e8f0)',
        bgcolor: 'var(--panel, #ffffff)',
      }}
    >
      <IconButton aria-label="Open navigation menu" onClick={nav.openNav}>
        <MenuIcon />
      </IconButton>
      <LogoIcon size={24} />
    </Box>
  );
}
