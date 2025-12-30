// pages/guide/stencils.js
// Stencil Packs guide page

import { Box, Typography, Grid } from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HubIcon from '@mui/icons-material/Hub';
import SchemaIcon from '@mui/icons-material/Schema';
import GridViewIcon from '@mui/icons-material/GridView';
import DiamondIcon from '@mui/icons-material/Diamond';
import GuideLayout, { SKY } from '../../components/landing/GuideLayout';

function SectionHeader({ id, title }) {
  return (
    <Typography
      id={id}
      variant="h2"
      sx={{
        fontSize: 24,
        fontWeight: 600,
        color: 'white',
        mb: 3,
        mt: 6,
        pt: 2,
        scrollMarginTop: 100,
      }}
    >
      {title}
    </Typography>
  );
}

function PackCard({ icon: Icon, title, description, shapes, color }) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        height: '100%',
        transition: 'all 0.3s ease',
        '&:hover': {
          background: 'rgba(255, 255, 255, 0.04)',
          borderColor: `${color}30`,
        },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${color}15`,
          mb: 2,
        }}
      >
        <Icon sx={{ fontSize: 22, color }} />
      </Box>
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
      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 14,
          lineHeight: 1.7,
          mb: 2,
        }}
      >
        {description}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {shapes.map((shape, i) => (
          <Box
            key={i}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            {shape}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function TipBox({ children }) {
  return (
    <Box
      sx={{
        p: 3,
        my: 3,
        borderRadius: 2,
        background: `${SKY.deepCyan}10`,
        borderLeft: `3px solid ${SKY.deepCyan}`,
      }}
    >
      <Typography
        sx={{
          fontSize: 13,
          fontWeight: 600,
          color: SKY.deepCyan,
          mb: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Pro Tip
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

export default function StencilsPage() {
  const stencilPacks = [
    {
      icon: GridViewIcon,
      title: 'Core Shapes',
      description: 'Essential building blocks for any diagram. Includes basic geometric shapes and containers.',
      shapes: ['Rectangle', 'Circle', 'Diamond', 'Frame', 'Section', 'Text'],
      color: SKY.deepCyan,
    },
    {
      icon: AccountTreeIcon,
      title: 'Process Flow',
      description: 'Flowchart elements for documenting processes, decisions, and workflows.',
      shapes: ['Start/End', 'Process', 'Decision', 'Document', 'Data', 'Subprocess'],
      color: SKY.steelBlue,
    },
    {
      icon: HubIcon,
      title: 'Mind Map',
      description: 'Organic shapes optimized for brainstorming and hierarchical idea mapping.',
      shapes: ['Central Topic', 'Topic', 'Subtopic', 'Note', 'Boundary'],
      color: SKY.deepLavender,
    },
    {
      icon: SchemaIcon,
      title: 'UML',
      description: 'Unified Modeling Language shapes for software architecture and design.',
      shapes: ['Class', 'Interface', 'Actor', 'Use Case', 'Package', 'Component'],
      color: SKY.mauveRose,
    },
    {
      icon: DiamondIcon,
      title: 'ERD',
      description: 'Entity Relationship Diagram shapes for database modeling.',
      shapes: ['Entity', 'Attribute', 'Relationship', 'Weak Entity', 'Key'],
      color: SKY.warmPeach,
    },
    {
      icon: CategoryIcon,
      title: 'Capability Map',
      description: 'Strategic planning shapes for business capability and value stream mapping.',
      shapes: ['Capability', 'Value Stream', 'Initiative', 'Metric'],
      color: SKY.goldenHour,
    },
  ];

  return (
    <GuideLayout
      title="Stencil Packs"
      description="Explore our library of shapes for flowcharts, UML, ERD, mind maps, and more."
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
        Stencil Packs
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 4,
        }}
      >
        Stencil packs are collections of pre-designed shapes organized by diagram type.
        Each pack contains semantically meaningful elements with appropriate connection
        behaviors and styling.
      </Typography>

      {/* Using Stencils */}
      <Box
        sx={{
          p: 4,
          mb: 6,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}08, ${SKY.deepLavender}08)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'white', mb: 2 }}>
          Using Stencils
        </Typography>
        <Box component="ol" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
          <li>Click a pack icon in the left sidebar to open its panel</li>
          <li>Drag a stencil onto the canvas, or click to select then click to place</li>
          <li>Pin the panel for persistent access while working</li>
          <li>Search across all packs using the search bar</li>
        </Box>
      </Box>

      {/* Core Shapes */}
      <SectionHeader id="core-shapes" title="Core Shapes" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        The foundation of any diagram. Core shapes are versatile elements that work
        in any context:
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { name: 'Rectangle', desc: 'Basic container for text and concepts' },
          { name: 'Circle', desc: 'States, nodes, and focal points' },
          { name: 'Diamond', desc: 'Decision points and gateways' },
          { name: 'Frame', desc: 'Grouping container with title header' },
          { name: 'Section', desc: 'Lightweight grouping without header' },
          { name: 'Text', desc: 'Free-floating labels and annotations' },
        ].map((shape, i) => (
          <Grid item xs={6} md={4} key={i}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                height: '100%',
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white', mb: 0.5 }}>
                {shape.name}
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}>
                {shape.desc}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Process Flow */}
      <SectionHeader id="process-flow" title="Process Flow" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        Standard flowchart symbols following ISO 5807 conventions. Perfect for
        documenting business processes, algorithms, and decision trees:
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { name: 'Start/End', desc: 'Rounded terminator for flow endpoints' },
          { name: 'Process', desc: 'Action or operation step' },
          { name: 'Decision', desc: 'Diamond for yes/no branching' },
          { name: 'Document', desc: 'Paper document symbol' },
          { name: 'Data', desc: 'Parallelogram for input/output' },
          { name: 'Subprocess', desc: 'Nested process reference' },
        ].map((shape, i) => (
          <Grid item xs={6} md={4} key={i}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                height: '100%',
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white', mb: 0.5 }}>
                {shape.name}
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}>
                {shape.desc}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <TipBox>
        Flowchart connections default to step/elbow line style with directional arrows.
        The system auto-routes around other shapes to keep your diagram clean.
      </TipBox>

      {/* Mind Maps */}
      <SectionHeader id="mind-maps" title="Mind Maps" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        Mind map elements use curved connections and organic shapes optimized for
        brainstorming and hierarchical thinking:
      </Typography>

      <Box
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'white', mb: 2 }}>
          Quick Mind Mapping
        </Typography>
        <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
          <li><strong>Tab:</strong> Create a child topic from the selected node</li>
          <li><strong>Enter:</strong> Create a sibling topic at the same level</li>
          <li><strong>Arrow keys:</strong> Navigate between connected topics</li>
          <li>Connections auto-fan out to prevent overlap</li>
          <li>Text editing is immediate—just start typing when selected</li>
        </Box>
      </Box>

      {/* UML */}
      <SectionHeader id="uml" title="UML Diagrams" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        Unified Modeling Language shapes for software architecture, class diagrams,
        use cases, and component design:
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { name: 'Class', desc: 'Three-compartment class with attributes and methods' },
          { name: 'Interface', desc: 'Interface definition with stereotypes' },
          { name: 'Actor', desc: 'Stick figure for use case actors' },
          { name: 'Use Case', desc: 'Ellipse for system behaviors' },
          { name: 'Package', desc: 'Folder-tab container for grouping' },
          { name: 'Component', desc: 'Component with provided/required interfaces' },
        ].map((shape, i) => (
          <Grid item xs={6} md={4} key={i}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                height: '100%',
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white', mb: 0.5 }}>
                {shape.name}
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}>
                {shape.desc}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <TipBox>
        UML class boxes support multiple compartments. Double-click to edit, and use
        line breaks to separate attributes and methods.
      </TipBox>

      {/* All Packs Overview */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
          mt: 8,
        }}
      >
        All Stencil Packs
      </Typography>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        {stencilPacks.map((pack, i) => (
          <Grid item xs={12} md={6} key={i}>
            <PackCard {...pack} />
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          mt: 6,
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white', mb: 2 }}>
          Work faster with shortcuts
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          Learn all the keyboard shortcuts to navigate, select, connect, and edit
          with maximum efficiency in the Keyboard Shortcuts guide.
        </Typography>
      </Box>
    </GuideLayout>
  );
}
