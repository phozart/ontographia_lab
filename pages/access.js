// pages/access.js
// Beta Access / Waitlist page - Enhanced with ethereal design

import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Box, Typography, TextField, Button, Grid, Container } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ChatIcon from '@mui/icons-material/Chat';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import { LogoIcon } from '../components/ui/Logo';
import Footer from '../components/landing/Footer';

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

// Floating ethereal orbs
function EtherealOrbs() {
  const orbs = [
    { color: SKY.deepCyan, size: 600, top: '-15%', left: '-15%', delay: 0 },
    { color: SKY.deepLavender, size: 450, top: '40%', right: '-10%', delay: 3 },
    { color: SKY.mauveRose, size: 400, bottom: '5%', left: '20%', delay: 6 },
    { color: SKY.warmPeach, size: 350, top: '20%', left: '60%', delay: 9 },
  ];

  return (
    <Box sx={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {orbs.map((orb, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}18 0%, ${orb.color}05 40%, transparent 70%)`,
            filter: 'blur(80px)',
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            animation: `breathe-${i} 15s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            '@keyframes breathe-0': {
              '0%, 100%': { transform: 'scale(1) translate(0, 0)', opacity: 0.8 },
              '50%': { transform: 'scale(1.1) translate(20px, 30px)', opacity: 1 },
            },
            '@keyframes breathe-1': {
              '0%, 100%': { transform: 'scale(1) translate(0, 0)', opacity: 0.7 },
              '50%': { transform: 'scale(1.15) translate(-30px, 20px)', opacity: 0.9 },
            },
            '@keyframes breathe-2': {
              '0%, 100%': { transform: 'scale(1) translate(0, 0)', opacity: 0.6 },
              '50%': { transform: 'scale(1.08) translate(40px, -20px)', opacity: 0.8 },
            },
            '@keyframes breathe-3': {
              '0%, 100%': { transform: 'scale(1) translate(0, 0)', opacity: 0.5 },
              '50%': { transform: 'scale(1.12) translate(-20px, -30px)', opacity: 0.7 },
            },
          }}
        />
      ))}
    </Box>
  );
}

// Animated benefit card with staggered entrance
function BenefitCard({ icon: Icon, title, description, color, index }) {
  return (
    <Box
      sx={{
        p: 4,
        borderRadius: 3,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(10px)',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: 'slide-up 0.6s ease-out backwards',
        animationDelay: `${0.2 + index * 0.1}s`,
        '@keyframes slide-up': {
          from: { opacity: 0, transform: 'translateY(40px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        '&:hover': {
          transform: 'translateY(-6px) scale(1.02)',
          background: 'rgba(255, 255, 255, 0.04)',
          borderColor: `${color}40`,
          boxShadow: `0 20px 60px ${color}15`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
          opacity: 0,
          transition: 'opacity 0.3s',
        },
        '&:hover::before': {
          opacity: 1,
        },
      }}
    >
      {/* Floating icon with glow */}
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${color}20, ${color}08)`,
          border: `1px solid ${color}30`,
          mb: 3,
          position: 'relative',
          animation: 'float 4s ease-in-out infinite',
          animationDelay: `${index * 0.5}s`,
          '@keyframes float': {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-4px)' },
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: -4,
            borderRadius: 12,
            background: `radial-gradient(circle at center, ${color}25, transparent 70%)`,
            filter: 'blur(10px)',
            opacity: 0.6,
          },
        }}
      >
        <Icon sx={{ fontSize: 26, color, position: 'relative', zIndex: 1 }} />
      </Box>
      <Typography
        sx={{
          fontSize: 18,
          fontWeight: 600,
          color: 'white',
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 15, lineHeight: 1.7 }}>
        {description}
      </Typography>
    </Box>
  );
}

// Success animation component
function SuccessState() {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        animation: 'fade-in 0.5s ease-out',
        '@keyframes fade-in': {
          from: { opacity: 0, transform: 'scale(0.95)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${SKY.deepCyan}20, ${SKY.deepLavender}20)`,
          border: `2px solid ${SKY.deepCyan}`,
          mx: 'auto',
          mb: 4,
          animation: 'check-pop 0.5s ease-out',
          '@keyframes check-pop': {
            '0%': { transform: 'scale(0)' },
            '60%': { transform: 'scale(1.2)' },
            '100%': { transform: 'scale(1)' },
          },
        }}
      >
        <CheckCircleIcon sx={{ fontSize: 40, color: SKY.deepCyan }} />
      </Box>
      <Typography
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 2,
        }}
      >
        You're on the list!
      </Typography>
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 16, maxWidth: 400, mx: 'auto' }}>
        We'll be in touch soon. Keep an eye on your inbox for your invitation.
      </Typography>
    </Box>
  );
}

