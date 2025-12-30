// pages/account.js
// User account page - profile, change password, logout

import { useState, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Avatar,
  Divider,
  CircularProgress,
  LinearProgress,
  Paper,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import AppSidebar from '../components/ui/AppSidebar';
import { RoleBadge, StatusBadge } from '../components/ui/StatusBadge';

// Password requirements
const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Redirect if not logged in
  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const user = session.user;
  const isOAuthUser = user.image && !user.email?.includes('@example.com'); // OAuth users have profile images

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    const passed = PASSWORD_REQUIREMENTS.filter(req => req.test(newPassword)).length;
    return {
      score: passed,
      total: PASSWORD_REQUIREMENTS.length,
      percentage: (passed / PASSWORD_REQUIREMENTS.length) * 100,
      isValid: passed === PASSWORD_REQUIREMENTS.length,
    };
  }, [newPassword]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (!passwordStrength.isValid) {
      setError('New password does not meet all requirements');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        setLoading(false);
        return;
      }

      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setLoading(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <>
      <Head>
        <title>Account - Ontographia Lab</title>
      </Head>

      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'var(--bg)' }}>
        <AppSidebar />

        <Box sx={{ flex: 1, p: 4, maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--text)', mb: 4 }}>
            Account Settings
          </Typography>

          {/* Profile Section */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              bgcolor: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
              <Avatar
                src={user.image}
                alt={user.name}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'var(--accent)',
                  fontSize: 32,
                  fontWeight: 600,
                }}
              >
                {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600, color: 'var(--text)' }}>
                  {user.name || 'User'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <RoleBadge role={user.role} />
                  <StatusBadge status={user.status} />
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2, borderColor: 'var(--border)' }} />

            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EmailIcon sx={{ color: 'var(--text-muted)' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                    Email
                  </Typography>
                  <Typography sx={{ color: 'var(--text)' }}>{user.email}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BadgeIcon sx={{ color: 'var(--text-muted)' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                    Account Type
                  </Typography>
                  <Typography sx={{ color: 'var(--text)', textTransform: 'capitalize' }}>
                    {user.subscriptionTier || 'Free'} Plan
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Change Password Section */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              bgcolor: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <LockIcon sx={{ color: 'var(--text-muted)' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text)' }}>
                Password
              </Typography>
            </Box>

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {!showPasswordForm ? (
              <Button
                variant="outlined"
                onClick={() => setShowPasswordForm(true)}
                sx={{
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  '&:hover': {
                    borderColor: 'var(--accent)',
                    bgcolor: 'var(--accent-light)',
                  },
                }}
              >
                Change Password
              </Button>
            ) : (
              <Box component="form" onSubmit={handleChangePassword}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  sx={{ mb: 1 }}
                />

                {/* Password Strength Indicator */}
                {newPassword && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={passwordStrength.percentage}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'var(--border)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: passwordStrength.percentage === 100
                              ? '#22c55e'
                              : passwordStrength.percentage >= 60
                              ? '#eab308'
                              : '#ef4444',
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                        {passwordStrength.score}/{passwordStrength.total}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {PASSWORD_REQUIREMENTS.map((req) => {
                        const passed = req.test(newPassword);
                        return (
                          <Box
                            key={req.key}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              bgcolor: passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${passed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            }}
                          >
                            {passed ? (
                              <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                            ) : (
                              <CancelIcon sx={{ fontSize: 14, color: '#ef4444' }} />
                            )}
                            <Typography
                              variant="caption"
                              sx={{ color: passed ? '#22c55e' : '#ef4444', fontSize: 11 }}
                            >
                              {req.label}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  error={confirmPassword && newPassword !== confirmPassword}
                  helperText={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
                  sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || !passwordStrength.isValid}
                    sx={{ bgcolor: 'var(--accent)' }}
                  >
                    {loading ? 'Saving...' : 'Update Password'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setError('');
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    sx={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>

          {/* Logout Section */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text)', mb: 2 }}>
              Session
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 2 }}>
              Sign out of your account on this device.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </Paper>
        </Box>
      </Box>
    </>
  );
}
