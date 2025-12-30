// pages/guide/connections.js
// Connections guide page

import { Box, Typography, Grid } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import RouteIcon from '@mui/icons-material/Route';
import EditRoadIcon from '@mui/icons-material/EditRoad';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
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
        height: '100%',
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

function LineStyleDemo({ style, label }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        borderRadius: 1.5,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <Box
        sx={{
          width: 60,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="50" height="20" viewBox="0 0 50 20">
          <path
            d={style === 'curved'
              ? 'M 5 15 Q 25 -5 45 15'
              : style === 'step'
              ? 'M 5 15 L 5 5 L 45 5 L 45 15'
              : 'M 5 15 L 45 5'}
            stroke={SKY.deepCyan}
            strokeWidth="2"
            fill="none"
            strokeDasharray={style === 'dashed' ? '5,3' : 'none'}
          />
          <polygon points="45,5 40,2 40,8" fill={SKY.deepCyan} transform={style === 'step' ? 'translate(0,10)' : ''} />
        </svg>
      </Box>
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 14 }}>
        {label}
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

export default function ConnectionsPage() {
  return (
    <GuideLayout
      title="Connections"
      description="Create smart connections with automatic routing, waypoints, and multiple line styles."
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
        Connections
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 4,
        }}
      >
        Connections are the lines that link your diagram elements together. They automatically
        route around obstacles and can be styled with different line types, arrows, and colors.
      </Typography>

      {/* Creating Connections */}
      <SectionHeader id="creating-connections" title="Creating Connections" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        There are several ways to create connections between elements:
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={TimelineIcon}
            title="Connect Tool"
            description="Press C to activate the connect tool. Click on a source element, then click on the target element to create a connection."
            color={SKY.deepCyan}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={SyncAltIcon}
            title="Edge Handles"
            description="Hover over any element to see edge handles. Click and drag from a handle to start a connection, then drop on another element."
            color={SKY.deepLavender}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          mb: 4,
        }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white', mb: 2 }}>
          Quick Create (+)
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 1.7 }}>
          Hover over an edge handle to reveal the + button. Click it to instantly create
          a new connected element. This is the fastest way to build out a diagram quickly.
        </Typography>
      </Box>

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        <strong style={{ color: 'white' }}>Connection completion modes:</strong>
      </Typography>
      <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
        <li><strong>Drop on center:</strong> Auto-routes to optimal port (shortest path)</li>
        <li><strong>Drop on border:</strong> Attaches to that exact position</li>
        <li><strong>Drop on canvas:</strong> Creates a free-floating endpoint</li>
      </Box>

      <TipBox>
        Connections auto-select the optimal port based on element positions. If you need
        a specific attachment point, drag the endpoint to the exact border location.
      </TipBox>

      {/* Connection Styles */}
      <SectionHeader id="connection-styles" title="Line Styles" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        Click any connection to select it and reveal the styling toolbar. Choose from
        multiple line types to match your diagram style:
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <LineStyleDemo style="straight" label="Straight" />
        </Grid>
        <Grid item xs={6} md={3}>
          <LineStyleDemo style="step" label="Step / Elbow" />
        </Grid>
        <Grid item xs={6} md={3}>
          <LineStyleDemo style="curved" label="Curved" />
        </Grid>
        <Grid item xs={6} md={3}>
          <LineStyleDemo style="dashed" label="Dashed" />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        {[
          { title: 'Arrow Styles', desc: 'Add arrows to source, target, or both ends. Choose filled or outline styles.' },
          { title: 'Dash Patterns', desc: 'Solid, dashed, or dotted lines to indicate different relationship types.' },
          { title: 'Colors & Width', desc: 'Pick from the color palette or enter custom colors. Adjust stroke width 1-8px.' },
          { title: 'Labels', desc: 'Add text labels to connections. Labels follow the line and avoid overlapping elements.' },
        ].map((item, i) => (
          <Box
            key={i}
            sx={{
              p: 2,
              borderRadius: 1.5,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white', mb: 0.5 }}>
              {item.title}
            </Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13 }}>
              {item.desc}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Waypoints & Routing */}
      <SectionHeader id="waypoints" title="Waypoints & Routing" />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={RouteIcon}
            title="Smart Routing"
            description="Connections automatically route around other elements in their path. The system finds the optimal path while avoiding overlaps."
            color={SKY.mauveRose}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={EditRoadIcon}
            title="Waypoints"
            description="Add waypoints to create custom routes. Click on a connection segment and drag to reshape. Double-click to add new waypoints."
            color={SKY.warmPeach}
          />
        </Grid>
      </Grid>

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        <strong style={{ color: 'white' }}>For step/elbow lines:</strong>
      </Typography>
      <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3, mb: 4 }}>
        <li>Drag horizontal segments up/down</li>
        <li>Drag vertical segments left/right</li>
        <li>Segments maintain their horizontal/vertical orientation</li>
        <li>Rounded corners can be enabled in connection properties</li>
      </Box>

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        <strong style={{ color: 'white' }}>Endpoint handles:</strong>
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 14,
          lineHeight: 1.8,
          mb: 4,
        }}
      >
        Small circular handles appear at both ends of selected connections. Drag these to:
      </Typography>
      <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
        <li>Reposition to a different point on the same element</li>
        <li>Reconnect to a different element entirely</li>
        <li>Detach to a free-floating position on the canvas</li>
      </Box>

      <TipBox>
        When you move elements, their connections automatically update to maintain
        the optimal path. The system preserves any waypoints you&apos;ve manually added.
      </TipBox>

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
          Explore Stencil Packs
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          Learn about the different shape libraries available for flowcharts, UML, ERD,
          mind maps, and more in the Stencil Packs guide.
        </Typography>
      </Box>
    </GuideLayout>
  );
}
