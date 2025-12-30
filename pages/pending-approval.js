// pages/pending-approval.js
// Page shown to users awaiting admin approval

import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Box, Typography, Button, Paper, Avatar } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import Logo from '../components/ui/Logo';

export default function PendingApprovalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // Redirect if already approved
    if (session?.user?.status === 'active') {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  const handleRefresh = () => {
    // Force session refresh by reloading
    window.location.reload();
  };

  if (status === 'loading') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--bg)',
        }}
      >
        <Typography sx={{ color: 'var(--text-muted)' }}>Loading...</Typography>
      </Box>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Pending Approval - Diagram Studio</title>
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--bg)',
          p: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 6 },
            maxWidth: 480,
            width: '100%',
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: 'var(--panel)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Logo size={48} showText={false} />
          </Box>

          {/* Pending Icon */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <HourglassEmptyIcon sx={{ fontSize: 32, color: '#d97706' }} />
          </Box>

          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: 'var(--text)', mb: 1 }}
          >
            Account Pending Approval
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'var(--text-muted)',
              mb: 4,
              lineHeight: 1.7,
            }}
          >
            Your account has been created successfully. An administrator will
            review your request and approve your access shortly.
          </Typography>

          {/* User Info */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              bgcolor: 'var(--bg)',
              borderRadius: 2,
              mb: 4,
            }}
          >
            <Avatar
              src={session.user.image}
              alt={session.user.name}
              sx={{ width: 48, height: 48 }}
            >
              {session.user.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ textAlign: 'left' }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, color: 'var(--text)' }}
              >
                {session.user.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                {session.user.email}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              sx={{
                borderColor: 'var(--border)',
                color: 'var(--text)',
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'var(--text-muted)',
                  bgcolor: 'var(--bg)',
                },
              }}
            >
              Check Status
            </Button>
            <Button
              variant="text"
              startIcon={<LogoutIcon />}
              onClick={() => signOut({ callbackUrl: '/' })}
              sx={{
                color: 'var(--text-muted)',
                textTransform: 'none',
              }}
            >
              Sign Out
            </Button>
          </Box>

          {/* Help Text */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'var(--text-light)',
              mt: 4,
            }}
          >
            If you believe this is taking too long, please contact your
            organization&apos;s administrator.
          </Typography>
        </Paper>
      </Box>
    </>
  );
}
