// pages/login.js
// Login page with Ethereal Sky theme - email/password and OAuth providers
// "Driving through color — the sky wrapping around you — inside the gradient."

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Button,
  Typography,
  Divider,
  Alert,
  TextField,
  CircularProgress,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoginIcon from '@mui/icons-material/Login';
import Logo from '../components/ui/Logo';

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

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { error: queryError, callbackUrl } = router.query;

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      if (session.user?.status === 'pending') {
        router.push('/pending-approval');
      } else if (session.user?.status === 'active') {
        router.push(callbackUrl || '/dashboard');
      }
    }
  }, [session, router, callbackUrl]);

  useEffect(() => {
    if (queryError) {
      setError(getErrorMessage(queryError));
    }
  }, [queryError]);

  if (status === 'loading') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        }}
      >
        <CircularProgress sx={{ color: SKY.deepLavender }} />
      </Box>
    );
  }

  const getErrorMessage = (error) => {
    switch (error) {
      case 'OAuthSignin':
      case 'OAuthCallback':
        return 'There was a problem with the OAuth provider. Please try again.';
      case 'OAuthCreateAccount':
        return 'Could not create your account. Please try again.';
      case 'Callback':
        return 'Authentication callback failed. Please try again.';
      case 'suspended':
        return 'Your account has been suspended. Please contact an administrator.';
      case 'CredentialsSignin':
        return 'Invalid email or password. Please try again.';
      default:
        return error || 'An error occurred during sign in. Please try again.';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else if (result?.ok) {
        router.push(callbackUrl || '/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In - Ontographia Lab</title>
        <meta name="description" content="Sign in to Ontographia Lab - Your collaborative diagramming workspace" />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
          position: 'relative',
          overflow: 'hidden',
          p: 2,
        }}
      >
        {/* Floating Orbs Background */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {/* Cyan orb - top left */}
          <Box
            sx={{
              position: 'absolute',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.deepCyan}40 0%, transparent 70%)`,
              top: '-5%',
              left: '-5%',
              animation: 'float1 12s ease-in-out infinite',
              '@keyframes float1': {
                '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                '50%': { transform: 'translate(30px, 20px) scale(1.05)' },
              },
            }}
          />
          {/* Lavender orb - top right */}
          <Box
            sx={{
              position: 'absolute',
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.deepLavender}35 0%, transparent 70%)`,
              top: '10%',
              right: '5%',
              animation: 'float2 14s ease-in-out infinite',
              '@keyframes float2': {
                '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                '50%': { transform: 'translate(-25px, 30px) scale(0.95)' },
              },
            }}
          />
          {/* Peach orb - bottom left */}
          <Box
            sx={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.warmPeach}30 0%, transparent 70%)`,
              bottom: '15%',
              left: '10%',
              animation: 'float3 16s ease-in-out infinite',
              '@keyframes float3': {
                '0%, 100%': { transform: 'translate(0, 0)' },
                '50%': { transform: 'translate(20px, -25px)' },
              },
            }}
          />
          {/* Sky return orb - bottom right */}
          <Box
            sx={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.skyReturn}35 0%, transparent 70%)`,
              bottom: '5%',
              right: '15%',
              animation: 'float4 13s ease-in-out infinite',
              '@keyframes float4': {
                '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                '50%': { transform: 'translate(-15px, -20px) scale(1.08)' },
              },
            }}
          />
        </Box>

        {/* Login Card - Glass Morphism */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            p: { xs: 4, sm: 5 },
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 0 60px rgba(154, 138, 200, 0.1)',
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Logo size={48} showText={false} />
          </Box>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.95)',
              mb: 1,
              fontFamily: '"TASA Explorer", sans-serif',
            }}
          >
            Welcome back
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4 }}
          >
            Sign in to access your diagrams
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                textAlign: 'left',
                bgcolor: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#fca5a5',
                '& .MuiAlert-icon': { color: '#f87171' },
              }}
            >
              {error}
            </Alert>
          )}

          {/* Email/Password Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
              />
            </div>

            <style jsx>{`
              .login-field {
                margin-bottom: 16px;
              }
              .login-field label {
                display: block;
                margin-bottom: 6px;
                font-size: 14px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.7);
              }
              .login-field input {
                width: 100%;
                padding: 14px 16px;
                font-size: 16px;
                color: #ffffff;
                background-color: rgba(30, 30, 50, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                outline: none;
                transition: all 0.2s ease;
                box-sizing: border-box;
                -webkit-text-fill-color: #ffffff;
              }
              .login-field input::placeholder {
                color: rgba(255, 255, 255, 0.3);
              }
              .login-field input:hover {
                border-color: rgba(255, 255, 255, 0.25);
                background-color: rgba(40, 40, 60, 0.9);
              }
              .login-field input:focus {
                border-color: ${SKY.deepLavender};
                background-color: rgba(40, 40, 60, 0.95);
                box-shadow: 0 0 0 3px rgba(154, 138, 200, 0.2);
              }
              .login-field input:-webkit-autofill,
              .login-field input:-webkit-autofill:hover,
              .login-field input:-webkit-autofill:focus {
                -webkit-box-shadow: 0 0 0 100px rgba(30, 30, 50, 0.95) inset !important;
                -webkit-text-fill-color: #ffffff !important;
                border-color: rgba(255, 255, 255, 0.15);
              }
            `}</style>

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <LoginIcon />}
              sx={{
                py: 1.5,
                mb: 1,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${SKY.deepLavender} 0%, ${SKY.mauveRose} 100%)`,
                fontWeight: 600,
                fontSize: 15,
                textTransform: 'none',
                boxShadow: `0 4px 20px ${SKY.deepLavender}40`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${SKY.mauveRose} 0%, ${SKY.deepLavender} 100%)`,
                  boxShadow: `0 6px 24px ${SKY.deepLavender}50`,
                },
                '&:disabled': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                },
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'right', mb: 2 }}>
              <Link
                href="/forgot-password"
                style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                }}
              >
                Forgot password?
              </Link>
            </Box>
          </Box>

          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2 }}
          >
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              style={{
                color: SKY.deepCyan,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Create one
            </Link>
          </Typography>

          <Divider
            sx={{
              my: 3,
              '&::before, &::after': {
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', px: 1 }}>
              Or continue with
            </Typography>
          </Divider>

          <Button
            fullWidth
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            sx={{
              py: 1.5,
              mb: 2,
              borderRadius: 2,
              bgcolor: '#4285f4',
              fontWeight: 500,
              fontSize: 15,
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#3367d6',
              },
            }}
          >
            Continue with Google
          </Button>

          <Button
            fullWidth
            variant="outlined"
            startIcon={<GitHubIcon />}
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            sx={{
              py: 1.5,
              mb: 3,
              borderRadius: 2,
              fontWeight: 500,
              fontSize: 15,
              textTransform: 'none',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.4)',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Continue with GitHub
          </Button>

          <Button
            component={Link}
            href="/"
            startIcon={<ArrowBackIcon />}
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'none',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: SKY.deepCyan,
              },
            }}
          >
            Back to home
          </Button>
        </Box>
      </Box>
    </>
  );
}
