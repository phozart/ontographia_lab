// pages/reset-password.js
// Reset password page - complete password reset with token

import { useState, useEffect, useMemo } from 'react';
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
  LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockResetIcon from '@mui/icons-material/LockReset';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
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

// Password requirements
const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$%...)', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

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

export default function ResetPasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captcha, setCaptcha] = useState({ question: '', answer: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);

  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    const passed = PASSWORD_REQUIREMENTS.filter(req => req.test(password)).length;
    return {
      score: passed,
      total: PASSWORD_REQUIREMENTS.length,
      percentage: (passed / PASSWORD_REQUIREMENTS.length) * 100,
      isValid: passed === PASSWORD_REQUIREMENTS.length,
    };
  }, [password]);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!passwordStrength.isValid) {
      setError('Password does not meet all requirements');
      setLoading(false);
      return;
    }

    if (!captchaAnswer) {
      setError('Please complete the verification challenge');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          captchaAnswer,
          captchaExpected: captcha.answer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        refreshCaptcha();
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('An error occurred. Please try again.');
      refreshCaptcha();
      setLoading(false);
    }
  };

  // Check for missing token
  if (router.isReady && !token) {
    return (
      <>
        <Head>
          <title>Invalid Link - Ontographia Lab</title>
        </Head>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
            p: 2,
          }}
        >
          <Box
            sx={{
              p: 5,
              maxWidth: 420,
              width: '100%',
              textAlign: 'center',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <CancelIcon sx={{ fontSize: 64, color: '#ef4444', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.95)', mb: 2 }}>
              Invalid Reset Link
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}>
              This password reset link is invalid or has expired.
            </Typography>
            <Button
              component={Link}
              href="/forgot-password"
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
              Request New Link
            </Button>
          </Box>
        </Box>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Reset Password - Ontographia Lab</title>
        <meta name="description" content="Set a new password for your Ontographia Lab account" />
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
          py: 4,
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
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.deepLavender}35 0%, transparent 70%)`,
              top: '5%',
              left: '10%',
              animation: 'float1 13s ease-in-out infinite',
              '@keyframes float1': {
                '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                '50%': { transform: 'translate(20px, 25px) scale(1.03)' },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${SKY.skyReturn}30 0%, transparent 70%)`,
              bottom: '10%',
              right: '15%',
              animation: 'float2 15s ease-in-out infinite',
              '@keyframes float2': {
                '0%, 100%': { transform: 'translate(0, 0)' },
                '50%': { transform: 'translate(-15px, -20px)' },
              },
            }}
          />
        </Box>

        {/* Card */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            p: { xs: 3, sm: 4 },
            maxWidth: 480,
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
                Password Reset Complete
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}
              >
                Your password has been successfully reset. You can now sign in with your new password.
              </Typography>
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
                Sign In
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
                Reset Password
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}
              >
                Enter your new password below
              </Typography>

              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 2,
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
                  label="New Password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setShowRequirements(true)}
                  sx={{
                    mb: 1,
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

                {/* Password Strength Indicator */}
                {showRequirements && password && (
                  <Box sx={{ mb: 2, textAlign: 'left' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={passwordStrength.percentage}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: passwordStrength.percentage === 100
                              ? '#22c55e'
                              : passwordStrength.percentage >= 60
                              ? SKY.goldenHour
                              : '#ef4444',
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        {passwordStrength.score}/{passwordStrength.total}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {PASSWORD_REQUIREMENTS.map((req) => {
                        const passed = req.test(password);
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
                              bgcolor: passed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
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
                              sx={{
                                color: passed ? '#86efac' : '#fca5a5',
                                fontSize: 11,
                              }}
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
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword && password !== confirmPassword}
                  helperText={
                    confirmPassword && password !== confirmPassword
                      ? 'Passwords do not match'
                      : ''
                  }
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
                    '& .MuiFormHelperText-root': { color: '#fca5a5' },
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
                  disabled={loading || !passwordStrength.isValid}
                  startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <LockResetIcon />}
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
                  {loading ? 'Resetting...' : 'Reset Password'}
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
