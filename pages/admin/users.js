// pages/admin/users.js
// Admin user management page

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { formatDistanceToNow } from 'date-fns';

import { UserMenu } from '../../components/ui/UserMenu';
import { StatusBadge, RoleBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/ToastProvider';
import { ConfirmDialog, useConfirmDialog } from '../../components/ui/ConfirmDialog';
import Logo from '../../components/ui/Logo';

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', name: '', password: '', role: 'user' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Reset password dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Get initial tab from query
  useEffect(() => {
    if (router.query.status === 'pending') {
      setTabValue(1);
    }
  }, [router.query]);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch users
  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetchUsers();
    }
  }, [session]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function updateUserStatus(userId, newStatus) {
    setMenuAnchor(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: newStatus }),
      });

      if (res.ok) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
        toast.success(
          newStatus === 'active'
            ? 'User approved'
            : newStatus === 'suspended'
            ? 'User suspended'
            : 'User status updated'
        );
      } else {
        toast.error('Failed to update user');
      }
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error('Failed to update user');
    }
  }

  async function updateUserRole(userId, newRole) {
    setMenuAnchor(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'role', role: newRole }),
      });

      if (res.ok) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        toast.success(`User is now ${newRole}`);
      } else {
        toast.error('Failed to update role');
      }
    } catch (err) {
      console.error('Failed to update role:', err);
      toast.error('Failed to update role');
    }
  }

  // Create new user
  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email: createForm.email,
          name: createForm.name,
          password: createForm.password || undefined,
          userRole: createForm.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || 'Failed to create user');
        setCreateLoading(false);
        return;
      }

      // Show generated password if applicable
      if (data.temporaryPassword) {
        setGeneratedPassword(data.temporaryPassword);
      } else {
        setCreateDialogOpen(false);
        setCreateForm({ email: '', name: '', password: '', role: 'user' });
        toast.success('User created successfully');
      }

      // Refresh users list
      fetchUsers();
      setCreateLoading(false);
    } catch (err) {
      console.error('Failed to create user:', err);
      setCreateError('An error occurred. Please try again.');
      setCreateLoading(false);
    }
  }

  // Reset user password
  async function handleResetPassword() {
    setResetLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          userId: selectedUser?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset password');
        setResetLoading(false);
        return;
      }

      if (data.temporaryPassword) {
        setGeneratedPassword(data.temporaryPassword);
      }

      setResetLoading(false);
      toast.success('Password reset successfully');
    } catch (err) {
      console.error('Failed to reset password:', err);
      toast.error('An error occurred. Please try again.');
      setResetLoading(false);
    }
  }

  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  // Close create dialog and reset state
  function handleCloseCreateDialog() {
    setCreateDialogOpen(false);
    setCreateForm({ email: '', name: '', password: '', role: 'user' });
    setCreateError('');
    setGeneratedPassword('');
  }

  // Close reset dialog and reset state
  function handleCloseResetDialog() {
    setResetDialogOpen(false);
    setGeneratedPassword('');
    setMenuAnchor(null);
  }

  const getFilteredUsers = () => {
    let filtered = users;

    // Filter by tab
    if (tabValue === 1) filtered = filtered.filter((u) => u.status === 'pending');
    if (tabValue === 2) filtered = filtered.filter((u) => u.status === 'active');
    if (tabValue === 3) filtered = filtered.filter((u) => u.status === 'suspended');

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredUsers = getFilteredUsers();
  const pendingCount = users.filter((u) => u.status === 'pending').length;

  if (status === 'loading' || !session || session.user?.role !== 'admin') {
    return null;
  }

  return (
    <>
      <Head>
        <title>User Management - Admin - Ontographia Lab</title>
      </Head>

      {/* Header */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          bgcolor: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Container maxWidth="xl">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <Logo size={36} textColor="var(--text)" />
              </Link>
              <Typography
                sx={{
                  bgcolor: '#dc2626',
                  color: 'white',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ADMIN
              </Typography>
            </Box>

            <UserMenu />
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box sx={{ minHeight: 'calc(100vh - 65px)', bgcolor: 'var(--bg)', py: 4 }}>
        <Container maxWidth="xl">
          {/* Breadcrumb */}
          <Button
            component={Link}
            href="/admin"
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 2, color: 'var(--text-muted)' }}
          >
            Back to Admin
          </Button>

          <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--text)', mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 4 }}>
            Approve, suspend, and manage user accounts
          </Typography>

          {/* Tabs and Search */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                px: 2,
              }}
            >
              <Tabs
                value={tabValue}
                onChange={(e, v) => setTabValue(v)}
                sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 } }}
              >
                <Tab label="All Users" />
                <Tab
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Pending
                      {pendingCount > 0 && (
                        <Chip
                          label={pendingCount}
                          size="small"
                          sx={{
                            height: 20,
                            bgcolor: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 600,
                          }}
                        />
                      )}
                    </Box>
                  }
                />
                <Tab label="Active" />
                <Tab label="Suspended" />
              </Tabs>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                  sx={{ width: 250 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'var(--text-muted)', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                  size="small"
                >
                  Create User
                </Button>
              </Box>
            </Box>

            {/* Table */}
            {loading ? (
              <Box sx={{ p: 2 }}>
                <TableSkeleton rows={5} columns={5} />
              </Box>
            ) : filteredUsers.length === 0 ? (
              <Box sx={{ p: 4 }}>
                <EmptyState
                  title="No users found"
                  description={
                    tabValue === 1
                      ? 'No pending user requests'
                      : 'No users match your search'
                  }
                  compact
                />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Provider</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Joined</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        sx={{
                          '&:hover': { bgcolor: 'var(--bg)' },
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={user.image}
                              alt={user.name}
                              sx={{ width: 40, height: 40 }}
                            >
                              {user.name?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {user.name || 'Unnamed User'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                                {user.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ textTransform: 'capitalize' }}
                          >
                            {user.provider || 'Unknown'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={user.status} />
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                            {formatDistanceToNow(new Date(user.created_at), {
                              addSuffix: true,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {user.status === 'pending' ? (
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => updateUserStatus(user.id, 'active')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => updateUserStatus(user.id, 'suspended')}
                              >
                                Reject
                              </Button>
                            </Box>
                          ) : (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setMenuAnchor(e.currentTarget);
                                setSelectedUser(user);
                              }}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Container>
      </Box>

      {/* User Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {selectedUser?.status !== 'active' && (
          <MenuItem onClick={() => updateUserStatus(selectedUser?.id, 'active')}>
            <CheckCircleIcon fontSize="small" sx={{ mr: 1.5, color: 'success.main' }} />
            Activate
          </MenuItem>
        )}
        {selectedUser?.status !== 'suspended' && (
          <MenuItem onClick={() => updateUserStatus(selectedUser?.id, 'suspended')}>
            <BlockIcon fontSize="small" sx={{ mr: 1.5, color: 'error.main' }} />
            Suspend
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setResetDialogOpen(true);
          }}
        >
          <LockResetIcon fontSize="small" sx={{ mr: 1.5 }} />
          Reset Password
        </MenuItem>
        <MenuItem sx={{ borderTop: '1px solid var(--border)', mt: 1, pt: 1 }} disabled>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
            Change Role
          </Typography>
        </MenuItem>
        {selectedUser?.role !== 'admin' && (
          <MenuItem onClick={() => updateUserRole(selectedUser?.id, 'admin')}>
            <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 1.5 }} />
            Make Admin
          </MenuItem>
        )}
        {selectedUser?.role !== 'user' && (
          <MenuItem onClick={() => updateUserRole(selectedUser?.id, 'user')}>
            <PersonIcon fontSize="small" sx={{ mr: 1.5 }} />
            Make User
          </MenuItem>
        )}
      </Menu>

      {dialog}

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <form onSubmit={handleCreateUser}>
          <DialogContent>
            {createError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createError}
              </Alert>
            )}

            {generatedPassword ? (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  User created successfully!
                </Alert>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Please save this temporary password. It will only be shown once:
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 2,
                    bgcolor: 'var(--bg)',
                    borderRadius: 1,
                    border: '1px solid var(--border)',
                  }}
                >
                  <Typography
                    sx={{
                      flex: 1,
                      fontFamily: 'monospace',
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {generatedPassword}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(generatedPassword)}
                    title="Copy to clipboard"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ) : (
              <>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  helperText="Leave empty to auto-generate a password"
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={createForm.role}
                    label="Role"
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateDialog}>
              {generatedPassword ? 'Close' : 'Cancel'}
            </Button>
            {!generatedPassword && (
              <Button type="submit" variant="contained" disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create User'}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onClose={handleCloseResetDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          {generatedPassword ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Password reset successfully!
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                New temporary password for <strong>{selectedUser?.email}</strong>:
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 2,
                  bgcolor: 'var(--bg)',
                  borderRadius: 1,
                  border: '1px solid var(--border)',
                }}
              >
                <Typography
                  sx={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {generatedPassword}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(generatedPassword)}
                  title="Copy to clipboard"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'var(--text-muted)' }}>
                Share this password securely with the user. They should change it after logging in.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Are you sure you want to reset the password for <strong>{selectedUser?.email}</strong>?
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                A new temporary password will be generated. The user will need to use this password to log in.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetDialog}>
            {generatedPassword ? 'Close' : 'Cancel'}
          </Button>
          {!generatedPassword && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleResetPassword}
              disabled={resetLoading}
            >
              {resetLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
