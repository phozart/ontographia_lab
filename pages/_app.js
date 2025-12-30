// pages/_app.js
// Ontographia Diagram Studio - Main App with Auth

import { useState, useEffect, useMemo } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { ToastProvider } from '../components/ui/ToastProvider';
import '../styles/globals.css';
import '../styles/diagram-studio.css';
import '../styles/diagram-studio-tokens.css';

function DiagramStudioApp({ Component, pageProps: { session, ...pageProps } }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('diagram-studio-theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  function handleThemeChange(next) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('diagram-studio-theme', next);
  }

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme === 'dark' ? 'dark' : 'light',
          primary: { main: theme === 'dark' ? '#3b82f6' : '#2563eb' },
          secondary: { main: theme === 'dark' ? '#94a3b8' : '#5a6b7c' },
          error: { main: '#dc2626' },
          warning: { main: '#d97706' },
          success: { main: '#059669' },
          background: {
            default: theme === 'dark' ? '#0f172a' : '#f5f7fa',
            paper: theme === 'dark' ? '#1e293b' : '#ffffff',
          },
          text: {
            primary: theme === 'dark' ? '#f1f5f9' : '#1a2b3c',
            secondary: theme === 'dark' ? '#94a3b8' : '#5a6b7c',
          },
        },
        shape: {
          borderRadius: 8,
        },
        typography: {
          fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
          h1: { fontWeight: 700 },
          h2: { fontWeight: 700 },
          h3: { fontWeight: 600 },
          h4: { fontWeight: 600 },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
          button: { textTransform: 'none', fontWeight: 500 },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 12,
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              },
            },
          },
        },
      }),
    [theme]
  );

  return (
    <SessionProvider session={session}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <ToastProvider>
          <Component {...pageProps} theme={theme} onThemeChange={handleThemeChange} />
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

export default DiagramStudioApp;
