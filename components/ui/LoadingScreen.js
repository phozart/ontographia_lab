// components/ui/LoadingScreen.js
// Full-screen loading overlay with animated logo

import { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { LoadingLogo } from './Logo';

export default function LoadingScreen({ visible = true }) {
  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0d0d1a 0%, #0a0a14 50%, #080810 100%)',
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Subtle background glow */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(154, 138, 200, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <LoadingLogo size={70} />
    </Box>
  );
}

// Hook to manage loading state with minimum duration
export function useLoadingScreen(initialLoading = true, minDuration = 500) {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [showLoading, setShowLoading] = useState(initialLoading);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now();
      setShowLoading(true);
    } else {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, minDuration - elapsed);

      setTimeout(() => {
        setShowLoading(false);
      }, remaining);
    }
  }, [isLoading, minDuration]);

  return {
    isLoading: showLoading,
    setLoading: setIsLoading,
  };
}
