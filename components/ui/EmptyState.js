// components/ui/EmptyState.js
// Empty state component for when there's no content

import { Box, Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

export function EmptyState({
  title = 'No items yet',
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
  compact = false,
}) {
  const Icon = CustomIcon || FolderOpenIcon;

  return (
    <Box
      sx={{
        textAlign: 'center',
        py: compact ? 4 : 8,
        px: 4,
        bgcolor: 'var(--bg)',
        borderRadius: 3,
        border: '2px dashed var(--border)',
      }}
    >
      <Box
        sx={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          borderRadius: '50%',
          bgcolor: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2,
        }}
      >
        <Icon
          sx={{
            fontSize: compact ? 24 : 32,
            color: 'var(--accent)',
          }}
        />
      </Box>
      <Typography
        variant={compact ? 'subtitle1' : 'h6'}
        sx={{
          fontWeight: 600,
          color: 'var(--text)',
          mb: 1,
        }}
      >
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          sx={{
            color: 'var(--text-muted)',
            mb: actionLabel ? 3 : 0,
            maxWidth: 400,
            mx: 'auto',
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAction}
          sx={{
            fontWeight: 500,
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
