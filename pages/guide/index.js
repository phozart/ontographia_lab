// pages/guide/index.js
// Getting Started guide page

import { Box, Typography, Grid, Button } from '@mui/material';
import Link from 'next/link';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MouseIcon from '@mui/icons-material/Mouse';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LayersIcon from '@mui/icons-material/Layers';
import GuideLayout, { SKY } from '../../components/landing/GuideLayout';

function QuickStartCard({ icon: Icon, title, description, href, color }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          height: '100%',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.04)',
            borderColor: `${color}40`,
            transform: 'translateY(-2px)',
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}15`,
            mb: 2,
          }}
        >
          <Icon sx={{ fontSize: 20, color }} />
        </Box>
        <Typography
          sx={{
            fontSize: 16,
            fontWeight: 600,
            color: 'white',
            mb: 1,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 14,
            lineHeight: 1.6,
            mb: 2,
          }}
        >
          {description}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Read more <ArrowForwardIcon sx={{ fontSize: 14 }} />
        </Box>
      </Box>
    </Link>
  );
}

export default function GettingStartedPage() {
  const quickStartCards = [
    {
      icon: MouseIcon,
      title: 'Canvas Basics',
      description: 'Learn to navigate the canvas, create elements, and master the essential interactions.',
      href: '/guide/basics',
      color: SKY.deepCyan,
    },
    {
      icon: AutoFixHighIcon,
      title: 'Connections',
      description: 'Create smart connections with automatic routing, waypoints, and multiple line styles.',
      href: '/guide/connections',
      color: SKY.deepLavender,
    },
    {
      icon: LayersIcon,
      title: 'Stencil Packs',
      description: 'Explore our library of shapes for flowcharts, UML, ERD, mind maps, and more.',
      href: '/guide/stencils',
      color: SKY.mauveRose,
    },
  ];

  return (
    <GuideLayout
      title="Getting Started"
      description="Learn the fundamentals of Ontographia Lab and start creating professional diagrams."
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: 32, md: 42 },
          fontWeight: 700,
          color: 'white',
          mb: 3,
        }}
      >
        Getting Started
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 6,
          maxWidth: 600,
        }}
      >
        Welcome to Ontographia Lab. This guide will help you understand the basics
        and get you creating professional diagrams in minutes.
      </Typography>

      {/* Quick video intro */}
      <Box
        sx={{
          mb: 6,
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
            }}
          >
            <PlayArrowIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'white' }}>
              Quick Start Video
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.5)' }}>
              2 minute introduction to the interface
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          Coming soon: A quick video walkthrough of the main features and interface.
        </Typography>
      </Box>

      {/* Quick start cards */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
        }}
      >
        Explore the Guide
      </Typography>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        {quickStartCards.map((card, index) => (
          <Grid item xs={12} md={4} key={index}>
            <QuickStartCard {...card} />
          </Grid>
        ))}
      </Grid>

      {/* Key concepts */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
        }}
      >
        Key Concepts
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          mb: 6,
        }}
      >
        {[
          {
            title: 'The Canvas',
            description: 'An infinite workspace where you place and connect elements. Pan by holding Space or the middle mouse button, zoom with the scroll wheel or +/- keys.',
          },
          {
            title: 'Stencils',
            description: 'Pre-designed shapes organized into packs (Core, Process Flow, Mind Map, etc.). Drag from the left sidebar or click to select and place.',
          },
          {
            title: 'Connections',
            description: 'Lines that link elements together. They automatically route around obstacles and can be styled with different line types and arrows.',
          },
          {
            title: 'Properties Panel',
            description: 'Detailed controls for the selected element. Access by pressing Enter or P, or by clicking the settings icon in the contextual toolbar.',
          },
        ].map((concept, index) => (
          <Box
            key={index}
            sx={{
              p: 3,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Typography
              sx={{
                fontSize: 16,
                fontWeight: 600,
                color: 'white',
                mb: 1,
              }}
            >
              {concept.title}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {concept.description}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* CTA */}
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          px: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography
          sx={{
            fontSize: 20,
            fontWeight: 600,
            color: 'white',
            mb: 2,
          }}
        >
          Ready to start creating?
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            mb: 4,
          }}
        >
          Open the diagram studio and start visualizing your ideas.
        </Typography>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <Button
            endIcon={<ArrowForwardIcon />}
            sx={{
              background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
              color: 'white',
              px: 4,
              py: 1.5,
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': {
                background: `linear-gradient(135deg, ${SKY.steelBlue}, ${SKY.mauveRose})`,
              },
            }}
          >
            Go to Dashboard
          </Button>
        </Link>
      </Box>
    </GuideLayout>
  );
}
