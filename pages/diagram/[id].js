// pages/diagram/[id].js
// Diagram Editor Page - Session-based authentication

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Box, Typography, CircularProgress } from '@mui/material';

// Dynamically import the diagram studio to avoid SSR issues
const DiagramStudio = dynamic(
  () => import('../../components/diagram-studio/DiagramStudio'),
  { ssr: false, loading: () => <LoadingScreen /> }
);

// Import profile
import { PROFILE_INFINITE_CANVAS, getProfile } from '../../components/diagram-studio/DiagramProfile';
import { applyAccessToProfile } from '../../components/diagram-studio/sharing/accessMode';

function LoadingScreen() {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--bg)',
      }}
    >
      <CircularProgress sx={{ mb: 2 }} />
      <Typography sx={{ color: 'var(--text-muted)' }}>Loading Diagram Studio...</Typography>
    </Box>
  );
}

export default function DiagramEditorPage({ theme }) {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const [diagram, setDiagram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packRegistry, setPackRegistry] = useState(null);

  // Initialize pack registry on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('../../components/diagram-studio/packs').then(({ createDefaultRegistry }) => {
        setPackRegistry(createDefaultRegistry());
      });
    }
  }, []);

  // Determine profile based on diagram type
  const baseProfile = useMemo(() => {
    if (diagram?.type === 'infinite-canvas') {
      return PROFILE_INFINITE_CANVAS;
    }
    // Map diagram type to profile (bpmn is now part of process-flow)
    const typeToProfile = {
      'bpmn': 'process-only', // BPMN is now unified with Process Flows
      'uml-class': 'uml-only',
      'cld': 'cld-only',
      'process-flow': 'process-only',
    };
    return getProfile(typeToProfile[diagram?.type] || 'full-studio');
  }, [diagram?.type]);

  // Viewers and commenters get a read-only editor (the server enforces the same rules on every request)
  const profile = useMemo(() => applyAccessToProfile(baseProfile, diagram?.access), [baseProfile, diagram?.access]);

  // Handle authentication
  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/login');
      return;
    }

    if (session.user?.status === 'pending') {
      router.replace('/pending-approval');
      return;
    }

    if (session.user?.status === 'suspended') {
      router.replace('/login?error=AccountSuspended');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    if (!id || status === 'loading' || !session) return;
    if (session.user?.status !== 'active') return;
    fetchDiagram();
  }, [id, session, status]);

  async function fetchDiagram() {
    try {
      const res = await fetch(`/api/diagrams/${id}`);
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      // 404 covers both "does not exist" and "no access" (the server never reveals which)
      if (res.status === 403 || res.status === 404) {
        setError('This diagram was not found, or you do not have access to it');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load diagram');
      }
      const data = await res.json();
      setDiagram(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Note: persistence is owned by DiagramContext.saveDiagram (exactly one PUT per save).
  // The page must not write the diagram itself (slice 0: removed the duplicate PUT).

  if (loading || !packRegistry) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--bg)',
        }}
      >
        <Typography variant="h5" sx={{ color: 'var(--text)', mb: 2 }}>
          Error
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)' }}>{error}</Typography>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>{diagram?.name || 'Workspace'} - Ontographia Lab</title>
      </Head>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DiagramStudio
          diagramId={id}
          access={diagram?.access}
          profile={profile}
          packRegistry={packRegistry}
          onExport={(format) => console.log('Export:', format)}
        />
      </Box>
    </>
  );
}

// Opt out of the default layout
DiagramEditorPage.getLayout = (page) => page;