export default function AccessPage() {
  const [email, setEmail] = useState('');
  const [useCase, setUseCase] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const benefits = [
    {
      icon: RocketLaunchIcon,
      title: 'Early Access',
      description: 'Be among the first to experience a new way of thinking about diagrams. No waiting, no queues once you\'re in.',
      color: SKY.deepCyan,
    },
    {
      icon: ChatIcon,
      title: 'Direct Influence',
      description: 'Your feedback goes straight to our team. Suggest features, report friction, shape the roadmap. We read everything.',
      color: SKY.deepLavender,
    },
    {
      icon: LoyaltyIcon,
      title: 'Founding Member Pricing',
      description: 'When we launch publicly, beta testers lock in special pricing as a thank you for helping us build this.',
      color: SKY.mauveRose,
    },
    {
      icon: VisibilityIcon,
      title: 'A Front-Row Seat',
      description: 'Watch the product evolve in real time. Get early previews of new features before anyone else.',
      color: SKY.warmPeach,
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <>
      <Head>
        <title>Get Access | Ontographia Lab</title>
        <meta name="description" content="Join the Ontographia Lab private beta and help shape the future of diagramming." />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0a0a14 0%, #080810 50%, #05050a 100%)',
        }}
      >
        <EtherealOrbs />

        {/* Minimal header */}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            py: 3,
            px: 4,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LogoIcon size={28} />
                <Typography
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    fontSize: 15,
                    fontWeight: 600,
                    background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  Ontographia Lab
                </Typography>
              </Box>
            </Link>
            <Link href="/guide" style={{ textDecoration: 'none' }}>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'color 0.2s',
                  '&:hover': { color: 'white' },
                }}
              >
                View Guide
              </Typography>
            </Link>
          </Box>
        </Box>

        {/* Main content */}
        <Box sx={{ position: 'relative', zIndex: 1, flex: 1, pt: 16, pb: 10 }}>
          <Container maxWidth="lg">
            {/* Hero */}
            <Box sx={{ textAlign: 'center', mb: 10 }}>
              {/* Animated logo */}
              <Box
                sx={{
                  display: 'inline-flex',
                  mb: 4,
                  position: 'relative',
                  animation: 'logo-glow 4s ease-in-out infinite',
                  '@keyframes logo-glow': {
                    '0%, 100%': { filter: 'drop-shadow(0 0 15px rgba(79, 179, 206, 0.2))' },
                    '50%': { filter: 'drop-shadow(0 0 35px rgba(79, 179, 206, 0.5))' },
                  },
                }}
              >
                <LogoIcon size={72} />
                {/* Glowing ring */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: -8,
                    borderRadius: '50%',
                    border: `2px solid ${SKY.deepCyan}30`,
                    animation: 'pulse-ring 3s ease-out infinite',
                    '@keyframes pulse-ring': {
                      '0%': { transform: 'scale(0.9)', opacity: 1 },
                      '100%': { transform: 'scale(1.3)', opacity: 0 },
                    },
                  }}
                />
              </Box>

              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: 36, md: 56 },
                  fontWeight: 700,
                  color: 'white',
                  mb: 3,
                  animation: 'title-reveal 1s ease-out',
                  '@keyframes title-reveal': {
                    from: { opacity: 0, transform: 'translateY(30px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                We're Building
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender}, ${SKY.warmPeach})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    backgroundSize: '200% 100%',
                    animation: 'gradient-flow 5s ease infinite',
                    '@keyframes gradient-flow': {
                      '0%, 100%': { backgroundPosition: '0% 50%' },
                      '50%': { backgroundPosition: '100% 50%' },
                    },
                  }}
                >
                  Something Special
                </Box>
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: 17, md: 20 },
                  color: 'rgba(255, 255, 255, 0.6)',
                  maxWidth: 650,
                  mx: 'auto',
                  lineHeight: 1.8,
                  animation: 'fade-up 0.8s ease-out backwards',
                  animationDelay: '0.3s',
                  '@keyframes fade-up': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                Ontographia Lab is currently in private beta. We're working with a select group of users
                to craft the diagramming tool we've always wanted to use.
              </Typography>
            </Box>

            {/* Why Private Beta - Floating card */}
            <Box
              sx={{
                mb: 10,
                py: 8,
                px: { xs: 4, md: 8 },
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(20px)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                animation: 'float-card 8s ease-in-out infinite',
                '@keyframes float-card': {
                  '0%, 100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-8px)' },
                },
              }}
            >
              {/* Decorative gradient blob */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '-50%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 600,
                  height: 400,
                  background: `radial-gradient(ellipse, ${SKY.deepLavender}15 0%, transparent 70%)`,
                  filter: 'blur(40px)',
                }}
              />
              <Typography
                sx={{
                  position: 'relative',
                  fontSize: 13,
                  fontWeight: 600,
                  color: SKY.deepCyan,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  mb: 3,
                }}
              >
                Why Private Beta?
              </Typography>
              <Typography
                sx={{
                  position: 'relative',
                  fontSize: { xs: 18, md: 22 },
                  color: 'rgba(255, 255, 255, 0.8)',
                  maxWidth: 750,
                  mx: 'auto',
                  lineHeight: 1.8,
                  mb: 4,
                  fontWeight: 300,
                }}
              >
                Great tools aren't built in isolation. They're shaped by real workflows, honest feedback,
                and countless small improvements that only come from watching people actually use them.
              </Typography>
              <Typography
                sx={{
                  position: 'relative',
                  fontSize: 18,
                  color: 'white',
                  fontWeight: 500,
                  fontStyle: 'italic',
                }}
              >
                This isn't about artificial scarcity.{' '}
                <Box component="span" sx={{ color: SKY.deepCyan }}>It's about getting it right.</Box>
              </Typography>
            </Box>

            {/* Benefits Grid */}
            <Box sx={{ mb: 10 }}>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: 28, md: 36 },
                  fontWeight: 600,
                  color: 'white',
                  textAlign: 'center',
                  mb: 2,
                }}
              >
                What Beta Testers Get
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'center',
                  mb: 6,
                }}
              >
                Early access comes with perks.
              </Typography>
              <Grid container spacing={3}>
                {benefits.map((benefit, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <BenefitCard {...benefit} index={index} />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Request Access Form */}
            <Box
              sx={{
                maxWidth: 600,
                mx: 'auto',
                mb: 8,
                p: { xs: 4, md: 6 },
                borderRadius: 4,
                background: `linear-gradient(135deg, ${SKY.deepCyan}05, ${SKY.deepLavender}05)`,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative corner glow */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  background: `radial-gradient(circle, ${SKY.deepCyan}20, transparent 70%)`,
                  filter: 'blur(30px)',
                }}
              />

              {!submitted ? (
                <>
                  <Box sx={{ textAlign: 'center', mb: 4, position: 'relative' }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${SKY.deepCyan}20, ${SKY.deepLavender}20)`,
                        border: `1px solid ${SKY.deepCyan}40`,
                        mx: 'auto',
                        mb: 3,
                      }}
                    >
                      <EmailIcon sx={{ fontSize: 26, color: SKY.deepCyan }} />
                    </Box>
                    <Typography
                      variant="h2"
                      sx={{
                        fontSize: { xs: 24, md: 28 },
                        fontWeight: 600,
                        color: 'white',
                        mb: 1,
                      }}
                    >
                      Request Access
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 15 }}>
                      We're adding new testers every week.
                    </Typography>
                  </Box>

                  <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      position: 'relative',
                    }}
                  >
                    <TextField
                      label="Email Address"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      variant="outlined"
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          borderRadius: 2,
                          background: 'rgba(255, 255, 255, 0.02)',
                          '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: SKY.deepCyan,
                            borderWidth: 1,
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.4)',
                          '&.Mui-focused': {
                            color: SKY.deepCyan,
                          },
                        },
                      }}
                    />
                    <TextField
                      label="What kind of diagrams do you create?"
                      multiline
                      rows={3}
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      variant="outlined"
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          borderRadius: 2,
                          background: 'rgba(255, 255, 255, 0.02)',
                          '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: SKY.deepCyan,
                            borderWidth: 1,
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.4)',
                          '&.Mui-focused': {
                            color: SKY.deepCyan,
                          },
                        },
                      }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting}
                      endIcon={!isSubmitting && <ArrowForwardIcon />}
                      sx={{
                        background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                        color: 'white',
                        py: 1.75,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 2,
                        textTransform: 'none',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s',
                        '&:hover': {
                          background: `linear-gradient(135deg, ${SKY.steelBlue}, ${SKY.mauveRose})`,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 30px ${SKY.deepCyan}40`,
                        },
                        '&:disabled': {
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.5)',
                        },
                      }}
                    >
                      {isSubmitting ? (
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            '@keyframes spin': {
                              from: { transform: 'rotate(0deg)' },
                              to: { transform: 'rotate(360deg)' },
                            },
                          }}
                        />
                      ) : (
                        'Join the Waitlist'
                      )}
                    </Button>
                  </Box>
                </>
              ) : (
                <SuccessState />
              )}

              <Typography
                sx={{
                  textAlign: 'center',
                  mt: 4,
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: 14,
                  position: 'relative',
                }}
              >
                Already have an invitation code?{' '}
                <Box
                  component="a"
                  href="/login"
                  sx={{
                    color: SKY.deepCyan,
                    textDecoration: 'none',
                    fontWeight: 500,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Sign in here
                </Box>
              </Typography>
            </Box>

            {/* Contact */}
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', mb: 2, fontSize: 15 }}>
                Questions? We're here to help.
              </Typography>
              <Box
                component="a"
                href="mailto:hello@ontographia.com"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  color: 'white',
                  fontSize: 16,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  '&:hover': { color: SKY.deepCyan },
                }}
              >
                <EmailIcon sx={{ fontSize: 18 }} />
                hello@ontographia.com
              </Box>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.35)', mt: 2, fontSize: 14 }}>
                We're a small team and we actually reply.
              </Typography>
            </Box>
          </Container>
        </Box>

        <Footer />
      </Box>
    </>
  );
}
