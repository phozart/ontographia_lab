// components/diagram-studio/DiagramStudio.js
// Main DiagramStudio component - unified diagramming tool

import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { generateId } from './utils/ids';
import { useSession } from 'next-auth/react';
import { resolveEditorShortcut, isTypingTarget } from './hooks/interaction/editorShortcuts';
import { getTemplateBounds, getContentBounds, computeTemplatePlacement, computeFitViewport } from './utils/templatePlacement';
import { DiagramProvider, useDiagram, useDiagramViewport, useDiagramSelection } from './DiagramContext';
import { getProfile, isActionAllowed, isModeAllowed } from './DiagramProfile';
import { ResizablePanel, PanelGroup } from './ResizablePanel';
import DiagramCanvas from './DiagramCanvas';
import DrawingLayer from './DrawingLayer';
import DrawingToolbar from './ui/DrawingToolbar';
import LeftPalette from './LeftPalette';
import PropertiesPanel from './PropertiesPanel';
import CommandPalette, { useCommandPalette } from './ui/CommandPalette';
import FrameNavigator from './ui/FrameNavigator';
import TitleBar from './ui/TitleBar';
import ShapeSidebar from './ui/ShapeSidebar';
import ContextualToolbar from './ui/ContextualToolbar';
import ShortcutsHelp, { useShortcutsHelp } from './ui/ShortcutsHelp';
import KeyboardShortcutsOverlay, { useKeyboardShortcutsOverlay } from './ui/KeyboardShortcutsOverlay';
import ContextMenu, { useContextMenu } from './ui/ContextMenu';
import { CommentMarker, CommentThread, NewCommentInput, useComments } from './ui/CommentSystem';
import StarterPackModal from './StarterPackModal';
import { LogoIcon } from '../ui/Logo';
import { ExportManager, downloadExport } from './export/ExportManager';
import ExportDialog, { useExportDialog } from './ui/ExportDialog';
import { initializeStencilStyles } from './styling/StencilStyleManager';
import LoadingScreen from '../ui/LoadingScreen';

// Default settings (used before API response)
// All packs enabled by default - users can customize via the "+N more" menu
const DEFAULT_SETTINGS = {
  toolbarPosition: 'top',
  enabledPacks: ['core', 'process-flow', 'cld', 'uml-class', 'mind-map', 'product-design', 'erd', 'togaf', 'itil', 'capability-map'],
  showContextualToolbarOnSelect: true, // Show floating style toolbar when selecting elements
};

// ============ MAIN COMPONENT ============

export default function DiagramStudio({
  diagramId,
  profile: profileInput,
  packRegistry,
  onSave,
  onExport,
  embedded = false,
  className = '',
}) {
  // Resolve profile from input (string ID or object)
  const profile = useMemo(() => {
    if (typeof profileInput === 'string') {
      return getProfile(profileInput);
    }
    return profileInput || getProfile('full-studio');
  }, [profileInput]);

  // Get available modes for the profile
  const availableModes = useMemo(() => {
    if (!packRegistry) return [];
    const packs = packRegistry.getAll?.() || [];
    return packs.filter(pack => isModeAllowed(profile, pack.id));
  }, [packRegistry, profile]);

  return (
    <DiagramProvider
      diagramId={diagramId}
      defaultPack={profile.allowedModes?.[0] || 'process-flow'}
      onSave={onSave}
    >
      <DiagramStudioInner
        diagramId={diagramId}
        profile={profile}
        packRegistry={packRegistry}
        availableModes={availableModes}
        onExport={onExport}
        embedded={embedded}
        className={className}
      />
    </DiagramProvider>
  );
}

// ============ INNER COMPONENT (uses context) ============

