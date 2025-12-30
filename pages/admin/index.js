// pages/admin/index.js
// Admin dashboard - overview and quick actions

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Typography,
  Container,
  Grid,
  Paper,
  Button,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ArticleIcon from '@mui/icons-material/Article';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { UserMenu } from '../../components/ui/UserMenu';
import Logo from '../../components/ui/Logo';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading' || !session || session.user?.role !== 'admin') {
    return null;
  }

  return (
    <>
      <Head>
        <title>Admin - Ontographia Lab</title>
      </Head>

      {/* Header */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          bgcolor: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Container maxWidth="xl">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <Logo size={36} textColor="var(--text)" />
              </Link>
              <Typography
                sx={{
                  bgcolor: '#dc2626',
                  color: 'white',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ADMIN
              </Typography>
            </Box>

            <UserMenu />
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box sx={{ minHeight: 'calc(100vh - 65px)', bgcolor: 'var(--bg)', py: 4 }}>
        <Container maxWidth="xl">
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--text)', mb: 1 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 4 }}>
            Manage users, diagrams, and system settings
          </Typography>

          <Grid container spacing={3}>
            {/* User Management Card */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  <PeopleIcon sx={{ color: '#2563eb', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  User Management
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'var(--text-muted)', mb: 3, flex: 1 }}
                >
                  View all users, approve pending accounts, and manage roles.
                </Typography>
                <Button
                  component={Link}
                  href="/admin/users"
                  variant="outlined"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Manage Users
                </Button>
              </Paper>
            </Grid>

            {/* Pending Approvals Card */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  <PendingActionsIcon sx={{ color: '#d97706', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Pending Approvals
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'var(--text-muted)', mb: 3, flex: 1 }}
                >
                  Review and approve new user registrations.
                </Typography>
                <Button
                  component={Link}
                  href="/admin/users?status=pending"
                  variant="outlined"
                  color="warning"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Review Pending
                </Button>
              </Paper>
            </Grid>

            {/* All Diagrams Card */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: '#d1fae5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  <ArticleIcon sx={{ color: '#059669', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  All Diagrams
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'var(--text-muted)', mb: 3, flex: 1 }}
                >
                  View all diagrams across the system.
                </Typography>
                <Button
                  component={Link}
                  href="/dashboard"
                  variant="outlined"
                  color="success"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  View Diagrams
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
