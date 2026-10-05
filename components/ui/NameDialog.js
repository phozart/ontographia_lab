// components/ui/NameDialog.js
// Small "enter a name" dialog (new workspace, rename). Enter confirms, Escape cancels.

import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

export const MAX_NAME_LENGTH = 255;

export function NameDialog({
  open,
  title,
  initialValue = '',
  confirmText = 'Save',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const submit = () => {
    if (canSubmit) onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 18 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Workspace name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onCancel} color="inherit" disabled={busy} sx={{ fontWeight: 500 }}>
          Cancel
        </Button>
        <Button onClick={submit} variant="contained" disabled={!canSubmit} sx={{ fontWeight: 500 }}>
          {busy ? 'Working...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
