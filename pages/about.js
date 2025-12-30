// pages/about.js
// About page - Enhanced with ethereal design and animations

import { Box, Typography, Grid, Container } from '@mui/material';
import Head from 'next/head';
import Link from 'next/link';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupsIcon from '@mui/icons-material/Groups';
import BoltIcon from '@mui/icons-material/Bolt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { LogoIcon } from '../components/ui/Logo';
import Footer from '../components/landing/Footer';
import FloatingNav from '../components/landing/FloatingNav';

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
    { color: SKY.deepCyan, size: 500, top: '-10%', left: '-10%', delay: 0 },
    { color: SKY.deepLavender, size: 400, top: '30%', right: '-5%', delay: 2 },
    { color: SKY.mauveRose, size: 350, bottom: '10%', left: '10%', delay: 4 },
    { color: SKY.warmPeach, size: 300, top: '60%', left: '50%', delay: 6 },
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
            background: `radial-gradient(circle, ${orb.color}20 0%, ${orb.color}08 40%, transparent 70%)`,
            filter: 'blur(60px)',
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            animation: `float-orb-${i} 20s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            '@keyframes float-orb-0': {
              '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
              '50%': { transform: 'translate(30px, 40px) scale(1.05)' },
            },
            '@keyframes float-orb-1': {
              '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
              '50%': { transform: 'translate(-40px, 30px) scale(1.08)' },
            },
            '@keyframes float-orb-2': {
              '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
              '50%': { transform: 'translate(50px, -30px) scale(1.03)' },
            },
            '@keyframes float-orb-3': {
              '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
              '50%': { transform: 'translate(-30px, -40px) scale(1.06)' },
            },
          }}
        />
      ))}
    </Box>
  );
}

// Belief card with bold magazine-style layout
function BeliefCard({ icon: Icon, title, description, color, index, total }) {
  const number = String(index + 1).padStart(2, '0');

  return (
    <Box
      sx={{
        position: 'relative',
        py: { xs: 6, md: 8 },
        borderBottom: index < total - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
        animation: 'fade-in-belief 0.8s ease-out backwards',
        animationDelay: `${0.2 + index * 0.15}s`,
        '@keyframes fade-in-belief': {
          from: { opacity: 0, transform: 'translateY(40px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Grid container spacing={4} alignItems="center">
        {/* Number + Icon Column */}
        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {/* Large number */}
            <Typography
              sx={{
                fontSize: { xs: 48, md: 72 },
                fontWeight: 800,
                lineHeight: 1,
                background: `linear-gradient(135deg, ${color}60, ${color}20)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontFamily: 'monospace',
              }}
            >
              {number}
            </Typography>
            {/* Icon with glow */}
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `radial-gradient(circle, ${color}25, ${color}08)`,
                border: `2px solid ${color}40`,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: -8,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${color}20, transparent 70%)`,
                  filter: 'blur(12px)',
                },
              }}
            >
              <Icon sx={{ fontSize: 28, color, position: 'relative', zIndex: 1 }} />
            </Box>
          </Box>
        </Grid>

        {/* Content Column */}
        <Grid item xs={12} md={9}>
          <Box sx={{ pl: { md: 4 }, borderLeft: { md: `3px solid ${color}40` } }}>
            <Typography
              sx={{
                fontSize: { xs: 26, md: 32 },
                fontWeight: 700,
                color: 'white',
                mb: 2,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.55)',
                fontSize: { xs: 16, md: 18 },
                lineHeight: 1.8,
                maxWidth: 700,
              }}
            >
              {description}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Decorative gradient line */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}30, transparent)`,
        }}
      />
    </Box>
  );
}

// Timeline milestone component
function TimelineMilestone({ year, title, description, isLeft, index }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isLeft ? 'flex-start' : 'flex-end',
        width: '100%',
        mb: 4,
        animation: 'fade-in 0.8s ease-out backwards',
        animationDelay: `${0.3 + index * 0.2}s`,
        '@keyframes fade-in': {
          from: { opacity: 0, transform: `translateX(${isLeft ? -30 : 30}px)` },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
      }}
    >
      <Box
        sx={{
          width: { xs: '100%', md: '45%' },
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 24,
            [isLeft ? 'right' : 'left']: -32,
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
            boxShadow: `0 0 20px ${SKY.deepCyan}50`,
          }}
        />
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: SKY.deepCyan,
            mb: 1,
          }}
        >
          {year}
        </Typography>
        <Typography
          sx={{
            fontSize: 17,
            fontWeight: 600,
            color: 'white',
            mb: 1,
          }}
        >
          {title}
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 14, lineHeight: 1.7 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

