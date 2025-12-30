// pages/guide/shortcuts.js
// Keyboard Shortcuts guide page

import { Box, Typography, Grid } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import GuideLayout, { SKY } from '../../components/landing/GuideLayout';

function KeyboardKey({ children, wide }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: wide ? 2 : 1,
        py: 0.75,
        minWidth: 32,
        borderRadius: 1,
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 500,
        color: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0 2px 0 rgba(255,255,255,0.1)',
      }}
    >
      {children}
    </Box>
  );
}

function ShortcutRow({ keys, action }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {keys.map((key, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {i > 0 && <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, mx: 0.5 }}>+</Typography>}
            <KeyboardKey wide={key.length > 1}>{key}</KeyboardKey>
          </Box>
        ))}
      </Box>
      <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
        {action}
      </Typography>
    </Box>
  );
}

function ShortcutSection({ title, icon: Icon, shortcuts, color }) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        {Icon && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${color}15`,
            }}
          >
            <Icon sx={{ fontSize: 18, color }} />
          </Box>
        )}
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
          {title}
        </Typography>
      </Box>
      <Box>
        {shortcuts.map((shortcut, i) => (
          <ShortcutRow key={i} {...shortcut} />
        ))}
      </Box>
    </Box>
  );
}

export default function ShortcutsPage() {
  const toolShortcuts = [
    { keys: ['V'], action: 'Select tool' },
    { keys: ['C'], action: 'Connect tool' },
    { keys: ['H'], action: 'Pan tool' },
    { keys: ['M'], action: 'Comment tool' },
    { keys: ['Space'], action: 'Hold to pan (any mode)' },
  ];

  const selectionShortcuts = [
    { keys: ['Click'], action: 'Select element' },
    { keys: ['Shift', 'Click'], action: 'Add to selection' },
    { keys: ['⌘', 'A'], action: 'Select all' },
    { keys: ['Esc'], action: 'Deselect all' },
    { keys: ['Drag'], action: 'Marquee select' },
  ];

  const editingShortcuts = [
    { keys: ['Enter'], action: 'Open properties panel' },
    { keys: ['P'], action: 'Open properties panel' },
    { keys: ['Delete'], action: 'Delete selected' },
    { keys: ['Backspace'], action: 'Delete selected' },
    { keys: ['⌘', 'D'], action: 'Duplicate' },
    { keys: ['⌘', 'C'], action: 'Copy' },
    { keys: ['⌘', 'V'], action: 'Paste' },
    { keys: ['⌘', 'X'], action: 'Cut' },
  ];

  const historyShortcuts = [
    { keys: ['⌘', 'Z'], action: 'Undo' },
    { keys: ['⌘', 'Y'], action: 'Redo' },
    { keys: ['⌘', 'Shift', 'Z'], action: 'Redo (alternative)' },
  ];

  const viewportShortcuts = [
    { keys: ['+'], action: 'Zoom in' },
    { keys: ['-'], action: 'Zoom out' },
    { keys: ['0'], action: 'Fit to screen' },
    { keys: ['1'], action: 'Zoom to 100%' },
    { keys: ['Scroll'], action: 'Zoom in/out' },
    { keys: ['⌘', 'Scroll'], action: 'Zoom in/out (fine)' },
  ];

  const movementShortcuts = [
    { keys: ['↑'], action: 'Nudge up 1px' },
    { keys: ['↓'], action: 'Nudge down 1px' },
    { keys: ['←'], action: 'Nudge left 1px' },
    { keys: ['→'], action: 'Nudge right 1px' },
    { keys: ['Shift', '↑'], action: 'Nudge up 10px' },
    { keys: ['Shift', '↓'], action: 'Nudge down 10px' },
    { keys: ['Shift', '←'], action: 'Nudge left 10px' },
    { keys: ['Shift', '→'], action: 'Nudge right 10px' },
  ];

  const mindMapShortcuts = [
    { keys: ['Tab'], action: 'Create child topic' },
    { keys: ['Enter'], action: 'Create sibling topic' },
    { keys: ['Shift', 'Tab'], action: 'Select parent' },
    { keys: ['⌘', '['], action: 'Collapse subtree' },
    { keys: ['⌘', ']'], action: 'Expand subtree' },
  ];

  const orderingShortcuts = [
    { keys: ['⌘', 'Shift', ']'], action: 'Bring to front' },
    { keys: ['⌘', ']'], action: 'Bring forward' },
    { keys: ['⌘', '['], action: 'Send backward' },
    { keys: ['⌘', 'Shift', '['], action: 'Send to back' },
  ];

  return (
    <GuideLayout
      title="Keyboard Shortcuts"
      description="Master the keyboard shortcuts to work faster and more efficiently."
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: 32, md: 42 },
          fontWeight: 700,
          color: 'white',
          mb: 3,
        }}
      >
        Keyboard Shortcuts
      </Typography>

      <Typography
        sx={{
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        Master these shortcuts to navigate, select, and edit with maximum efficiency.
      </Typography>

      <Typography
        sx={{
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.4)',
          mb: 6,
        }}
      >
        Note: On Windows, replace ⌘ (Command) with Ctrl.
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ShortcutSection
              title="Tools"
              icon={KeyboardIcon}
              shortcuts={toolShortcuts}
              color={SKY.deepCyan}
            />
            <ShortcutSection
              title="Selection"
              shortcuts={selectionShortcuts}
              color={SKY.steelBlue}
            />
            <ShortcutSection
              title="History"
              shortcuts={historyShortcuts}
              color={SKY.deepLavender}
            />
            <ShortcutSection
              title="Mind Map"
              shortcuts={mindMapShortcuts}
              color={SKY.mauveRose}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ShortcutSection
              title="Editing"
              shortcuts={editingShortcuts}
              color={SKY.warmPeach}
            />
            <ShortcutSection
              title="Viewport"
              shortcuts={viewportShortcuts}
              color={SKY.goldenHour}
            />
            <ShortcutSection
              title="Movement"
              shortcuts={movementShortcuts}
              color={SKY.skyReturn}
            />
            <ShortcutSection
              title="Layer Ordering"
              shortcuts={orderingShortcuts}
              color={SKY.deepCyan}
            />
          </Box>
        </Grid>
      </Grid>

      <Box
        sx={{
          mt: 8,
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'white', mb: 2 }}>
          Quick Reference
        </Typography>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, mb: 3 }}>
          Press <KeyboardKey>?</KeyboardKey> anytime in the diagram studio to see
          this shortcuts reference.
        </Typography>
      </Box>
    </GuideLayout>
  );
}
