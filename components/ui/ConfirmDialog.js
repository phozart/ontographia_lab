// components/ui/ConfirmDialog.js
// Confirmation dialog to replace browser confirm()

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const SEVERITY_CONFIG = {
  warning: {
    icon: WarningAmberIcon,
    color: '#d97706',
    bgColor: '#fef3c7',
  },
  danger: {
    icon: ErrorOutlineIcon,
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  info: {
    icon: InfoOutlinedIcon,
    color: '#2563eb',
    bgColor: '#dbeafe',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  loading = false,
}) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 'var(--shadow-xl)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: 18 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: config.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ color: config.color, fontSize: 24 }} />
          </Box>
          {title}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography
          color="text.secondary"
          sx={{ pl: 7, lineHeight: 1.6 }}
        >
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button
          onClick={onClose}
          color="inherit"
          disabled={loading}
          sx={{ fontWeight: 500 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={severity === 'danger' ? 'error' : 'primary'}
          disabled={loading}
          sx={{ fontWeight: 500 }}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Hook for easier usage
import { useState, useCallback } from 'react';

export function useConfirmDialog() {
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    severity: 'warning',
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

  const confirm = useCallback(
    ({ title, message, severity = 'warning', confirmText = 'Confirm' }) => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title,
          message,
          severity,
          confirmText,
          onConfirm: () => resolve(true),
        });
      });
    },
    []
  );

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onClose={handleClose}
      onConfirm={state.onConfirm}
      title={state.title}
      message={state.message}
      severity={state.severity}
      confirmText={state.confirmText}
    />
  );

  return { confirm, dialog };
}