function DiagramStudioInner({
  diagramId,
  profile,
  packRegistry,
  availableModes,
  onExport,
  embedded,
  className,
  diagramName,
}) {
  const { data: session } = useSession();
  const { diagram, setDiagram, activePack, saveStatus, saveDiagram, elements, connections, addElement, addConnection, undo, redo, selectAll, clearSelection, deleteSelected, activeTool, setActiveTool, selectedStencil, setSelectedStencil, drawingTool, drawingColor, drawingStrokeWidth, isDragging, isRotating, stickyNoteColor } = useDiagram();
  const { viewport, setViewport, zoomIn, zoomOut } = useDiagramViewport();
  const { selection, selectedElements, selectElements } = useDiagramSelection();
  const [draggingStencil, setDraggingStencil] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [showStarterPacks, setShowStarterPacks] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false); // On-demand properties panel
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const canvasContainerRef = useRef(null); // Ref for canvas container (used by FrameNavigator)
  const iconBarRef = useRef(null); // Ref for ShapeSidebar (used by empty canvas welcome)

  // User settings state - loaded from API
  const [userSettings, setUserSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Loading screen state - shows for at least 500ms on initial load
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const loadingStartRef = useRef(Date.now());

  // Hide loading screen when settings are loaded (with minimum 500ms duration)
  useEffect(() => {
    if (settingsLoaded) {
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, 500 - elapsed);

      const timer = setTimeout(() => {
        setShowLoadingScreen(false);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [settingsLoaded]);

  // Fetch user settings from API on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const data = await res.json();
          setUserSettings(prev => ({ ...prev, ...data }));
        }
        // Initialize stencil styles from API/localStorage
        await initializeStencilStyles();
      } catch (error) {
        console.error('Failed to fetch user settings:', error);
      } finally {
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  // Save setting to API
  const updateUserSetting = useCallback(async (key, value) => {
    // Optimistically update local state
    setUserSettings(prev => ({ ...prev, [key]: value }));

    // Persist to API
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
    } catch (error) {
      console.error('Failed to save user setting:', error);
    }
  }, []);

  // Contextual toolbar visibility setting
  const showContextualToolbarOnSelect = userSettings.showContextualToolbarOnSelect ?? true;
  const toggleContextualToolbar = useCallback(() => {
    updateUserSetting('showContextualToolbarOnSelect', !showContextualToolbarOnSelect);
  }, [updateUserSetting, showContextualToolbarOnSelect]);
  const showToolbar = useCallback(() => {
    updateUserSetting('showContextualToolbarOnSelect', true);
  }, [updateUserSetting]);

  // Edit label request - triggers editing in DiagramCanvas
  const [editLabelRequest, setEditLabelRequest] = useState(null);
  const handleEditLabel = useCallback((elementId) => {
    // Set the request with a timestamp to ensure re-triggering even for the same element
    setEditLabelRequest({ id: elementId, timestamp: Date.now() });
  }, []);

  // Enabled packs from settings
  const [enabledPacks, setEnabledPacksState] = useState(DEFAULT_SETTINGS.enabledPacks);

  // Sync enabled packs with user settings when loaded
  useEffect(() => {
    if (settingsLoaded && userSettings.enabledPacks) {
      let packs = userSettings.enabledPacks;
      // Ensure core is always included
      if (!packs.includes('core')) {
        packs = ['core', ...packs];
      }
      setEnabledPacksState(packs);
    }
  }, [settingsLoaded, userSettings.enabledPacks]);

  // Update enabled packs with API persistence
  const setEnabledPacks = useCallback((newPacks) => {
    const packs = typeof newPacks === 'function' ? newPacks(enabledPacks) : newPacks;
    // Ensure core is always included
    const finalPacks = packs.includes('core') ? packs : ['core', ...packs];
    setEnabledPacksState(finalPacks);
    updateUserSetting('enabledPacks', finalPacks);
  }, [enabledPacks, updateUserSetting]);

  // Toggle a pack on/off (used by the "+N more" popover)
  const handleTogglePack = useCallback((packId) => {
    setEnabledPacks(prev => {
      if (prev.includes(packId)) {
        // Don't allow disabling the core pack
        if (packId === 'core') return prev;
        return prev.filter(id => id !== packId);
      } else {
        return [...prev, packId];
      }
    });
  }, [setEnabledPacks]);

  // Right panel shows automatically when there's a selection
  const hasSelection = selection?.nodeIds?.length > 0 || selection?.connectionIds?.length > 0;
  const commandPalette = useCommandPalette();
  const shortcutsHelp = useShortcutsHelp();
  const keyboardShortcuts = useKeyboardShortcutsOverlay();
  const exportDialog = useExportDialog();
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  // Comment system
  const {
    comments,
    activeComment,
    setActiveComment,
    newCommentPosition,
    addComment,
    addReply,
    resolveComment,
    deleteComment,
    startNewComment,
    cancelNewComment,
  } = useComments(diagramId);

  // Current user info for comments
  const currentUser = useMemo(() => ({
    id: session?.user?.id || 'local',
    name: session?.user?.name || 'You',
    email: session?.user?.email,
    image: session?.user?.image,
  }), [session]);

  // Sync panel collapsed state with user settings
  useEffect(() => {
    if (settingsLoaded && userSettings.leftPanelCollapsed !== undefined) {
      setLeftPanelCollapsed(userSettings.leftPanelCollapsed);
    }
  }, [settingsLoaded, userSettings.leftPanelCollapsed]);

  // Handle export
  const handleExport = useCallback(async (format) => {
    if (!isActionAllowed(profile, 'export')) return;

    try {
      const exportManager = new ExportManager();
      const diagramData = {
        id: diagram?.id,
        name: diagram?.name || 'Untitled Diagram',
        type: activePack,
        elements,
        connections,
        settings: diagram?.content?.settings || {},
      };

      const result = await exportManager.export(diagramData, format, {
        backgroundColor: '#ffffff',
        padding: 40,
      });

      downloadExport(result);

      // Also call the onExport callback if provided
      onExport?.(format);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [profile, onExport, diagram, elements, connections, activePack]);

  // Handle stencil drag start (for visual feedback)
  const handleStencilDragStart = useCallback((stencil) => {
    setDraggingStencil(stencil);
    // Auto-collapse the stencil panel when dragging starts
    setLeftPanelCollapsed(true);
    updateUserSetting('leftPanelCollapsed', true);
  }, [updateUserSetting]);

  // Handle stencil drag end
  const handleStencilDragEnd = useCallback(() => {
    setDraggingStencil(null);
  }, []);

  // Toggle left panel
  const toggleLeftPanel = useCallback(() => {
    setLeftPanelCollapsed(prev => {
      const next = !prev;
      updateUserSetting('leftPanelCollapsed', next);
      return next;
    });
  }, [updateUserSetting]);

  // Open the stencil panel (called by EmptyCanvasWelcome)
  const handleOpenStencilPanel = useCallback(() => {
    // Open the first pack's flyout in the ShapeSidebar
    iconBarRef.current?.openFirstPack();
  }, []);

  // Open template selection (called by EmptyCanvasWelcome)
  const handleOpenTemplates = useCallback(() => {
    // Show the starter packs modal (which includes templates)
    setShowStarterPacks(true);
  }, []);

  // Handle adding a new comment
  const handleAddComment = useCallback((text) => {
    if (newCommentPosition) {
      addComment(text, newCommentPosition.x, newCommentPosition.y, newCommentPosition.elementId, currentUser);
    }
  }, [newCommentPosition, addComment, currentUser]);

  // Handle reply to comment
  const handleAddReply = useCallback((commentId, text) => {
    addReply(commentId, text, currentUser);
  }, [addReply, currentUser]);

  // Handle applying a template: place it in the first empty region right of the
  // existing content (or centered in the viewport on an empty canvas), fit the
  // viewport to it and select everything that was inserted.
  const handleApplyStarterPack = useCallback((starterPack) => {
    if (!starterPack) return;

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    const container = { width: rect?.width || 1200, height: rect?.height || 800 };
    const bounds = getTemplateBounds(starterPack);
    const { dx, dy } = computeTemplatePlacement({
      bounds,
      contentBounds: getContentBounds(elements),
      viewport,
      container,
    });
    const insertedIds = [];

    // Create frame first (so it renders behind elements in z-order)
    let frameId = null;
    if (starterPack.frame) {
      frameId = generateId('frame');
      insertedIds.push(frameId);
      addElement({
        type: 'frame',
        packId: 'core',
        id: frameId,
        label: starterPack.frame.label || 'Untitled Frame',
        x: starterPack.frame.x + dx,
        y: starterPack.frame.y + dy,
        size: {
          width: starterPack.frame.width,
          height: starterPack.frame.height,
        },
        isFrame: true,
      });
    }

    // Template shapes are explicit members of the template's frame (null when
    // there is none, so nothing underneath is ever adopted)
    const idMap = {};
    starterPack.elements.forEach((el, idx) => {
      const newId = generateId('el');
      idMap[idx] = newId;
      insertedIds.push(newId);
      addElement({
        ...el,
        id: newId,
        x: (el.x || 0) + dx,
        y: (el.y || 0) + dy,
        packId: starterPack.packId,
        parentFrameId: frameId,
      });
    });

    // Add connections with mapped IDs (with frame reference for clipping)
    starterPack.connections?.forEach((conn) => {
      const sourceId = idMap[conn.sourceIdx];
      const targetId = idMap[conn.targetIdx];
      if (sourceId && targetId) {
        addConnection({
          sourceId,
          targetId,
          sourcePort: conn.sourcePort || 'right',
          targetPort: conn.targetPort || 'left',
          label: conn.label,
          lineStyle: 'step', // Use step for process flows
          parentFrameId: frameId, // Reference to containing frame for clipping
        });
      }
    });

    setViewport?.(computeFitViewport(
      { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height },
      container,
    ));
    selectElements?.(insertedIds);
  }, [addElement, addConnection, elements, viewport, setViewport, selectElements]);

  // Toggle comment tool
  const toggleCommentTool = useCallback(() => {
    setActiveTool?.(activeTool === 'comment' ? 'select' : 'comment');
  }, [activeTool, setActiveTool]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle preview mode (hides all UI)
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(prev => !prev);
  }, []);

  // Handle command palette actions
  const handleCommandAction = useCallback((action) => {
    switch (action) {
      case 'select-all':
        selectAll?.();
        break;
      case 'deselect':
        clearSelection?.();
        break;
      case 'delete':
        deleteSelected?.();
        break;
      case 'save':
        saveDiagram(true);
        break;
      case 'focus-mode':
        setFocusMode(prev => !prev);
        break;
      case 'toggle-left':
        toggleLeftPanel();
        break;
      case 'toggle-comments':
        setShowComments(prev => !prev);
        break;
      case 'add-comment':
        toggleCommentTool();
        break;
      case 'export-svg':
        handleExport('svg');
        break;
      case 'export-png':
        handleExport('png');
        break;
      case 'export-json':
        handleExport('json');
        break;
      case 'keyboard-shortcuts':
        shortcutsHelp.open();
        break;
      default:
        console.log('Command action:', action);
    }
  }, [selectAll, clearSelection, deleteSelected, saveDiagram, handleExport, toggleCommentTool, shortcutsHelp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in an input / textarea / select / contenteditable
      if (isTypingTarget(e.target)) return;

      // Undo / redo / tool switching / zoom (V, H, +, -)
      const editorAction = resolveEditorShortcut(e);
      if (editorAction) {
        const readOnly = profile.editingPolicy?.readOnly;
        switch (editorAction) {
          case 'undo': e.preventDefault(); if (!readOnly) undo?.(); return;
          case 'redo': e.preventDefault(); if (!readOnly) redo?.(); return;
          case 'tool-select': e.preventDefault(); setActiveTool?.('select'); return;
          case 'tool-pan': e.preventDefault(); setActiveTool?.('pan'); return;
          case 'zoom-in': e.preventDefault(); zoomIn?.(); return;
          case 'zoom-out': e.preventDefault(); zoomOut?.(); return;
          default: break;
        }
      }

      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!profile.editingPolicy?.readOnly) {
          saveDiagram(true);
        }
      }

      // F key to toggle focus mode
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setFocusMode(prev => !prev);
      }

      // 1 key to toggle left panel (stencil panel)
      if (e.key === '1' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleLeftPanel();
      }

      // K key to toggle comment mode (M is for minimap)
      if (e.key === 'k' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleCommentTool();
      }

      // N key to add sticky note at center of viewport
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !profile.editingPolicy?.readOnly) {
        e.preventDefault();
        // Calculate center of current viewport
        const containerEl = document.querySelector('.ds-canvas-container');
        if (containerEl && viewport) {
          const rect = containerEl.getBoundingClientRect();
          const centerX = (rect.width / 2) / viewport.scale - viewport.x;
          const centerY = (rect.height / 2) / viewport.scale - viewport.y;

          // Snap to grid
          const gridSize = 20;
          const snappedX = Math.round(centerX / gridSize) * gridSize - 75; // Center the 150px note
          const snappedY = Math.round(centerY / gridSize) * gridSize - 75;

          addElement({
            type: 'sticky-medium',
            packId: 'sticky-notes',
            label: '',
            x: snappedX,
            y: snappedY,
            size: { width: 150, height: 150 },
            color: stickyNoteColor || '#fef08a',
          });
        }
      }

      // (H is the Pan tool; comment visibility is toggled from the toolbar / command palette)

      // P key to toggle properties panel (when selection exists)
      if (e.key === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (hasSelection) {
          setShowPropertiesPanel(prev => !prev);
        }
      }

      // T key to toggle contextual toolbar
      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleContextualToolbar();
      }

      // Enter key - no longer auto-opens properties panel
      // Properties panel is opened via right-click context menu or P key

      // Escape to exit preview mode, focus mode, comment mode, draw mode, or close properties panel
      if (e.key === 'Escape') {
        if (isPreviewMode) {
          setIsPreviewMode(false);
          return;
        }
        if (showPropertiesPanel) {
          setShowPropertiesPanel(false);
          return;
        }
        if (focusMode) {
          setFocusMode(false);
        }
        if (activeTool === 'comment') {
          setActiveTool?.('select');
        }
        if (activeTool === 'draw') {
          setActiveTool?.('select');
          setSelectedStencil?.(null);
        }
        cancelNewComment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDiagram, profile.editingPolicy?.readOnly, focusMode, toggleLeftPanel, toggleCommentTool, activeTool, setActiveTool, setSelectedStencil, cancelNewComment, hasSelection, showPropertiesPanel, toggleContextualToolbar, viewport, addElement, stickyNoteColor, isPreviewMode, undo, redo, zoomIn, zoomOut]);

  // UI visibility from profile
  const showRightPanel = profile.uiPolicy?.showRightPanel !== false;

  // Embedded mode: minimal UI
  if (embedded) {
    return (
      <div className={`ds-container ds-embedded ${className}`}>
        <DiagramCanvas
          packRegistry={packRegistry}
          profile={profile}
        />
      </div>
    );
  }

  return (
    <div className={`ds-container ds-new-layout ${focusMode ? 'ds-focus-mode' : ''} ${isPreviewMode ? 'ds-preview-mode' : ''} ${className}`}>
      {/* Loading Screen - shows on initial load with animated logo */}
      <LoadingScreen visible={showLoadingScreen} />

      {/* TitleBar + ShapeSidebar */}
      {!isPreviewMode && (
        <>
          <TitleBar
            diagramName={diagram?.name || 'Untitled Diagram'}
            onClose={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            onPreview={togglePreviewMode}
            onFullscreen={toggleFullscreen}
            onGoHome={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            onNameChange={(name) => {
              if (diagram) {
                setDiagram({ ...diagram, name });
                saveDiagram?.({ force: true, name });
              }
            }}
            onSave={() => saveDiagram?.(true)}
            onExport={handleExport}
            onShowShortcuts={shortcutsHelp.open}
            onShare={() => {
              // TODO: Implement share
            }}
            readOnly={profile?.editingPolicy?.readOnly}
            isFullscreen={isFullscreen}
            isPreviewMode={isPreviewMode}
            collaborators={[]}
          />
          <ShapeSidebar
            ref={iconBarRef}
            packRegistry={packRegistry}
            enabledPacks={enabledPacks}
            onStencilDragStart={(packId, stencilId) => {
              const pack = packRegistry?.get?.(packId);
              const stencil = pack?.stencils?.find(s => s.id === stencilId);
              if (stencil) {
                handleStencilDragStart({ ...stencil, packId });
              }
            }}
            onStencilSelect={(packId, stencilId) => {
              const pack = packRegistry?.get?.(packId);
              const stencil = pack?.stencils?.find(s => s.id === stencilId);
              if (stencil) {
                setSelectedStencil({ ...stencil, packId });
                setActiveTool('draw');
              }
            }}
            selectedStencil={selectedStencil}
            onAddPack={() => setShowStarterPacks(true)}
            onTogglePack={handleTogglePack}
            readOnly={profile?.editingPolicy?.readOnly}
          />
        </>
      )}

      {/* Main workspace area */}
      <div className={`ds-workspace ds-workspace-new`}>
        {/* Command Palette */}
        <CommandPalette
          isOpen={commandPalette.isOpen}
          onClose={commandPalette.close}
          packRegistry={packRegistry}
          onAction={handleCommandAction}
        />

        {/* Preview Mode Exit Button */}
        {isPreviewMode && (
          <button
            className="ds-preview-exit-btn"
            onClick={() => setIsPreviewMode(false)}
            title="Exit Preview (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Exit Preview
          </button>
        )}

        {/* Shortcuts Help Panel (legacy) */}
        <ShortcutsHelp
          isOpen={shortcutsHelp.isOpen}
          onClose={shortcutsHelp.close}
        />

        {/* Keyboard Shortcuts Overlay (new - activated by ? key) */}
        <KeyboardShortcutsOverlay
          isOpen={keyboardShortcuts.isOpen}
          onClose={keyboardShortcuts.close}
        />

        {/* Export Dialog */}
        <ExportDialog
          isOpen={exportDialog.isOpen}
          onClose={exportDialog.close}
          elements={elements}
          connections={connections}
          viewport={viewport}
          diagramName={diagram?.name || 'diagram'}
        />

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            position={contextMenu.position}
            targetElement={contextMenu.targetElement}
            onClose={closeContextMenu}
            onAddComment={startNewComment}
            onShowProperties={() => setShowPropertiesPanel(true)}
            showContextualToolbar={showContextualToolbarOnSelect}
            onToggleContextualToolbar={toggleContextualToolbar}
            showStencilPanel={!leftPanelCollapsed}
            onToggleStencilPanel={toggleLeftPanel}
          />
        )}

        {/* Contextual Toolbar for Selection - hidden during drag and rotation operations */}
        {hasSelection && showContextualToolbarOnSelect && !isDragging && !isRotating && (
          <ContextualToolbar
            viewport={viewport}
            packRegistry={packRegistry}
            containerRef={canvasContainerRef}
            onClose={toggleContextualToolbar}
            onEditLabel={handleEditLabel}
          />
        )}

        {/* Drawing Toolbar - color and stroke width for pen/highlighter */}
        {activeTool === 'draw' && <DrawingToolbar />}

        {/* Main Content Area */}
        <div className="ds-main">
          <PanelGroup>
            {/* Canvas (center) */}
            <div className={`ds-canvas-container ${activeTool === 'comment' ? 'comment-mode' : ''}`} ref={canvasContainerRef}>
              <DiagramCanvas
                packRegistry={packRegistry}
                profile={profile}
                draggingStencil={draggingStencil}
                onDragEnd={handleStencilDragEnd}
                onCanvasClick={activeTool === 'comment' ? startNewComment : undefined}
                onContextMenu={openContextMenu}
                commentMode={activeTool === 'comment'}
                onDragStart={() => setShowPropertiesPanel(false)}
                onShowProperties={() => setShowPropertiesPanel(true)}
                onShowToolbar={showToolbar}
                editLabelRequest={editLabelRequest}
                onOpenStencilPanel={handleOpenStencilPanel}
                onOpenTemplates={handleOpenTemplates}
                onShowShortcuts={shortcutsHelp.open}
              />

              {/* Drawing Layer Overlay */}
              <DrawingLayer
                drawingTool={activeTool === 'draw' ? drawingTool : null}
                drawingColor={drawingColor}
                drawingStrokeWidth={drawingStrokeWidth}
              />

              {/* Frame Navigator - Miro-style frame sub-boards */}
              <FrameNavigator
                packRegistry={packRegistry}
                containerRef={canvasContainerRef}
              />

              {/* Comment Markers Overlay */}
              {showComments && viewport && comments.map(comment => (
                <CommentMarker
                  key={comment.id}
                  comment={comment}
                  isActive={activeComment?.id === comment.id}
                  onClick={(c) => setActiveComment(c)}
                  viewport={viewport}
                />
              ))}
            </div>

            {/* Right Properties Panel - On-demand in floating UI mode */}
            {showRightPanel && hasSelection && showPropertiesPanel && (
              <div className={`ds-panel-wrapper ds-panel-right ds-panel-slide-in`}>
                <ResizablePanel
                  position="right"
                  defaultSize={280}
                  minSize={220}
                  maxSize={400}
                  storageKey="ds-right-panel"
                >
                  <PropertiesPanel
                    packRegistry={packRegistry}
                    profile={profile}
                    onClose={() => setShowPropertiesPanel(false)}
                  />
                </ResizablePanel>
              </div>
            )}
          </PanelGroup>
        </div>

        {/* Drag overlay indicator */}
        {draggingStencil && (
          <div className="ds-drag-indicator">
            Drop to add: {draggingStencil.name}
          </div>
        )}

        {/* Comment Thread Popup */}
        {activeComment && viewport && (
          <CommentThread
            comment={activeComment}
            currentUser={currentUser}
            onClose={() => setActiveComment(null)}
            onAddReply={handleAddReply}
            onResolve={resolveComment}
            onDelete={deleteComment}
            position={{
              // Convert canvas coordinates to screen coordinates
              // Same formula as CommentMarker: (canvasCoord + panOffset) * scale
              x: (activeComment.x + viewport.x) * viewport.scale + 30,
              y: (activeComment.y + viewport.y) * viewport.scale,
            }}
          />
        )}

        {/* New Comment Input */}
        {newCommentPosition && viewport && (
          <NewCommentInput
            position={{
              // Convert canvas coordinates to screen coordinates
              // Same formula as CommentMarker: (canvasCoord + panOffset) * scale
              x: (newCommentPosition.x + viewport.x) * viewport.scale + 30,
              y: (newCommentPosition.y + viewport.y) * viewport.scale,
            }}
            currentUser={currentUser}
            onSubmit={handleAddComment}
            onCancel={cancelNewComment}
          />
        )}

        {/* Comment Mode Indicator */}
        {activeTool === 'comment' && (
          <div className="ds-comment-mode-indicator">
            <span>Click anywhere to add a comment</span>
            <kbd>Esc</kbd>
          </div>
        )}

        {/* Draw Mode Indicator */}
        {activeTool === 'draw' && (
          <div className="ds-draw-mode-indicator">
            <span>Draw to place element - drag to set size</span>
            <kbd>Esc</kbd>
          </div>
        )}

        {/* Save Status Indicator */}
        <div className={`ds-save-status ${saveStatus.saving ? 'saving' : saveStatus.dirty ? 'unsaved' : 'saved'}`}>
          {saveStatus.saving ? (
            <>
              <span className="ds-save-spinner" />
              <span>Saving...</span>
            </>
          ) : saveStatus.dirty ? (
            <span>Unsaved changes</span>
          ) : saveStatus.lastSaved ? (
            <span>Saved</span>
          ) : null}
        </div>

        {/* Starter Pack Modal */}
        <StarterPackModal
          isOpen={showStarterPacks}
          onClose={() => setShowStarterPacks(false)}
          onApply={handleApplyStarterPack}
        />
      </div>
    </div>
  );
}

// ============ EXPORTS ============

export { DiagramProvider } from './DiagramContext';
export { getProfile, createProfile, PROFILES } from './DiagramProfile';
export { ResizablePanel, PanelGroup } from './ResizablePanel';
