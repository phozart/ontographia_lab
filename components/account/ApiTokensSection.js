// components/account/ApiTokensSection.js
// Personal API tokens for MCP clients (Claude Code, Cursor, ...). The secret is shown once, right after creation.

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Paper,
  MenuItem,
  Chip,
  FormControlLabel,
  Checkbox,
  Autocomplete,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'Never' },
];

export function tokenState(token, now = Date.now()) {
  if (token.revoked_at) return 'revoked';
  if (token.expires_at && new Date(token.expires_at).getTime() <= now) return 'expired';
  return 'active';
}

const fmt = (v) => (v ? new Date(v).toLocaleString() : 'never');

export default function ApiTokensSection() {
  const [tokens, setTokens] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [roleCap, setRoleCap] = useState('viewer');
  const [expiry, setExpiry] = useState('90');
  const [limitDiagrams, setLimitDiagrams] = useState(false);
  const [diagrams, setDiagrams] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { token, name } shown once
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/user/tokens');
      if (!res.ok) throw new Error('Could not load tokens');
      setTokens((await res.json()).tokens || []);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!limitDiagrams || diagrams.length) return;
    fetch('/api/diagrams')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setDiagrams(Array.isArray(list) ? list : []))
      .catch(() => setDiagrams([]));
  }, [limitDiagrams, diagrams.length]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    if (limitDiagrams && selected.length === 0) {
      setError('Pick at least one diagram, or turn the restriction off.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name,
        roleCap,
        expiresInDays: expiry === 'never' ? null : Number(expiry),
        diagramIds: limitDiagrams ? selected.map((d) => d.id) : null,
      };
      const res = await fetch('/api/user/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the token');
      setCreated({ token: data.token, name: data.record.name });
      setCopied(false);
      setName('');
      setSelected([]);
      setLimitDiagrams(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    setError('');
    try {
      const res = await fetch(`/api/user/tokens/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error('Could not revoke the token');
      setConfirmRevoke(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Paper
      elevation={0}
      data-testid="api-tokens"
      sx={{ p: 3, mb: 3, bgcolor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 2 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <KeyIcon sx={{ color: 'var(--text-muted)' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text)' }}>
          API tokens
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 2 }}>
        Let tools such as Claude Code or Cursor read your diagrams over MCP. A token acts as you, never with more than
        the role you choose, and can be limited to specific diagrams. Treat it like a password.
      </Typography>

      {created && (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="new-token">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Token &ldquo;{created.name}&rdquo; created. Copy it now: it will not be shown again.
          </Typography>
          <Box
            component="code"
            sx={{ display: 'block', mt: 1, p: 1, wordBreak: 'break-all', bgcolor: 'var(--bg)', borderRadius: 1 }}
          >
            {created.token}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button size="small" variant="outlined" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="small" onClick={() => setCreated(null)}>
              Done
            </Button>
          </Box>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={create} sx={{ display: 'grid', gap: 2, mb: 3 }}>
        <TextField
          label="Token name"
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Claude Code on my laptop"
          required
          inputProps={{ maxLength: 100 }}
        />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField select label="Role" size="small" value={roleCap} onChange={(e) => setRoleCap(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="viewer">Viewer (read only)</MenuItem>
            <MenuItem value="commenter">Commenter</MenuItem>
          </TextField>
          <TextField select label="Expires" size="small" value={expiry} onChange={(e) => setExpiry(e.target.value)} sx={{ minWidth: 140 }}>
            {EXPIRY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <FormControlLabel
          control={<Checkbox checked={limitDiagrams} onChange={(e) => setLimitDiagrams(e.target.checked)} />}
          label="Limit to specific diagrams"
        />
        {limitDiagrams && (
          <Autocomplete
            multiple
            size="small"
            options={diagrams}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            getOptionLabel={(d) => d.name || d.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Diagrams this token may access" />}
          />
        )}
        <Box>
          <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
            {busy ? 'Creating...' : 'Create token'}
          </Button>
        </Box>
      </Box>

      {loadError && <Alert severity="warning">{loadError}</Alert>}
      {tokens.length === 0 && !loadError && (
        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
          No tokens yet.
        </Typography>
      )}
      <Box sx={{ display: 'grid', gap: 1 }}>
        {tokens.map((t) => {
          const state = tokenState(t);
          return (
            <Box
              key={t.id}
              data-testid="token-row"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', p: 1.5, border: '1px solid var(--border)', borderRadius: 1, opacity: state === 'active' ? 1 : 0.6 }}
            >
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, color: 'var(--text)' }}>{t.name}</Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                  {t.token_prefix}… · {t.role_cap}
                  {Array.isArray(t.diagram_ids) ? ` · ${t.diagram_ids.length} diagram(s)` : ' · all your diagrams'}
                  {' · expires '}
                  {fmt(t.expires_at)}
                  {' · last used '}
                  {fmt(t.last_used_at)}
                </Typography>
              </Box>
              <Chip size="small" label={state} color={state === 'active' ? 'success' : 'default'} />
              {state === 'active' &&
                (confirmRevoke === t.id ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" color="error" variant="contained" onClick={() => revoke(t.id)}>
                      Confirm revoke
                    </Button>
                    <Button size="small" onClick={() => setConfirmRevoke(null)}>
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <Button size="small" color="error" variant="outlined" onClick={() => setConfirmRevoke(t.id)}>
                    Revoke
                  </Button>
                ))}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