export default function AboutPage() {
  const values = [
    {
      icon: VisibilityIcon,
      title: 'Clarity First',
      description: 'Every feature we build serves one goal: helping you communicate complex ideas clearly. If it doesn\'t make diagrams more understandable, we don\'t ship it.',
      color: SKY.deepCyan,
    },
    {
      icon: BoltIcon,
      title: 'Speed Matters',
      description: 'Your ideas move fast. Your tools should too. We obsess over performance so you can focus on thinking, not waiting.',
      color: SKY.deepLavender,
    },
    {
      icon: GroupsIcon,
      title: 'Built for Teams',
      description: 'Great diagrams are rarely made alone. Collaboration isn\'t an afterthought—it\'s at the core of everything we build.',
      color: SKY.mauveRose,
    },
    {
      icon: AutoAwesomeIcon,
      title: 'Craft & Polish',
      description: 'Details matter. From pixel-perfect rendering to smooth animations, professional tools should feel as good as they work.',
      color: SKY.warmPeach,
    },
  ];

  const milestones = [
    { year: '2024', title: 'The Spark', description: 'Frustrated with existing tools, we sketched the first concepts for a better diagramming experience.' },
    { year: '2024', title: 'First Lines of Code', description: 'Development begins. Canvas rendering, connection system, and stencil packs take shape.' },
    { year: '2025', title: 'Private Beta', description: 'Invited our first testers. Their feedback shapes every feature we build.' },
    { year: 'Soon', title: 'Public Launch', description: 'Opening the doors to everyone. The journey is just beginning.' },
  ];

  return (
    <>
      <Head>
        <title>About | Ontographia Lab</title>
        <meta name="description" content="The story behind Ontographia Lab and our mission to transform visual communication." />
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
        <FloatingNav alwaysLeft />

        {/* Main content */}
        <Box sx={{ position: 'relative', zIndex: 1, flex: 1, pt: 16, pb: 10 }}>
          <Container maxWidth="lg">
            {/* Hero */}
            <Box sx={{ textAlign: 'center', mb: 12 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  mb: 4,
                  animation: 'pulse-glow 3s ease-in-out infinite',
                  '@keyframes pulse-glow': {
                    '0%, 100%': { filter: 'drop-shadow(0 0 20px rgba(79, 179, 206, 0.3))' },
                    '50%': { filter: 'drop-shadow(0 0 40px rgba(79, 179, 206, 0.5))' },
                  },
                }}
              >
                <LogoIcon size={80} />
              </Box>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: 36, md: 56 },
                  fontWeight: 700,
                  color: 'white',
                  mb: 3,
                  animation: 'fade-up 0.8s ease-out',
                  '@keyframes fade-up': {
                    from: { opacity: 0, transform: 'translateY(30px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                We're Building the Future of
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender}, ${SKY.warmPeach})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    backgroundSize: '200% 100%',
                    animation: 'gradient-shift 6s ease infinite',
                    '@keyframes gradient-shift': {
                      '0%, 100%': { backgroundPosition: '0% 50%' },
                      '50%': { backgroundPosition: '100% 50%' },
                    },
                  }}
                >
                  Visual Thinking
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
                  animationDelay: '0.2s',
                }}
              >
                Ontographia Lab started with a simple observation: the best ideas often
                struggle to escape the minds that create them. We're here to change that.
              </Typography>
            </Box>

            {/* Etymology Section */}
            <Box
              sx={{
                mb: 12,
                py: 8,
                px: { xs: 4, md: 8 },
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -100,
                  right: -100,
                  width: 300,
                  height: 300,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${SKY.deepLavender}15, transparent 70%)`,
                  filter: 'blur(40px)',
                }}
              />
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: SKY.deepLavender,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  mb: 3,
                }}
              >
                The Name
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 24, md: 32 },
                  fontWeight: 300,
                  color: 'white',
                  lineHeight: 1.6,
                  maxWidth: 800,
                  fontStyle: 'italic',
                }}
              >
                <Box component="span" sx={{ color: SKY.deepCyan, fontWeight: 500 }}>onto</Box>
                {' (being, existence) + '}
                <Box component="span" sx={{ color: SKY.deepLavender, fontWeight: 500 }}>graphia</Box>
                {' (writing, drawing)'}
              </Typography>
              <Typography
                sx={{
                  mt: 4,
                  fontSize: 16,
                  color: 'rgba(255, 255, 255, 0.5)',
                  maxWidth: 700,
                  lineHeight: 1.8,
                }}
              >
                The best diagrams don't just describe things—they reveal the underlying structure
                and relationships that make systems work. They illuminate what exists.
              </Typography>
            </Box>

            {/* Story with Timeline */}
            <Box sx={{ mb: 12 }}>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: 28, md: 40 },
                  fontWeight: 600,
                  color: 'white',
                  textAlign: 'center',
                  mb: 2,
                }}
              >
                Our Journey
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'center',
                  mb: 8,
                  maxWidth: 500,
                  mx: 'auto',
                }}
              >
                From frustration to innovation.
              </Typography>

              {/* Timeline */}
              <Box sx={{ position: 'relative' }}>
                {/* Center line */}
                <Box
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: `linear-gradient(180deg, ${SKY.deepCyan}50, ${SKY.deepLavender}50, ${SKY.mauveRose}50, transparent)`,
                    transform: 'translateX(-50%)',
                  }}
                />
                {milestones.map((milestone, index) => (
                  <TimelineMilestone
                    key={index}
                    {...milestone}
                    isLeft={index % 2 === 0}
                    index={index}
                  />
                ))}
              </Box>
            </Box>

            {/* Values - Magazine Style */}
            <Box sx={{ mb: 12 }}>
              <Box
                sx={{
                  textAlign: 'center',
                  mb: 8,
                  position: 'relative',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: SKY.deepLavender,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    mb: 2,
                  }}
                >
                  Our Principles
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: { xs: 32, md: 48 },
                    fontWeight: 700,
                    color: 'white',
                    mb: 3,
                  }}
                >
                  What We Believe
                </Typography>
                <Box
                  sx={{
                    width: 80,
                    height: 4,
                    mx: 'auto',
                    borderRadius: 2,
                    background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender}, ${SKY.mauveRose})`,
                  }}
                />
              </Box>

              {/* Belief Cards Container */}
              <Box
                sx={{
                  p: { xs: 2, md: 6 },
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Decorative corner accents */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 100,
                    borderTop: `2px solid ${SKY.deepCyan}30`,
                    borderLeft: `2px solid ${SKY.deepCyan}30`,
                    borderTopLeftRadius: 16,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 100,
                    height: 100,
                    borderBottom: `2px solid ${SKY.mauveRose}30`,
                    borderRight: `2px solid ${SKY.mauveRose}30`,
                    borderBottomRightRadius: 16,
                  }}
                />

                {values.map((value, index) => (
                  <BeliefCard key={index} {...value} index={index} total={values.length} />
                ))}
              </Box>
            </Box>

            {/* Mission CTA */}
            <Box
              sx={{
                textAlign: 'center',
                py: 10,
                px: 4,
                borderRadius: 4,
                background: `linear-gradient(135deg, ${SKY.deepCyan}08, ${SKY.deepLavender}08)`,
                border: '1px solid rgba(255, 255, 255, 0.06)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(ellipse at center, ${SKY.deepCyan}08 0%, transparent 70%)`,
                }}
              />
              <Typography
                sx={{
                  position: 'relative',
                  fontSize: 13,
                  fontWeight: 600,
                  color: SKY.deepLavender,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  mb: 3,
                }}
              >
                Our Mission
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  position: 'relative',
                  fontSize: { xs: 26, md: 36 },
                  fontWeight: 600,
                  color: 'white',
                  maxWidth: 800,
                  mx: 'auto',
                  lineHeight: 1.5,
                  mb: 6,
                }}
              >
                To give every team the power to visualize complexity and communicate
                ideas with clarity and confidence.
              </Typography>
              <Link href="/access" style={{ textDecoration: 'none' }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 4,
                    py: 2,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                    color: 'white',
                    fontSize: 16,
                    fontWeight: 600,
                    transition: 'all 0.3s',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: `0 12px 40px ${SKY.deepCyan}40`,
                    },
                  }}
                >
                  Join Us
                  <ArrowForwardIcon sx={{ fontSize: 18 }} />
                </Box>
              </Link>
            </Box>
          </Container>
        </Box>

        <Footer />
      </Box>
    </>
  );
}
