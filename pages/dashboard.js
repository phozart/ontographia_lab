// pages/dashboard.js
// Main dashboard for authenticated users - Clean, self-explanatory layout
// Ethereal Sky palette accents for branding consistency

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import ExtensionIcon from '@mui/icons-material/Extension';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { formatDistanceToNow } from 'date-fns';

import AppSidebar from '../components/ui/AppSidebar';
import { LogoIcon } from '../components/ui/Logo';
import { DiagramGridSkeleton } from '../components/ui/LoadingSkeleton';
import { ConfirmDialog, useConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastProvider';

// Ethereal Sky Palette - defined directly to avoid module initialization issues
const SKY = {
  deepCyan: '#4FB3CE',
  steelBlue: '#6A9FC9',
  deepLavender: '#9A8AC8',
  mauveRose: '#C490B0',
  warmPeach: '#E8A99A',
  goldenHour: '#F0D98A',
  skyReturn: '#6EC5D8',
};

// Workspace type info
const DIAGRAM_TYPES = [
  { id: 'infinite-canvas', name: 'Workspace', color: SKY.deepCyan },
  { id: 'process-flow', name: 'Process Flows', color: SKY.steelBlue },
  { id: 'mindmap', name: 'Mind Map', color: SKY.deepLavender },
  { id: 'uml-class', name: 'UML Class', color: SKY.mauveRose },
  { id: 'erd', name: 'ERD', color: SKY.warmPeach },
  { id: 'cld', name: 'Causal Loop', color: SKY.goldenHour },
  { id: 'capability-map', name: 'Capability Map', color: SKY.skyReturn },
];

// Quick action card component
function QuickAction({ icon: Icon, label, description, onClick, href, color, primary = false }) {
  const content = (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5,
        cursor: 'pointer',
        bgcolor: primary ? `${color}08` : 'var(--panel, #ffffff)',
        border: '1px solid',
        borderColor: primary ? `${color}25` : 'var(--border, #e2e8f0)',
        borderRadius: '12px',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        '&:hover': {
          borderColor: color,
          transform: 'translateY(-1px)',
          boxShadow: `0 4px 12px ${color}15`,
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${color}15`,
          flexShrink: 0,
        }}
      >
        <Icon sx={{ color, fontSize: 20 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'var(--text, #0f172a)' }}>
          {label}
        </Typography>
        {description && (
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, #64748b)', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      <ArrowForwardIcon sx={{ fontSize: 16, color: 'var(--text-light, #94a3b8)' }} />
    </Paper>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>;
  }
  return content;
}

// Resource link component
function ResourceLink({ icon: Icon, label, href, color }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderRadius: '8px',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: `${color}08`,
          },
        }}
      >
        <Icon sx={{ fontSize: 18, color }} />
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--text, #0f172a)', flex: 1 }}>
          {label}
        </Typography>
        <ArrowForwardIcon sx={{ fontSize: 14, color: 'var(--text-light, #94a3b8)' }} />
      </Box>
    </Link>
  );
}

// Section header component
function SectionHeader({ icon: Icon, title, count, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      {Icon && <Icon sx={{ fontSize: 20, color: 'var(--text-muted, #64748b)' }} />}
      <Typography sx={{ fontWeight: 600, fontSize: 16, color: 'var(--text, #0f172a)', flex: 1 }}>
        {title}
      </Typography>
      {count !== undefined && (
        <Typography sx={{ fontSize: 13, color: 'var(--text-light, #94a3b8)' }}>
          {count} item{count !== 1 ? 's' : ''}
        </Typography>
      )}
      {action}
    </Box>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [diagrams, setDiagrams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedDiagram, setSelectedDiagram] = useState(null);
  const [creating, setCreating] = useState(false);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.status === 'pending') {
      router.push('/pending-approval');
    }
  }, [status, session, router]);

  // Fetch diagrams
  useEffect(() => {
    if (session?.user?.status === 'active') {
      fetchDiagrams();
    }
  }, [session]);

  async function fetchDiagrams() {
    try {
      const res = await fetch('/api/diagrams');
      if (res.ok) {
        const data = await res.json();
        setDiagrams(data);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Failed to fetch diagrams:', err);
      toast.error('Failed to load diagrams');
    } finally {
      setLoading(false);
    }
  }

  async function createWorkspace() {
    if (creating) return;
    setCreating(true);

    try {
      const res = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'infinite-canvas',
          name: 'Untitled Workspace',
        }),
      });

      if (res.ok) {
        const diagram = await res.json();
        toast.success('Workspace created');
        router.push(`/diagram/${diagram.short_id || diagram.id}`);
      } else {
        toast.error('Failed to create workspace');
        setCreating(false);
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
      toast.error('Failed to create workspace');
      setCreating(false);
    }
  }

  async function deleteDiagram(diagram) {
    setMenuAnchor(null);

    const confirmed = await confirm({
      title: 'Delete Workspace',
      message: `Are you sure you want to delete "${diagram.name}"? This action cannot be undone.`,
      severity: 'danger',
      confirmText: 'Delete',
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/diagrams/${diagram.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDiagrams(diagrams.filter((d) => d.id !== diagram.id));
        toast.success('Workspace deleted');
      } else {
        toast.error('Failed to delete workspace');
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      toast.error('Failed to delete workspace');
    }
  }

  const filteredDiagrams = diagrams.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.type.toLowerCase().includes(search.toLowerCase())
  );

  // Show loading while checking auth
  if (status === 'loading' || !session || session.user?.status !== 'active') {
    return (
      <div className="dashboard-layout">
        <div className="app-sidebar expanded" style={{ width: 240 }} />
        <div className="dashboard-main">
          <div className="dashboard-content">
            <DiagramGridSkeleton count={8} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - Ontographia Lab</title>
      </Head>

      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <AppSidebar onCreateWorkspace={createWorkspace} />

        {/* Main Content */}
        <div className="dashboard-main">
          {/* Content Area */}
          <div className="dashboard-content">
            {/* Header with greeting */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: 'var(--text, #0f172a)',
                  mb: 0.5,
                }}
              >
                {session?.user?.name ? `Welcome back, ${session.user.name.split(' ')[0]}` : 'Welcome back'}
              </Typography>
              <Typography sx={{ color: 'var(--text-muted, #64748b)', fontSize: 15 }}>
                {diagrams.length === 0
                  ? 'Get started by creating your first workspace'
                  : `You have ${diagrams.length} workspace${diagrams.length !== 1 ? 's' : ''}`}
              </Typography>
            </Box>

            {/* Quick Actions */}
            <Box sx={{ mb: 5 }}>
              <SectionHeader icon={RocketLaunchIcon} title="Quick Actions" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <QuickAction
                    icon={AddIcon}
                    label="New Workspace"
                    description="Start fresh"
                    onClick={createWorkspace}
                    color={SKY.deepCyan}
                    primary
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <QuickAction
                    icon={MenuBookIcon}
                    label="Getting Started"
                    description="Learn the basics"
                    href="/guide"
                    color={SKY.deepLavender}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <QuickAction
                    icon={KeyboardIcon}
                    label="Shortcuts"
                    description="Work faster"
                    href="/guide/shortcuts"
                    color={SKY.mauveRose}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <QuickAction
                    icon={ExtensionIcon}
                    label="Stencil Packs"
                    description="Explore shapes"
                    href="/guide/stencils"
                    color={SKY.warmPeach}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Main content area - two columns on larger screens */}
            <Grid container spacing={4}>
              {/* Workspaces Column */}
              <Grid item xs={12} lg={8}>
                {/* Recent Workspaces or Empty State */}
                {loading ? (
                  <DiagramGridSkeleton count={6} />
                ) : diagrams.length === 0 ? (
                  /* Empty State */
                  <Paper
                    elevation={0}
                    sx={{
                      p: 5,
                      textAlign: 'center',
                      bgcolor: 'var(--panel, #ffffff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '16px',
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '16px',
                        background: `linear-gradient(135deg, ${SKY.deepCyan}15, ${SKY.deepLavender}15)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                      }}
                    >
                      <FolderOpenIcon sx={{ fontSize: 32, color: SKY.deepCyan }} />
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: 'var(--text, #0f172a)', mb: 1 }}
                    >
                      No workspaces yet
                    </Typography>
                    <Typography
                      sx={{ color: 'var(--text-muted, #64748b)', mb: 3, maxWidth: 400, mx: 'auto' }}
                    >
                      Create your first workspace to start building diagrams, flowcharts, and knowledge graphs.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<PlayArrowIcon />}
                      onClick={createWorkspace}
                      disabled={creating}
                      sx={{
                        fontWeight: 600,
                        px: 4,
                        py: 1.25,
                        borderRadius: '10px',
                        background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                        boxShadow: `0 4px 16px ${SKY.deepLavender}30`,
                        '&:hover': {
                          boxShadow: `0 6px 20px ${SKY.deepLavender}40`,
                        },
                      }}
                    >
                      {creating ? 'Creating...' : 'Create Your First Workspace'}
                    </Button>
                  </Paper>
                ) : (
                  /* Workspaces Grid */
                  <>
                    <SectionHeader
                      icon={AccessTimeIcon}
                      title="Your Workspaces"
                      count={filteredDiagrams.length}
                      action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <TextField
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            size="small"
                            sx={{
                              width: 180,
                              '& .MuiOutlinedInput-root': {
                                bgcolor: 'var(--panel, #ffffff)',
                                borderRadius: '8px',
                                fontSize: 13,
                                '& fieldset': { borderColor: 'var(--border, #e2e8f0)' },
                                '&.Mui-focused fieldset': { borderColor: SKY.deepLavender },
                              },
                              '& input': { py: 1 },
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon sx={{ color: 'var(--text-light, #94a3b8)', fontSize: 18 }} />
                                </InputAdornment>
                              ),
                            }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={createWorkspace}
                            disabled={creating}
                            sx={{
                              fontWeight: 500,
                              borderRadius: '8px',
                              textTransform: 'none',
                              background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                              boxShadow: 'none',
                              '&:hover': { boxShadow: `0 4px 12px ${SKY.deepLavender}30` },
                            }}
                          >
                            New
                          </Button>
                        </Box>
                      }
                    />

                    {filteredDiagrams.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Typography sx={{ color: 'var(--text-muted, #64748b)', mb: 0.5 }}>
                          No matching workspaces
                        </Typography>
                        <Typography sx={{ color: 'var(--text-light, #94a3b8)', fontSize: 13 }}>
                          Try a different search term
                        </Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
                        {filteredDiagrams.map((diagram) => {
                          const typeInfo = DIAGRAM_TYPES.find((t) => t.id === diagram.type) || {
                            name: diagram.type,
                            color: SKY.deepLavender,
                          };

                          return (
                            <Grid item xs={12} sm={6} md={4} key={diagram.id} sx={{ display: 'flex' }}>
                              <Paper
                                elevation={0}
                                sx={{
                                  bgcolor: 'var(--panel, #ffffff)',
                                  border: '1px solid var(--border, #e2e8f0)',
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                  transition: 'all 0.2s ease',
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  '&:hover': {
                                    borderColor: typeInfo.color,
                                    boxShadow: `0 4px 16px ${typeInfo.color}12`,
                                    transform: 'translateY(-2px)',
                                  },
                                }}
                              >
                                <Link
                                  href={`/diagram/${diagram.short_id || diagram.id}`}
                                  style={{ textDecoration: 'none' }}
                                >
                                  <Box
                                    sx={{
                                      height: 80,
                                      background: `linear-gradient(135deg, ${typeInfo.color}08, ${typeInfo.color}04)`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderBottom: '1px solid var(--border, #e2e8f0)',
                                    }}
                                  >
                                    <LogoIcon size={32} />
                                  </Box>
                                </Link>

                                <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                                      <Link href={`/diagram/${diagram.short_id || diagram.id}`} style={{ textDecoration: 'none' }}>
                                        <Typography
                                          sx={{
                                            fontWeight: 600,
                                            fontSize: 14,
                                            color: 'var(--text, #0f172a)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            '&:hover': { color: typeInfo.color },
                                          }}
                                        >
                                          {diagram.name}
                                        </Typography>
                                      </Link>
                                      <Typography sx={{ fontSize: 12, color: 'var(--text-light, #94a3b8)', mt: 0.25 }}>
                                        {formatDistanceToNow(new Date(diagram.updated_at), { addSuffix: true })}
                                      </Typography>
                                    </Box>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        setMenuAnchor(e.currentTarget);
                                        setSelectedDiagram(diagram);
                                      }}
                                      sx={{ color: 'var(--text-muted, #475569)', ml: 0.5 }}
                                    >
                                      <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Box>
                              </Paper>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </>
                )}
              </Grid>

              {/* Resources Sidebar */}
              <Grid item xs={12} lg={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: 'var(--panel, #ffffff)',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '16px',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'var(--text, #0f172a)', mb: 2 }}>
                    Learn & Explore
                  </Typography>

                  <Box sx={{ mb: 3 }}>
                    <ResourceLink
                      icon={MenuBookIcon}
                      label="Getting Started Guide"
                      href="/guide"
                      color={SKY.deepCyan}
                    />
                    <ResourceLink
                      icon={KeyboardIcon}
                      label="Keyboard Shortcuts"
                      href="/guide/shortcuts"
                      color={SKY.steelBlue}
                    />
                    <ResourceLink
                      icon={ExtensionIcon}
                      label="Stencil Packs"
                      href="/guide/stencils"
                      color={SKY.deepLavender}
                    />
                  </Box>

                  <Box sx={{ borderTop: '1px solid var(--border, #e2e8f0)', pt: 2.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'var(--text, #0f172a)', mb: 2 }}>
                      More Resources
                    </Typography>
                    <ResourceLink
                      icon={PlayArrowIcon}
                      label="Connection Basics"
                      href="/guide/connections"
                      color={SKY.mauveRose}
                    />
                    <ResourceLink
                      icon={RocketLaunchIcon}
                      label="What's New"
                      href="/roadmap"
                      color={SKY.warmPeach}
                    />
                  </Box>
                </Paper>

                {/* Quick tip card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    mt: 2,
                    bgcolor: `${SKY.deepCyan}08`,
                    border: `1px solid ${SKY.deepCyan}20`,
                    borderRadius: '16px',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: 14, color: SKY.deepCyan, mb: 1 }}>
                    Pro Tip
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: 'var(--text-muted, #64748b)', lineHeight: 1.6 }}>
                    Press <Box component="span" sx={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>V</Box> for select tool,{' '}
                    <Box component="span" sx={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>C</Box> for connect, and{' '}
                    <Box component="span" sx={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>H</Box> for pan.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          component={Link}
          href={selectedDiagram ? `/diagram/${selectedDiagram.short_id || selectedDiagram.id}` : '#'}
          onClick={() => setMenuAnchor(null)}
        >
          <EditIcon fontSize="small" sx={{ mr: 1.5, color: 'var(--text-muted, #64748b)' }} />
          Open
        </MenuItem>
        <MenuItem
          onClick={() => selectedDiagram && deleteDiagram(selectedDiagram)}
          sx={{ color: '#dc2626' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          Delete
        </MenuItem>
      </Menu>

      {dialog}
    </>
  );
}
