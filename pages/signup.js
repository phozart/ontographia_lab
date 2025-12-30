// pages/signup.js
// Signup page for email/password registration with enhanced security

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
  Checkbox,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
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

export default function SignupPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    website: '', // Honeypot field
    acceptedTerms: false,
    acceptedPrivacy: false,
    captchaAnswer: '',
  });
  const [captcha, setCaptcha] = useState({ question: '', answer: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Generate CAPTCHA on mount
  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      if (session.user?.status === 'pending') {
        router.push('/pending-approval');
      } else if (session.user?.status === 'active') {
        router.push('/dashboard');
      }
    }
  }, [session, router]);

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    const password = formData.password;
    const passed = PASSWORD_REQUIREMENTS.filter(req => req.test(password)).length;
    return {
      score: passed,
      total: PASSWORD_REQUIREMENTS.length,
      percentage: (passed / PASSWORD_REQUIREMENTS.length) * 100,
      isValid: passed === PASSWORD_REQUIREMENTS.length,
    };
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setFormData(prev => ({ ...prev, captchaAnswer: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (!passwordStrength.isValid) {
      setError('Password does not meet all requirements');
      setLoading(false);
      return;
    }

    // Validate terms and privacy
    if (!formData.acceptedTerms) {
      setError('You must accept the Terms of Service');
      setLoading(false);
      return;
    }

    if (!formData.acceptedPrivacy) {
      setError('You must accept the Privacy Policy');
      setLoading(false);
      return;
    }

    // Validate CAPTCHA
    if (!formData.captchaAnswer) {
      setError('Please complete the verification challenge');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          website: formData.website, // Honeypot
          acceptedTerms: formData.acceptedTerms,
          acceptedPrivacy: formData.acceptedPrivacy,
          captchaAnswer: formData.captchaAnswer,
          captchaExpected: captcha.answer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        // Refresh CAPTCHA on error
        refreshCaptcha();
        setLoading(false);
        return;
      }

      // Success - redirect to pending approval
      router.push('/pending-approval');
    } catch (err) {
      setError('An error occurred. Please try again.');
      refreshCaptcha();
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Create Account - Ontographia Lab</title>
        <meta name="description" content="Create your Ontographia Lab account" />
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
        </Box>

        {/* Signup Card */}
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
          {/* Logo */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
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
            Create Account
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}
          >
            Join Ontographia Lab to start creating
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
            {/* Honeypot field - hidden from users, bots will fill it */}
            <TextField
              name="website"
              value={formData.website}
              onChange={handleChange}
              autoComplete="off"
              tabIndex={-1}
              sx={{
                position: 'absolute',
                left: '-9999px',
                top: '-9999px',
              }}
            />

            <TextField
              fullWidth
              label="Name (optional)"
              name="name"
              value={formData.name}
              onChange={handleChange}
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

            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
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

            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setShowPasswordRequirements(true)}
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
            {showPasswordRequirements && formData.password && (
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
                    const passed = req.test(formData.password);
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
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              error={formData.confirmPassword && formData.password !== formData.confirmPassword}
              helperText={
                formData.confirmPassword && formData.password !== formData.confirmPassword
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

            {/* CAPTCHA Verification */}
            <Box
              sx={{
                mb: 2,
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
                  name="captchaAnswer"
                  value={formData.captchaAnswer}
                  onChange={handleChange}
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

            {/* Terms and Privacy Checkboxes */}
            <Box sx={{ mb: 2, textAlign: 'left' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="acceptedTerms"
                    checked={formData.acceptedTerms}
                    onChange={handleChange}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.3)',
                      '&.Mui-checked': { color: SKY.deepLavender },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    I accept the{' '}
                    <Link
                      href="/terms"
                      target="_blank"
                      style={{ color: SKY.deepCyan, textDecoration: 'none' }}
                    >
                      Terms of Service
                    </Link>
                    {' '}*
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="acceptedPrivacy"
                    checked={formData.acceptedPrivacy}
                    onChange={handleChange}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.3)',
                      '&.Mui-checked': { color: SKY.deepLavender },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    I accept the{' '}
                    <Link
                      href="/privacy"
                      target="_blank"
                      style={{ color: SKY.deepCyan, textDecoration: 'none' }}
                    >
                      Privacy Policy
                    </Link>
                    {' '}*
                  </Typography>
                }
              />
            </Box>

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading || !passwordStrength.isValid || !formData.acceptedTerms || !formData.acceptedPrivacy}
              startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <PersonAddIcon />}
              sx={{
                py: 1.5,
                mb: 2,
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Box>

          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2 }}
          >
            Already have an account?{' '}
            <Link
              href="/login"
              style={{
                color: SKY.deepCyan,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
          </Typography>

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
