// pages/guide/export.js
// Export & Import guide page

import { Box, Typography, Grid } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ImageIcon from '@mui/icons-material/Image';
import CodeIcon from '@mui/icons-material/Code';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DataObjectIcon from '@mui/icons-material/DataObject';
import GuideLayout, { SKY } from '../../components/landing/GuideLayout';

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

function FormatCard({ format, extension, description, use }) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
          {format}
        </Typography>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            background: 'rgba(255, 255, 255, 0.08)',
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          {extension}
        </Box>
      </Box>
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, mb: 1 }}>
        {description}
      </Typography>
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 13 }}>
        <em>Best for: {use}</em>
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

export default function ExportImportPage() {
  return (
    <GuideLayout
      title="Export & Import"
      description="Export diagrams in multiple formats and import existing work."
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
        Export & Import
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 6,
        }}
      >
        Take your diagrams anywhere. Export in various formats for presentations,
        documentation, or further editing. Import existing diagrams to continue
        working in Ontographia Lab.
      </Typography>

      {/* Export Formats */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
        }}
      >
        Export Formats
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={ImageIcon}
            title="PNG Export"
            description="High-resolution raster images with transparent or white backgrounds. Perfect for presentations and documents."
            color={SKY.deepCyan}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={CodeIcon}
            title="SVG Export"
            description="Scalable image that stays crisp at any size and matches the canvas exactly, including custom stencils and connection styles. Ideal for web embedding and documents."
            color={SKY.steelBlue}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={PictureAsPdfIcon}
            title="PDF Export"
            description="Print-ready single page: fit the page to your diagram, or choose A4 or US Letter in landscape or portrait. The diagram is embedded as a high-resolution image."
            color={SKY.deepLavender}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={DataObjectIcon}
            title="JSON Export"
            description="Full diagram data in a versioned JSON file. Use for backups, version control, or programmatic access, and import it back into any diagram."
            color={SKY.mauveRose}
          />
        </Grid>
      </Grid>

      {/* Format Details */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
          mt: 6,
        }}
      >
        Format Comparison
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 6 }}>
        <FormatCard
          format="PNG"
          extension=".png"
          description="Raster image format with excellent compatibility. Exports at 2x resolution for retina displays."
          use="Presentations, documents, quick sharing"
        />
        <FormatCard
          format="SVG"
          extension=".svg"
          description="Scalable format that matches what you see on the canvas. Opens in browsers and most viewers; text and shapes are not converted to editable vector paths."
          use="Web embedding, documentation, print materials"
        />
        <FormatCard
          format="JSON"
          extension=".json"
          description="Complete diagram structure including all elements, connections, styles, and metadata."
          use="Backups, version control, API integration"
        />
      </Box>

      {/* How to Export */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
        }}
      >
        How to Export
      </Typography>

      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          mb: 6,
        }}
      >
        <Box component="ol" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, lineHeight: 2.2, pl: 3 }}>
          <li>Open the diagram you want to export</li>
          <li>Click the menu icon (☰) in the top-left corner</li>
          <li>Select <strong style={{ color: 'white' }}>Export...</strong> from the menu</li>
          <li>Choose your desired format (PNG, SVG, JPEG, PDF, or JSON)</li>
          <li>Configure export options (background, scale, selection)</li>
          <li>Click <strong style={{ color: 'white' }}>Export</strong></li>
        </Box>
      </Box>

      {/* Export Options */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
        }}
      >
        Export Options
      </Typography>

      <Grid container spacing={2} sx={{ mb: 6 }}>
        {[
          { title: 'Background', desc: 'Transparent, white, grid, or custom color' },
          { title: 'Scale', desc: '1x, 2x, or 3x resolution for images' },
          { title: 'Selection Only', desc: 'Export just the selected elements' },
          { title: 'Include Padding', desc: 'Add margin around the diagram' },
        ].map((option, i) => (
          <Grid item xs={6} md={3} key={i}>
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
                {option.title}
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}>
                {option.desc}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Import */}
      <Typography
        variant="h2"
        sx={{
          fontSize: 24,
          fontWeight: 600,
          color: 'white',
          mb: 3,
        }}
      >
        Import
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={FileUploadIcon}
            title="JSON Import"
            description="Use Menu, then Import JSON to bring in a file exported from Ontographia Lab. Add it to the open diagram (placed at the center of your view) or create a new diagram. Files up to 5 MB."
            color={SKY.warmPeach}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeatureCard
            icon={FileDownloadIcon}
            title="Drag & Drop"
            description="Drag a JSON file onto the canvas to start the same import. Works in any open diagram you can edit."
            color={SKY.goldenHour}
          />
        </Grid>
      </Grid>

      <RoadmapNote>
        We&apos;re working on additional import formats including draw.io XML, Lucidchart,
        and Miro. These will allow you to migrate existing diagrams from other tools.
      </RoadmapNote>

      <Box
        sx={{
          mt: 8,
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'white', mb: 2 }}>
          You&apos;ve completed the guide!
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, mb: 3 }}>
          You now know everything you need to create professional diagrams with
          Ontographia Lab. Ready to start building?
        </Typography>
        <Box
          component="a"
          href="/dashboard"
          sx={{
            display: 'inline-block',
            px: 4,
            py: 1.5,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${SKY.deepCyan}30`,
            },
          }}
        >
          Open Diagram Studio
        </Box>
      </Box>
    </GuideLayout>
  );
}
