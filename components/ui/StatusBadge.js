// components/ui/StatusBadge.js
// Status badge component for user statuses and roles

import { Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#92400e',
    bgColor: '#fef3c7',
    borderColor: '#fcd34d',
    icon: PendingIcon,
  },
  active: {
    label: 'Active',
    color: '#065f46',
    bgColor: '#d1fae5',
    borderColor: '#6ee7b7',
    icon: CheckCircleIcon,
  },
  suspended: {
    label: 'Suspended',
    color: '#991b1b',
    bgColor: '#fee2e2',
    borderColor: '#fca5a5',
    icon: BlockIcon,
  },
};

const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    color: '#1e40af',
    bgColor: '#dbeafe',
    borderColor: '#93c5fd',
    icon: AdminPanelSettingsIcon,
  },
  user: {
    label: 'User',
    color: '#374151',
    bgColor: '#f3f4f6',
    borderColor: '#d1d5db',
    icon: PersonIcon,
  },
};

export function StatusBadge({ status, size = 'small' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <Chip
      icon={<Icon sx={{ fontSize: 14, color: `${config.color} !important` }} />}
      label={config.label}
      size={size}
      sx={{
        height: size === 'small' ? 24 : 28,
        fontSize: size === 'small' ? 12 : 13,
        fontWeight: 500,
        bgcolor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        '& .MuiChip-icon': {
          marginLeft: '8px',
        },
      }}
    />
  );
}

export function RoleBadge({ role, size = 'small' }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const Icon = config.icon;

  return (
    <Chip
      icon={<Icon sx={{ fontSize: 14, color: `${config.color} !important` }} />}
      label={config.label}
      size={size}
      sx={{
        height: size === 'small' ? 24 : 28,
        fontSize: size === 'small' ? 12 : 13,
        fontWeight: 500,
        bgcolor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        '& .MuiChip-icon': {
          marginLeft: '8px',
        },
      }}
    />
  );
}
