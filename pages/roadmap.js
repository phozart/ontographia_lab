// pages/roadmap.js
// Future Developments / Roadmap page - Clean Status-Grouped Edition
// Premium layout with clear visual hierarchy

import { useState } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridViewIcon from '@mui/icons-material/GridView';
import GroupsIcon from '@mui/icons-material/Groups';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageLayout, { SKY } from '../components/landing/PageLayout';

// Status configurations with enhanced styling
const STATUS_CONFIG = {
  shipped: {
    label: 'Shipped',
    color: '#4ADE80',
    icon: CheckCircleIcon,
    glow: 'rgba(74, 222, 128, 0.3)',
  },
  'in-progress': {
    label: 'In Progress',
    color: SKY.deepCyan,
    icon: BuildCircleIcon,
    glow: 'rgba(79, 179, 206, 0.3)',
  },
  'coming-soon': {
    label: 'Coming Soon',
    color: SKY.warmPeach,
    icon: ScheduleIcon,
    glow: 'rgba(232, 169, 154, 0.3)',
  },
  planned: {
    label: 'Planned',
    color: SKY.deepLavender,
    icon: AutoAwesomeIcon,
    glow: 'rgba(154, 138, 200, 0.3)',
  },
};

// Kanban column header
function KanbanColumnHeader({ status, count }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 2,
        pb: 2,
        borderBottom: `2px solid ${config.color}30`,
      }}
    >
      <Icon sx={{ fontSize: 18, color: config.color }} />
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 600,
          color: 'white',
          flex: 1,
        }}
      >
        {config.label}
      </Typography>
      <Box
        sx={{
          px: 1.5,
          py: 0.25,
          borderRadius: '6px',
          background: `${config.color}20`,
          fontSize: 12,
          fontWeight: 600,
          color: config.color,
        }}
      >
        {count}
      </Box>
    </Box>
  );
}

