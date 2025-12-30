// pages/guide/basics.js
// Canvas Basics guide page

import { Box, Typography } from '@mui/material';
import MouseIcon from '@mui/icons-material/Mouse';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import EditIcon from '@mui/icons-material/Edit';
import GridOnIcon from '@mui/icons-material/GridOn';
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

function KeyboardKey({ children }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.5,
        mx: 0.5,
        borderRadius: 1,
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        fontFamily: 'monospace',
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.8)',
      }}
    >
      {children}
    </Box>
  );
}

function FeatureCard({ icon: Icon, title, description, color }) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
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
          lineHeight: 1.7,
        }}
      >
        {description}
      </Typography>
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

export default function CanvasBasicsPage() {
  return (
    <GuideLayout
      title="Canvas Basics"
      description="Learn to navigate the canvas, create elements, and master the essential interactions."
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
        Canvas Basics
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 4,
        }}
      >
        The canvas is your infinite workspace. Learn how to navigate, create elements,
        and work efficiently with these fundamental interactions.
      </Typography>

      {/* Navigation & Viewport */}
      <SectionHeader id="navigation" title="Navigation & Viewport" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        <FeatureCard
          icon={OpenWithIcon}
          title="Pan the Canvas"
          description="Hold Space and drag, use the middle mouse button, or press H to switch to pan mode. Navigate anywhere on the infinite canvas."
          color={SKY.deepCyan}
        />
        <FeatureCard
          icon={ZoomInIcon}
          title="Zoom In & Out"
          description="Scroll the mouse wheel, use pinch gestures on trackpad, or press + and - keys. Press 0 to fit all content to screen."
          color={SKY.deepLavender}
        />
      </Box>

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        <strong style={{ color: 'white' }}>Keyboard shortcuts for navigation:</strong>
      </Typography>
      <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
        <li><KeyboardKey>Space</KeyboardKey> + drag: Pan while in any mode</li>
        <li><KeyboardKey>H</KeyboardKey>: Switch to pan tool</li>
        <li><KeyboardKey>+</KeyboardKey> / <KeyboardKey>-</KeyboardKey>: Zoom in/out</li>
        <li><KeyboardKey>0</KeyboardKey>: Fit to screen</li>
      </Box>

      <TipBox>
        Double-click on empty canvas space to quickly zoom in on that area. Hold Shift while scrolling for horizontal pan.
      </TipBox>

      {/* Creating Elements */}
      <SectionHeader id="creating-elements" title="Creating Elements" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        There are two ways to add elements to your canvas:
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
        <Box
          sx={{
            p: 3,
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white', mb: 1 }}>
            1. Drag and Drop
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 1.7 }}>
            Click a stencil pack icon in the left sidebar to open the panel. Drag any stencil
            directly onto the canvas and release where you want to place it.
          </Typography>
        </Box>
        <Box
          sx={{
            p: 3,
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white', mb: 1 }}>
            2. Click to Place
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 1.7 }}>
            Click a stencil in the panel to select it (it becomes highlighted). Then click anywhere
            on the canvas to place it at that location. The stencil remains selected for rapid placement.
          </Typography>
        </Box>
      </Box>

      <TipBox>
        Pin the stencil panel by clicking the pin icon to keep it open while you work.
        This creates a compact vertical mode perfect for rapid diagram creation.
      </TipBox>

      {/* Selecting & Moving */}
      <SectionHeader id="selecting" title="Selecting & Moving" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        <FeatureCard
          icon={MouseIcon}
          title="Select Elements"
          description="Click any element to select it. Hold Shift and click to add to selection. Drag from empty space to marquee select multiple elements."
          color={SKY.mauveRose}
        />
        <FeatureCard
          icon={TouchAppIcon}
          title="Move Elements"
          description="Drag selected elements to reposition them. Use arrow keys for precise nudging: 1px per press, or 10px with Shift held."
          color={SKY.warmPeach}
        />
      </Box>

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        <strong style={{ color: 'white' }}>Selection shortcuts:</strong>
      </Typography>
      <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
        <li><KeyboardKey>V</KeyboardKey>: Switch to select tool</li>
        <li><KeyboardKey>Shift</KeyboardKey> + click: Add to selection</li>
        <li><KeyboardKey>Cmd/Ctrl</KeyboardKey> + <KeyboardKey>A</KeyboardKey>: Select all</li>
        <li><KeyboardKey>Esc</KeyboardKey>: Deselect all</li>
        <li><KeyboardKey>Delete</KeyboardKey> or <KeyboardKey>Backspace</KeyboardKey>: Delete selected</li>
      </Box>

      <TipBox>
        Smart alignment guides appear when moving elements near others. Elements will snap
        to align with edges and centers of nearby shapes.
      </TipBox>

      {/* Editing Properties */}
      <SectionHeader id="editing" title="Editing Properties" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        <FeatureCard
          icon={EditIcon}
          title="Quick Actions"
          description="When an element is selected, a contextual toolbar appears with common actions like color, duplicate, and delete."
          color={SKY.deepCyan}
        />
        <FeatureCard
          icon={GridOnIcon}
          title="Properties Panel"
          description="Press Enter or P to open the detailed properties panel with full control over styling, size, and advanced options."
          color={SKY.deepLavender}
        />
      </Box>

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        <strong style={{ color: 'white' }}>Editing shortcuts:</strong>
      </Typography>
      <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
        <li><KeyboardKey>Enter</KeyboardKey> or <KeyboardKey>P</KeyboardKey>: Open properties panel</li>
        <li><KeyboardKey>Cmd/Ctrl</KeyboardKey> + <KeyboardKey>D</KeyboardKey>: Duplicate</li>
        <li><KeyboardKey>Cmd/Ctrl</KeyboardKey> + <KeyboardKey>Z</KeyboardKey>: Undo</li>
        <li><KeyboardKey>Cmd/Ctrl</KeyboardKey> + <KeyboardKey>Y</KeyboardKey>: Redo</li>
        <li>Double-click text: Edit inline</li>
      </Box>

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
          Ready to connect your elements?
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          Continue to the Connections guide to learn about creating smart, auto-routing
          connections between your diagram elements.
        </Typography>
      </Box>
    </GuideLayout>
  );
}
