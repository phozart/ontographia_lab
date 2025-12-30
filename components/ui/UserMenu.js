// components/ui/UserMenu.js
// User profile dropdown menu

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Typography,
  IconButton,
  ListItemIcon,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { RoleBadge } from './StatusBadge';

export function UserMenu() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  if (!session) return null;

  const isAdmin = session.user?.role === 'admin';

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          p: 0.5,
          border: '2px solid transparent',
          '&:hover': {
            borderColor: 'var(--border)',
          },
        }}
      >
        <Avatar
          src={session.user.image}
          alt={session.user.name}
          sx={{
            width: 36,
            height: 36,
            bgcolor: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {session.user.name?.[0]?.toUpperCase() || 'U'}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 260,
            mt: 1,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
            bgcolor: 'var(--panel)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Avatar
              src={session.user.image}
              alt={session.user.name}
              sx={{ width: 40, height: 40 }}
            >
              {session.user.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session.user.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {session.user.email}
              </Typography>
            </Box>
          </Box>
          <RoleBadge role={session.user.role} />
        </Box>

        <Divider sx={{ borderColor: 'var(--border)' }} />

        <MenuItem component={Link} href="/dashboard" sx={{ py: 1.5 }}>
          <ListItemIcon>
            <DashboardIcon fontSize="small" sx={{ color: 'var(--text-muted)' }} />
          </ListItemIcon>
          <Typography variant="body2">Dashboard</Typography>
        </MenuItem>

        {isAdmin && (
          <MenuItem component={Link} href="/admin" sx={{ py: 1.5 }}>
            <ListItemIcon>
              <AdminPanelSettingsIcon
                fontSize="small"
                sx={{ color: 'var(--text-muted)' }}
              />
            </ListItemIcon>
            <Typography variant="body2">Admin Panel</Typography>
          </MenuItem>
        )}

        <Divider sx={{ borderColor: 'var(--border)' }} />

        <MenuItem
          onClick={() => signOut({ callbackUrl: '/' })}
          sx={{ py: 1.5, color: 'error.main' }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <Typography variant="body2">Sign out</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
