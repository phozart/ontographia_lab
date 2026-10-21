// components/account/ConnectedAppsSection.js
// "Connected apps" (ADR-0005 5.7): apps the user signed in through OAuth (claude.ai, Claude Desktop, mobile), with
// Disconnect. Sits under the personal API tokens. Hidden when the feature is off and nothing is connected.

import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Alert, Paper, Chip } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';

const LEVEL = { viewer: 'Viewer', commenter: 'Commenter', editor: 'Editor' };
const fmt = (v) => (v ? new Date(v).toLocaleString() : 'never');

export function describeDiagrams(app) {
  if (app.scopeKind === 'all_editable') return 'All boards I can edit';
  if (app.scopeKind === 'all_readable') return 'All my diagrams';
  const n = app.diagramCount || 0;
  return `${n} diagram${n === 1 ? '' : 's'}`;
}

export default function ConnectedAppsSection() {
  const [state, setState] = useState({ loaded: false, enabled: false, apps: [], error: '' });
  const [confirm, setConfirm] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/user/connected-apps');
      if (!res.ok) throw new Error('Could not load connected apps');
      const body = await res.json();
      setState({ loaded: true, enabled: !!body.enabled, apps: body.apps || [], error: '' });
    } catch (e) {
      setState((s) => ({ ...s, loaded: true, error: e.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const disconnect = async (id) => {
    setError('');
    try {
      const res = await fetch(`/api/user/connected-apps/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error('Could not disconnect. Try again.');
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!state.loaded) return null;
  if (!state.enabled && state.apps.length === 0 && !state.error) return null;

  return (
    <Paper elevation={0} sx={{ p: 3, mt: 3, border: '1px solid var(--border)' }} data-testid="connected-apps">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LinkIcon fontSize="small" />
        <Typography variant="h6" component="h2">Connected apps</Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 2 }}>
        Apps you signed in through Ontographia Lab, such as Claude on the web, desktop or phone. Disconnect an app and it
        loses access on its next request. Personal API tokens above are separate.
      </Typography>

      {state.error && <Alert severity="warning" sx={{ mb: 1 }}>{state.error}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {state.apps.length === 0 && !state.error && (
        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>No connected apps.</Typography>
      )}

      <Box sx={{ display: 'grid', gap: 1 }}>
        {state.apps.map((a) => (
          <Box key={a.id} data-testid="connected-app-row" sx={{ p: 1.5, border: '1px solid var(--border)', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, color: 'var(--text)' }}>{a.clientLabel}</Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                  {LEVEL[a.roleCap] || a.roleCap} · {describeDiagrams(a)}
                  {' · connected '}{fmt(a.createdAt)}
                  {' · last used '}{fmt(a.lastUsedAt)}
                  {a.expiresAt ? ` · expires ${fmt(a.expiresAt)}` : ''}
                </Typography>
              </Box>
              <Chip size="small" label={LEVEL[a.roleCap] || a.roleCap} color={a.roleCap === 'editor' ? 'warning' : 'default'} />
              {a.scopeKind === 'selected' && a.diagrams.length > 0 && (
                <Button size="small" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                  {open === a.id ? 'Hide diagrams' : 'Show diagrams'}
                </Button>
              )}
              {confirm === a.id ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" color="error" variant="contained" onClick={() => disconnect(a.id)}>Confirm disconnect</Button>
                  <Button size="small" onClick={() => setConfirm(null)}>Cancel</Button>
                </Box>
              ) : (
                <Button size="small" color="error" variant="outlined" onClick={() => setConfirm(a.id)}>Disconnect</Button>
              )}
            </Box>
            {open === a.id && (
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 3, color: 'var(--text-muted)', fontSize: 13 }}>
                {a.diagrams.map((d) => <li key={d.id}>{d.name} ({d.shortId})</li>)}
                {a.diagramCount > a.diagrams.length && <li>{a.diagramCount - a.diagrams.length} more you can no longer see</li>}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
