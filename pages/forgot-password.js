// pages/forgot-password.js
// Forgot password page - request password reset link

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Button,
  Typography,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
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

// Generate a simple math CAPTCHA
function generateCaptcha() {
  const operations = ['+', '-', '×'];
  const op = operations[Math.floor(Math.random() * operations.length)];
  let a, b, answer;

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * a);
      answer = a - b;
      break;
    case '×':
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a * b;
      break;
  }

  return { question: `${a} ${op} ${b} = ?`, answer: answer.toString() };
}

export default function ForgotPasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captcha, setCaptcha] = useState({ question: '', answer: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState(''); // For dev mode

  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!captchaAnswer) {
      setError('Please complete the verification challenge');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          captchaAnswer,
          captchaExpected: captcha.answer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send reset email');
        refreshCaptcha();
        setLoading(false);
        return;
      }

      setSuccess(true);
      // In development, show the reset URL
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      refreshCaptcha();
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password - Ontographia Lab</title>
        <meta name="description" content="Reset your Ontographia Lab password" />
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
          <Box
            sx={{
              position: 'absolute',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.steelBlue}40 0%, transparent 70%)`,
              top: '-5%',
              right: '10%',
              animation: 'float1 14s ease-in-out infinite',
              '@keyframes float1': {
                '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                '50%': { transform: 'translate(-20px, 30px) scale(1.05)' },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.mauveRose}30 0%, transparent 70%)`,
              bottom: '20%',
              left: '5%',
              animation: 'float2 12s ease-in-out infinite',
              '@keyframes float2': {
                '0%, 100%': { transform: 'translate(0, 0)' },
                '50%': { transform: 'translate(25px, -20px)' },
              },
            }}
          />
        </Box>

        {/* Card */}
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
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Logo size={48} showText={false} />
          </Box>

          {success ? (
            <>
              <CheckCircleOutlineIcon
                sx={{ fontSize: 64, color: '#22c55e', mb: 2 }}
              />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.95)',
                  mb: 1,
                }}
              >
                Check Your Email
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}
              >
                If an account exists for {email}, you will receive a password reset link shortly.
              </Typography>

              {/* Development mode - show reset URL */}
              {resetUrl && (
                <Alert
                  severity="info"
                  sx={{
                    mb: 3,
                    textAlign: 'left',
                    bgcolor: 'rgba(79, 179, 206, 0.1)',
                    border: '1px solid rgba(79, 179, 206, 0.3)',
                    color: SKY.deepCyan,
                    '& .MuiAlert-icon': { color: SKY.deepCyan },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Development Mode:
                  </Typography>
                  <br />
                  <Link
                    href={resetUrl}
                    style={{ color: SKY.skyReturn, wordBreak: 'break-all' }}
                  >
                    Click here to reset password
                  </Link>
                </Alert>
              )}

              <Button
                component={Link}
                href="/login"
                variant="contained"
                sx={{
                  py: 1.5,
                  px: 4,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${SKY.deepLavender} 0%, ${SKY.mauveRose} 100%)`,
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                Back to Sign In
              </Button>
            </>
          ) : (
            <>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.95)',
                  mb: 1,
                  fontFamily: '"TASA Explorer", sans-serif',
                }}
              >
                Forgot Password
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4 }}
              >
                Enter your email to receive a reset link
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

              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 2,
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&.Mui-focused fieldset': { borderColor: SKY.deepLavender },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-focused': { color: SKY.deepLavender },
                    },
                    '& .MuiOutlinedInput-input': { color: 'rgba(255, 255, 255, 0.9)' },
                  }}
                />

                {/* CAPTCHA */}
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mb: 1 }}
                  >
                    Verify you&apos;re human
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography
                      sx={{
                        color: SKY.deepCyan,
                        fontFamily: 'monospace',
                        fontSize: 18,
                        fontWeight: 600,
                        px: 2,
                        py: 1,
                        borderRadius: 1,
                        bgcolor: 'rgba(79, 179, 206, 0.1)',
                        border: '1px solid rgba(79, 179, 206, 0.3)',
                      }}
                    >
                      {captcha.question}
                    </Typography>
                    <TextField
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Answer"
                      size="small"
                      sx={{
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                          '&.Mui-focused fieldset': { borderColor: SKY.deepCyan },
                        },
                        '& .MuiOutlinedInput-input': {
                          color: 'rgba(255, 255, 255, 0.9)',
                          textAlign: 'center',
                        },
                      }}
                    />
                    <Button
                      size="small"
                      onClick={refreshCaptcha}
                      sx={{
                        minWidth: 'auto',
                        color: 'rgba(255, 255, 255, 0.5)',
                        '&:hover': { color: SKY.deepCyan },
                      }}
                    >
                      ↻
                    </Button>
                  </Box>
                </Box>

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <EmailIcon />}
                  sx={{
                    py: 1.5,
                    mb: 3,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${SKY.deepLavender} 0%, ${SKY.mauveRose} 100%)`,
                    fontWeight: 600,
                    fontSize: 15,
                    textTransform: 'none',
                    boxShadow: `0 4px 20px ${SKY.deepLavender}40`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${SKY.mauveRose} 0%, ${SKY.deepLavender} 100%)`,
                    },
                    '&:disabled': {
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.4)',
                    },
                  }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </Box>

              <Button
                component={Link}
                href="/login"
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
                Back to Sign In
              </Button>
            </>
          )}
        </Box>
      </Box>
    </>
  );
}
