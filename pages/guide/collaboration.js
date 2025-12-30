// pages/guide/collaboration.js
// Collaboration guide page

import { Box, Typography, Grid } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import ShareIcon from '@mui/icons-material/Share';
import SyncIcon from '@mui/icons-material/Sync';
import CommentIcon from '@mui/icons-material/Comment';
import LockIcon from '@mui/icons-material/Lock';
import HistoryIcon from '@mui/icons-material/History';
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

function FeatureCard({ icon: Icon, title, description, color, badge }) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        height: '100%',
        position: 'relative',
      }}
    >
      {badge && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            background: `${SKY.deepLavender}20`,
            border: `1px solid ${SKY.deepLavender}40`,
            fontSize: 11,
            fontWeight: 600,
            color: SKY.deepLavender,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {badge}
        </Box>
      )}
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

function RoadmapNote({ children }) {
  return (
    <Box
      sx={{
        p: 3,
        my: 4,
        borderRadius: 2,
        background: `${SKY.deepLavender}08`,
        border: `1px solid ${SKY.deepLavender}20`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            background: `${SKY.deepLavender}20`,
            fontSize: 11,
            fontWeight: 600,
            color: SKY.deepLavender,
            textTransform: 'uppercase',
          }}
        >
          Coming Soon
        </Box>
      </Box>
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

export default function CollaborationPage() {
  return (
    <GuideLayout
      title="Collaboration"
      description="Share diagrams, collaborate in real-time, and gather feedback from your team."
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
        Collaboration
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 4,
        }}
      >
        Ontographia Lab is designed for teams. Share your diagrams, collaborate in
        real-time, and gather feedback seamlessly.
      </Typography>

      {/* Sharing Diagrams */}
      <SectionHeader id="sharing" title="Sharing Diagrams" />

      <Typography
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 15,
          lineHeight: 1.8,
          mb: 3,
        }}
      >
        Share your work with teammates, stakeholders, or the public using flexible
        sharing options:
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={ShareIcon}
            title="Share Links"
            description="Generate shareable links with customizable permissions. Choose view-only or full editing access for each collaborator."
            color={SKY.deepCyan}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={LockIcon}
            title="Access Control"
            description="Set who can view and edit your diagrams. Restrict access to specific team members or open to your entire organization."
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
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'white', mb: 2 }}>
          Permission Levels
        </Typography>
        <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
          <li><strong style={{ color: 'white' }}>Owner:</strong> Full control including sharing and deletion</li>
          <li><strong style={{ color: 'white' }}>Editor:</strong> Can view and edit diagram content</li>
          <li><strong style={{ color: 'white' }}>Viewer:</strong> View-only access, can leave comments</li>
          <li><strong style={{ color: 'white' }}>Public:</strong> Anyone with the link can view</li>
        </Box>
      </Box>

      {/* Real-time Editing */}
      <SectionHeader id="real-time" title="Real-time Editing" />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={SyncIcon}
            title="Live Sync"
            description="See changes as they happen. Multiple editors can work on the same diagram simultaneously with instant updates."
            color={SKY.mauveRose}
            badge="Coming Soon"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={GroupsIcon}
            title="User Presence"
            description="See who else is viewing or editing the diagram. Colored cursors show where each collaborator is working."
            color={SKY.warmPeach}
            badge="Coming Soon"
          />
        </Grid>
      </Grid>

      <RoadmapNote>
        Real-time collaboration features are currently in development. We&apos;re building
        a robust sync engine that handles concurrent edits gracefully. Beta access
        to collaboration features will be available soon.
      </RoadmapNote>

      {/* Comments & Feedback */}
      <SectionHeader id="comments" title="Comments & Feedback" />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={CommentIcon}
            title="Comments"
            description="Leave comments on specific elements or areas of the canvas. Start threads for focused discussions."
            color={SKY.goldenHour}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={HistoryIcon}
            title="Version History"
            description="Track changes over time. View previous versions and restore if needed. Never lose important work."
            color={SKY.skyReturn}
            badge="Coming Soon"
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'white', mb: 2 }}>
          Using Comments
        </Typography>
        <Box component="ol" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2, pl: 3 }}>
          <li>Press <strong style={{ color: 'white' }}>M</strong> to switch to comment mode</li>
          <li>Click anywhere on the canvas to place a comment marker</li>
          <li>Type your comment and press Enter to save</li>
          <li>Click existing comments to view and reply</li>
          <li>Resolve comments when issues are addressed</li>
        </Box>
      </Box>

      <Box
        sx={{
          mt: 8,
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white', mb: 2 }}>
          Export your work
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          Learn how to export your diagrams in various formats and import existing
          work in the Export & Import guide.
        </Typography>
      </Box>
    </GuideLayout>
  );
}
