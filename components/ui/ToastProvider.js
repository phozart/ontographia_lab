// components/ui/ToastProvider.js
// Toast notification system using MUI Snackbar

import { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';

const ToastContext = createContext(null);

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, severity = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, severity, duration, open: true }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t))
    );
    // Remove from array after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.map((t, index) => (
        <Snackbar
          key={t.id}
          open={t.open}
          autoHideDuration={t.duration}
          onClose={() => removeToast(t.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          TransitionComponent={SlideTransition}
          sx={{ bottom: { xs: 24 + index * 60, sm: 24 + index * 60 } }}
        >
          <Alert
            onClose={() => removeToast(t.id)}
            severity={t.severity}
            variant="filled"
            sx={{
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              '& .MuiAlert-message': {
                fontWeight: 500,
              },
            }}
          >
            {t.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
