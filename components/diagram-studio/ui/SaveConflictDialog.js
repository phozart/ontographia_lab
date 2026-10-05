// components/diagram-studio/ui/SaveConflictDialog.js
// Shown when the server rejects a save with 409 REVISION_CONFLICT (someone else saved a newer revision).
// ADR-0003 section 7: offer "Reload latest" (discard local edits) or "Save my version as a copy".

import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export default function SaveConflictDialog({ open, busy = false, error = null, onReload, onSaveCopy }) {
  return (
    <Dialog open={open} aria-labelledby="save-conflict-title" aria-describedby="save-conflict-desc">
      <DialogTitle id="save-conflict-title">This diagram was changed elsewhere</DialogTitle>
      <DialogContent>
        <DialogContentText id="save-conflict-desc">
          Someone else saved a newer version while you were editing, so your changes were not saved over it.
          You can load the latest version (your unsaved edits will be lost) or keep your edits by saving
          them as a new diagram.
        </DialogContentText>
        {error ? (
          <DialogContentText role="alert" sx={{ mt: 1, color: 'error.main' }}>{error}</DialogContentText>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onReload} disabled={busy}>Reload latest</Button>
        <Button onClick={onSaveCopy} disabled={busy} variant="contained">Save my version as a copy</Button>
      </DialogActions>
    </Dialog>
  );
}