// Kanban card - compact
function KanbanCard({ title, description, tags = [], status }) {
  const [isHovered, setIsHovered] = useState(false);
  const config = STATUS_CONFIG[status];

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: '10px',
        background: isHovered ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        border: '1px solid',
        borderColor: isHovered ? `${config.color}30` : 'rgba(255, 255, 255, 0.06)',
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
    >
      <Typography
        sx={{
          fontSize: 13,
          fontWeight: 600,
          color: 'white',
          mb: 0.75,
          lineHeight: 1.4,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          lineHeight: 1.5,
          mb: tags.length > 0 ? 1.5 : 0,
        }}
      >
        {description}
      </Typography>
      {tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {tags.map((tag) => (
            <Box
              key={tag}
              sx={{
                px: 1,
                py: 0.125,
                borderRadius: '4px',
                fontSize: 10,
                fontWeight: 500,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              {tag}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Kanban column
function KanbanColumn({ status, items }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 2,
        borderRadius: '14px',
        background: 'rgba(255, 255, 255, 0.015)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      <KanbanColumnHeader status={status} count={items.length} />
      <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 0.5 }}>
        {items.map((item, index) => (
          <KanbanCard key={index} {...item} status={status} />
        ))}
      </Box>
    </Box>
  );
}


// Vision card - clean, no animations
function VisionCard({ icon: Icon, title, description, color }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        p: 3.5,
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid',
        borderColor: isHovered ? `${color}40` : 'rgba(255, 255, 255, 0.06)',
        height: '100%',
        position: 'relative',
        transition: 'all 0.25s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? `0 12px 32px -8px ${color}20` : 'none',
      }}
    >
      {/* Top accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 20,
          width: 40,
          height: 3,
          borderRadius: '0 0 3px 3px',
          background: color,
          opacity: isHovered ? 1 : 0.6,
          transition: 'opacity 0.25s ease',
        }}
      />

      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${color}15`,
          mb: 2.5,
        }}
      >
        <Icon sx={{ fontSize: 24, color }} />
      </Box>
      <Typography
        sx={{
          fontSize: 18,
          fontWeight: 600,
          color: 'white',
          mb: 1,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        {description}
      </Typography>
    </Box>
  );
}


export default function RoadmapPage() {
  // Roadmap items organized by status
  const roadmapItems = {
    shipped: [
      {
        title: 'Core Canvas & Stencil System',
        description: 'Infinite canvas with drag-and-drop stencils, pan, zoom, and grid support.',
        tags: ['Foundation'],
      },
      {
        title: 'Smart Connections',
        description: 'Intelligent routing with step, curved, and orthogonal line styles.',
        tags: ['Connections'],
      },
      {
        title: 'Mind Map Mode',
        description: 'Hierarchical mind mapping with rapid Tab/Enter creation workflow.',
        tags: ['Stencil Pack'],
      },
      {
        title: 'Undo/Redo History',
        description: 'Full history with keyboard shortcuts and timeline navigation.',
        tags: ['Core'],
      },
    ],
    'in-progress': [
      {
        title: 'Real-time Collaboration',
        description: 'Multi-user editing with presence indicators and live cursor tracking.',
        tags: ['Collaboration'],
        featured: true,
      },
      {
        title: 'Export to Multiple Formats',
        description: 'Export your diagrams to PNG, SVG, PDF, and JSON.',
        tags: ['Export'],
        featured: true,
      },
    ],
    'coming-soon': [
      {
        title: 'Priority Matrix Canvas',
        description: 'Visual priority matrices with drag-and-drop quadrants. Eisenhower matrix, effort/impact grids.',
        tags: ['Management Tools'],
      },
      {
        title: 'SWOT Analysis Canvas',
        description: 'Interactive SWOT diagrams with structured sections and export templates.',
        tags: ['Strategy'],
      },
      {
        title: 'Kanban & Sprint Boards',
        description: 'Visual project boards with swimlanes, WIP limits, and drag-and-drop cards.',
        tags: ['Agile'],
      },
      {
        title: 'Business Model Canvas',
        description: 'Complete BMC template with guided sections for value propositions and revenue streams.',
        tags: ['Strategy'],
      },
    ],
    planned: [
      {
        title: 'OKR & Goal Tracking',
        description: 'Visualize objectives and key results with progress indicators.',
        tags: ['Management Tools'],
      },
      {
        title: 'Stakeholder Mapping',
        description: 'Map stakeholder influence and interest with visual quadrants.',
        tags: ['Management Tools'],
      },
      {
        title: 'Timeline & Gantt Views',
        description: 'Transform diagrams into timeline visualizations with milestones.',
        tags: ['Planning'],
      },
      {
        title: 'ERD & Database Design Pack',
        description: 'Entity-relationship diagrams with automatic relationship inference.',
        tags: ['Technical'],
      },
      {
        title: 'API & Integration Layer',
        description: 'REST API for programmatic access, webhooks, and third-party integrations.',
        tags: ['Platform'],
      },
      {
        title: 'Template Library',
        description: 'Pre-built templates for common diagram types and frameworks.',
        tags: ['Productivity'],
      },
    ],
  };

  const visionItems = [
    {
      icon: DashboardIcon,
      title: 'Management Tools Made Visual',
      description: 'Visual canvases for frameworks managers use every day—priority matrices, SWOT analyses, stakeholder maps.',
      color: SKY.deepCyan,
    },
    {
      icon: GridViewIcon,
      title: 'Beyond Static Diagrams',
      description: 'Living documents with real-time data connections, automatic updates, and intelligent suggestions.',
      color: SKY.deepLavender,
    },
    {
      icon: GroupsIcon,
      title: 'Team-First Features',
      description: 'Shared libraries, commenting workflows, and presentation mode for natural collaboration.',
      color: SKY.mauveRose,
    },
    {
      icon: IntegrationInstructionsIcon,
      title: 'Open & Extensible',
      description: 'Integrations with Notion, Confluence, Jira, GitHub, plus an API for custom workflows.',
      color: SKY.warmPeach,
    },
  ];


  return (
    <PageLayout
      title="Roadmap"
      description="See what we're building and where Ontographia Lab is headed."
      maxWidth="lg"
    >
      {/* Hero - Clean and simple */}
      <Box sx={{ textAlign: 'center', mb: 8, pt: 4 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 0.75,
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            mb: 3,
          }}
        >
          <RocketLaunchIcon sx={{ fontSize: 16, color: SKY.warmPeach }} />
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Development Roadmap
          </Typography>
        </Box>

        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 32, md: 48 },
            fontWeight: 700,
            color: 'white',
            mb: 2,
          }}
        >
          What We're Building
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 15, md: 17 },
            color: 'rgba(255, 255, 255, 0.5)',
            maxWidth: 500,
            mx: 'auto',
            lineHeight: 1.7,
          }}
        >
          A transparent look at our development priorities and upcoming features.
        </Typography>
      </Box>

      {/* Kanban Board */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 10,
        }}
      >
        <KanbanColumn status="in-progress" items={roadmapItems['in-progress']} />
        <KanbanColumn status="coming-soon" items={roadmapItems['coming-soon']} />
        <KanbanColumn status="planned" items={roadmapItems.planned} />
        <KanbanColumn status="shipped" items={roadmapItems.shipped} />
      </Box>

      {/* Vision Section */}
      <Box sx={{ mb: 10 }}>
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: SKY.deepCyan,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              mb: 1.5,
            }}
          >
            The Vision
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: 24, md: 32 },
              fontWeight: 600,
              color: 'white',
              mb: 1.5,
            }}
          >
            Beyond Diagramming
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: 15,
              maxWidth: 450,
              mx: 'auto',
            }}
          >
            We're creating a platform for visual thinking.
          </Typography>
        </Box>

        <Grid container spacing={2.5}>
          {visionItems.map((item, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <VisionCard {...item} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Feedback CTA - Simple */}
      <Box
        sx={{
          textAlign: 'center',
          p: { xs: 4, md: 6 },
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'relative',
        }}
      >
        {/* Top accent line */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 3,
            borderRadius: '0 0 3px 3px',
            background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
          }}
        />

        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: SKY.deepCyan,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            mb: 1.5,
          }}
        >
          Shape the Roadmap
        </Typography>
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: 24, md: 30 },
            fontWeight: 600,
            color: 'white',
            mb: 2,
          }}
        >
          What would you like to see?
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            mb: 4,
            maxWidth: 400,
            mx: 'auto',
            fontSize: 15,
          }}
        >
          We build what our users need. Share your feature ideas with us.
        </Typography>
        <Box
          component="a"
          href="/contact"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 4,
            py: 1.5,
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.steelBlue})`,
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.25s ease',
            boxShadow: `0 4px 16px ${SKY.deepCyan}30`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${SKY.deepCyan}40`,
            },
          }}
        >
          Share Your Ideas
          <ArrowForwardIcon sx={{ fontSize: 18 }} />
        </Box>
      </Box>
    </PageLayout>
  );
}
