// components/ui/LoadingSkeleton.js
// Loading skeleton components for better perceived performance

import { Skeleton, Box, Grid } from '@mui/material';

export function DiagramCardSkeleton() {
  return (
    <Box
      sx={{
        bgcolor: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Skeleton
        variant="rectangular"
        height={140}
        sx={{ bgcolor: 'var(--bg)' }}
      />
      <Box sx={{ p: 2 }}>
        <Skeleton
          variant="text"
          width="70%"
          height={24}
          sx={{ bgcolor: 'var(--bg)', mb: 1 }}
        />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Skeleton
            variant="rounded"
            width={60}
            height={22}
            sx={{ bgcolor: 'var(--bg)' }}
          />
          <Skeleton
            variant="text"
            width={80}
            height={16}
            sx={{ bgcolor: 'var(--bg)' }}
          />
        </Box>
      </Box>
    </Box>
  );
}

export function DiagramGridSkeleton({ count = 8 }) {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
          <DiagramCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
}

export function PageHeaderSkeleton() {
  return (
    <Box sx={{ mb: 4 }}>
      <Skeleton
        variant="text"
        width={200}
        height={40}
        sx={{ bgcolor: 'var(--bg)', mb: 1 }}
      />
      <Skeleton
        variant="text"
        width={300}
        height={20}
        sx={{ bgcolor: 'var(--bg)' }}
      />
    </Box>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <Box sx={{ bgcolor: 'var(--panel)', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 2,
          p: 2,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            height={20}
            sx={{ bgcolor: 'var(--bg)' }}
          />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 2,
            p: 2,
            borderBottom:
              rowIndex < rows - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              height={20}
              sx={{ bgcolor: 'var(--bg)' }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function FullPageLoader() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--bg)',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        >
          <Box
            component="span"
            sx={{ color: 'white', fontWeight: 700, fontSize: 20 }}
          >
            D
          </Box>
        </Box>
        <Skeleton
          variant="text"
          width={120}
          height={20}
          sx={{ bgcolor: 'var(--border)', mx: 'auto' }}
        />
      </Box>
    </Box>
  );
}
