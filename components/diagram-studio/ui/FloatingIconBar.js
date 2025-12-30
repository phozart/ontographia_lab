// components/diagram-studio/ui/FloatingIconBar.js
// Floating icon bar for quick stencil access - Ontographia's purpose-driven UI

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  // Core & Basic shapes
  CropFreeOutlined,
  SquareOutlined,
  // Process & Flow
  AccountTreeOutlined,
  PlayArrowOutlined,
  // Mind & Thinking
  PsychologyOutlined,
  HubOutlined,
  BubbleChartOutlined,
  // Technical & Architecture
  SchemaOutlined,
  StorageOutlined,
  DataObjectOutlined,
  // Enterprise & Business
  BusinessOutlined,
  SettingsSuggestOutlined,
  AppsOutlined,
  GridViewOutlined,
  // Notes & Design
  StickyNote2Outlined,
  DesignServicesOutlined,
  CategoryOutlined,
  // Add
  AddOutlined,
  // Check mark for enabled indicator
  CheckCircleOutlined,
  MoreHorizOutlined,
} from '@mui/icons-material';

// Map pack IDs to distinctive icons
const PACK_ICONS = {
  'core': <SquareOutlined />,
  'process-flow': <AccountTreeOutlined />,
  'cld': <BubbleChartOutlined />,
  'uml-class': <DataObjectOutlined />,
  'mind-map': <HubOutlined />,
  'sticky-notes': <StickyNote2Outlined />,
  'erd': <StorageOutlined />,
  'togaf': <BusinessOutlined />,
  'itil': <SettingsSuggestOutlined />,
  'capability-map': <GridViewOutlined />,
  'product-design': <DesignServicesOutlined />,
};

const FloatingIconBar = forwardRef(function FloatingIconBar({
  packRegistry,
  enabledPacks,
  onPackSelect,
  onAddPack,
  onTogglePack,
  onStencilDragStart,
  onStencilSelect,
  selectedStencil,
  readOnly,
}, ref) {
  const [activeFlyout, setActiveFlyout] = useState(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0 });
  const [isPinned, setIsPinned] = useState(false);
  const [showMorePacks, setShowMorePacks] = useState(false);
  const barRef = useRef(null);
  const buttonRefs = useRef({});
  const moreButtonRef = useRef(null);

  // Get enabled pack objects
  const packs = enabledPacks
    ?.map(packId => packRegistry?.get?.(packId))
    .filter(Boolean) || [];

  // Get all available packs from registry
  const allPacks = packRegistry?.getAll?.() || [];
  const hiddenPacksCount = allPacks.length - packs.length;

  // Expose imperative methods to parent components
  const openFirstPack = useCallback(() => {
    if (packs.length > 0) {
      const firstPackId = packs[0].id;
      const buttonEl = buttonRefs.current[firstPackId];
      if (buttonEl && barRef.current) {
        const barRect = barRef.current.getBoundingClientRect();
        const btnRect = buttonEl.getBoundingClientRect();
        setFlyoutPosition({
          top: btnRect.top - barRect.top,
        });
      }
      setActiveFlyout(firstPackId);
      onPackSelect?.(firstPackId);
    }
  }, [packs, onPackSelect]);

  useImperativeHandle(ref, () => ({
    openFirstPack,
  }), [openFirstPack]);

  // Handle click outside to close flyout (only if not pinned)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeFlyout && !isPinned && !e.target.closest('.ds-icon-bar') && !e.target.closest('.ds-stencil-flyout')) {
        setActiveFlyout(null);
      }
      // Close more packs popover when clicking outside
      if (showMorePacks && !e.target.closest('.ds-icon-bar') && !e.target.closest('.ds-more-packs-popover')) {
        setShowMorePacks(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeFlyout, isPinned, showMorePacks]);

  // Calculate flyout position based on clicked button
  const handlePackClick = (packId) => {
    if (activeFlyout === packId) {
      setActiveFlyout(null);
      return;
    }

    const buttonEl = buttonRefs.current[packId];
    if (buttonEl && barRef.current) {
      const barRect = barRef.current.getBoundingClientRect();
      const btnRect = buttonEl.getBoundingClientRect();
      setFlyoutPosition({
        top: btnRect.top - barRect.top,
      });
    }
    setActiveFlyout(packId);
    onPackSelect?.(packId);
  };

  const activePack = activeFlyout ? packRegistry?.get?.(activeFlyout) : null;

  return (
    <>
      {/* Icon Bar - Stencil packs only (tools are in top FloatingEditBar) */}
      <div className="ds-icon-bar" ref={barRef}>
        {/* Pack icons */}
        <div className="ds-icon-bar-section">
          {packs.map(pack => (
            <IconButton
              key={pack.id}
              ref={(el) => buttonRefs.current[pack.id] = el}
              icon={PACK_ICONS[pack.id] || <CategoryOutlined />}
              active={activeFlyout === pack.id}
              onClick={() => handlePackClick(pack.id)}
              tooltip={pack.name}
            />
          ))}
        </div>

        {/* "+N more" badge for hidden packs */}
        {hiddenPacksCount > 0 && (
          <>
            <div className="ds-icon-bar-divider" />
            <div className="ds-icon-bar-section">
              <button
                ref={moreButtonRef}
                className={`ds-more-packs-btn ${showMorePacks ? 'active' : ''}`}
                onClick={() => setShowMorePacks(!showMorePacks)}
                title={`${hiddenPacksCount} more stencil packs available`}
              >
                <span className="ds-more-packs-count">+{hiddenPacksCount}</span>
              </button>
            </div>
          </>
        )}

        {!readOnly && hiddenPacksCount === 0 && (
          <>
            <div className="ds-icon-bar-divider" />
            <div className="ds-icon-bar-section">
              <IconButton
                icon={<AddOutlined />}
                onClick={onAddPack}
                tooltip="Manage stencil packs"
              />
            </div>
          </>
        )}

        <style jsx>{`
          .ds-icon-bar {
            position: fixed;
            left: 12px;
            top: 70px;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            background: white;
            border-radius: 12px;
            box-shadow: var(--ds-shadow-toolbar);
            z-index: var(--ds-z-toolbar);
          }

          .ds-icon-bar-section {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .ds-icon-bar-divider {
            width: 32px;
            height: 1px;
            background: rgba(0, 0, 0, 0.08);
            margin: 8px 0;
          }

          .ds-more-packs-btn {
            width: var(--ds-icon-btn-size, 40px);
            height: var(--ds-icon-btn-size, 40px);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px dashed rgba(0, 0, 0, 0.15);
            border-radius: 10px;
            background: transparent;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .ds-more-packs-btn:hover {
            background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
            border-color: rgba(0, 0, 0, 0.25);
          }

          .ds-more-packs-btn.active {
            background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
            border-color: var(--ds-active-color, #0e74a3);
            border-style: solid;
          }

          .ds-more-packs-count {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted, #6b7280);
          }

          .ds-more-packs-btn:hover .ds-more-packs-count,
          .ds-more-packs-btn.active .ds-more-packs-count {
            color: var(--ds-active-color, #0e74a3);
          }
        `}</style>
      </div>

      {/* Stencil Flyout */}
      {activePack && (
        <StencilFlyout
          pack={activePack}
          position={flyoutPosition}
          onClose={() => { setActiveFlyout(null); setIsPinned(false); }}
          onStencilDragStart={onStencilDragStart}
          onStencilSelect={onStencilSelect}
          selectedStencil={selectedStencil}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned(!isPinned)}
        />
      )}

      {/* More Packs Popover */}
      {showMorePacks && (
        <MorePacksPopover
          allPacks={allPacks}
          enabledPacks={enabledPacks}
          packIcons={PACK_ICONS}
          onTogglePack={(packId) => {
            onTogglePack?.(packId);
          }}
          onClose={() => setShowMorePacks(false)}
        />
      )}
    </>
  );
});

// Icon button component with forwardRef
const IconButton = forwardRef(function IconButton({ icon, active, onClick, tooltip, ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={`ds-icon-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={tooltip}
    >
      {icon}
      <style jsx>{`
        .ds-icon-btn {
          width: var(--ds-icon-btn-size, 40px);
          height: var(--ds-icon-btn-size, 40px);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-icon-btn:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .ds-icon-btn.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-icon-btn :global(svg) {
          font-size: var(--ds-icon-size, 24px);
        }
      `}</style>
    </button>
  );
});

// Import pin icon
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PushPinIcon from '@mui/icons-material/PushPin';

// Stencil flyout panel
function StencilFlyout({ pack, position, onClose, onStencilDragStart, onStencilSelect, selectedStencil, isPinned, onTogglePin }) {
  const [searchTerm, setSearchTerm] = useState('');
  const flyoutRef = useRef(null);

  const stencils = pack.stencils || [];
  const filteredStencils = searchTerm
    ? stencils.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : stencils;

  // Group stencils by group property if available
  const groups = {};
  filteredStencils.forEach(stencil => {
    const group = stencil.group || 'General';
    if (!groups[group]) groups[group] = [];
    groups[group].push(stencil);
  });

  const handleDragStart = (e, stencil) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'stencil',
      packId: pack.id,
      stencilId: stencil.id,
    }));
    e.dataTransfer.effectAllowed = 'copy';
    onStencilDragStart?.(pack.id, stencil.id);
    // Only close if not pinned
    if (!isPinned) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  const handleStencilClick = (stencil) => {
    onStencilSelect?.(pack.id, stencil.id);
    // Only close if not pinned
    if (!isPinned) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  const isSelected = (stencil) => {
    return selectedStencil?.packId === pack.id && selectedStencil?.stencilId === stencil.id;
  };

  return (
    <div
      className={`ds-stencil-flyout ${isPinned ? 'pinned' : ''}`}
      ref={flyoutRef}
      style={{ top: `calc(50% - 50vh + ${position.top}px + 12px)` }}
    >
      {/* Header */}
      <div className="ds-flyout-header">
        <div className="ds-flyout-title">
          <span className="ds-flyout-icon">{pack.icon}</span>
          <span>{pack.name}</span>
        </div>
        <div className="ds-flyout-actions">
          <button
            className={`ds-flyout-btn ${isPinned ? 'active' : ''}`}
            onClick={onTogglePin}
            title={isPinned ? 'Unpin (show full view)' : 'Pin (keep open, compact view)'}
          >
            {isPinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
          </button>
          <button className="ds-flyout-close" onClick={onClose}>×</button>
        </div>
      </div>

      {/* Search */}
      <div className="ds-flyout-search">
        <input
          type="text"
          placeholder="Search stencils..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      {/* Stencil groups */}
      <div className="ds-flyout-content">
        {Object.entries(groups).map(([groupName, groupStencils]) => (
          <div key={groupName} className="ds-stencil-group">
            {Object.keys(groups).length > 1 && (
              <div className="ds-stencil-group-name">{groupName}</div>
            )}
            <div className="ds-stencil-grid">
              {groupStencils.map(stencil => (
                <div
                  key={stencil.id}
                  className={`ds-stencil-item ${isSelected(stencil) ? 'selected' : ''}`}
                  draggable
                  onClick={() => handleStencilClick(stencil)}
                  onDragStart={(e) => handleDragStart(e, stencil)}
                  title={`Click to select, or drag ${stencil.name} to canvas`}
                >
                  <div className="ds-stencil-icon">{stencil.icon}</div>
                  <div className="ds-stencil-name">{stencil.name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredStencils.length === 0 && (
          <div className="ds-flyout-empty">
            No stencils found
          </div>
        )}
      </div>

      <style jsx>{`
        .ds-stencil-flyout {
          position: fixed;
          left: calc(12px + var(--ds-icon-bar-width, 52px) + 12px);
          width: var(--ds-flyout-width, 280px);
          max-height: 70vh;
          background: white;
          border-radius: 12px;
          box-shadow: var(--ds-shadow-flyout);
          z-index: var(--ds-z-flyout);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: flyoutIn 0.15s ease-out;
        }

        @keyframes flyoutIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Pinned/compact mode */
        .ds-stencil-flyout.pinned {
          width: 64px;
          max-height: 80vh;
        }

        .ds-stencil-flyout.pinned .ds-flyout-title span:last-child,
        .ds-stencil-flyout.pinned .ds-flyout-search,
        .ds-stencil-flyout.pinned .ds-stencil-group-name,
        .ds-stencil-flyout.pinned .ds-stencil-name {
          display: none;
        }

        .ds-stencil-flyout.pinned .ds-flyout-header {
          padding: 8px;
          justify-content: center;
        }

        .ds-stencil-flyout.pinned .ds-flyout-title {
          display: none;
        }

        .ds-stencil-flyout.pinned .ds-flyout-actions {
          flex-direction: column;
          gap: 4px;
        }

        .ds-stencil-flyout.pinned .ds-stencil-grid {
          grid-template-columns: 1fr;
          gap: 4px;
        }

        .ds-stencil-flyout.pinned .ds-stencil-item {
          padding: 8px;
        }

        .ds-stencil-flyout.pinned .ds-flyout-content {
          padding: 8px;
        }

        .ds-flyout-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .ds-flyout-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          color: var(--text, #1f2937);
        }

        .ds-flyout-icon {
          font-size: 18px;
        }

        .ds-flyout-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ds-flyout-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-flyout-btn:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .ds-flyout-btn.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-flyout-close {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          font-size: 18px;
        }

        .ds-flyout-close:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-flyout-search {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .ds-flyout-search input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .ds-flyout-search input:focus {
          border-color: var(--accent, #0e74a3);
        }

        .ds-flyout-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .ds-stencil-group {
          margin-bottom: 16px;
        }

        .ds-stencil-group:last-child {
          margin-bottom: 0;
        }

        .ds-stencil-group-name {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted, #6b7280);
          margin-bottom: 8px;
          padding-left: 4px;
        }

        .ds-stencil-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .ds-stencil-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          background: var(--bg, #f9fafb);
          border: 2px solid transparent;
        }

        .ds-stencil-item:hover {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          transform: scale(1.02);
        }

        .ds-stencil-item.selected {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.15));
          border-color: var(--ds-active-color, #0e74a3);
        }

        .ds-stencil-item:active {
          cursor: grabbing;
          transform: scale(0.98);
        }

        .ds-stencil-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }

        .ds-stencil-name {
          font-size: 10px;
          text-align: center;
          color: var(--text-muted, #6b7280);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .ds-flyout-empty {
          padding: 24px;
          text-align: center;
          color: var(--text-muted, #6b7280);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

// More Packs Popover - shows all available packs for enabling/disabling
function MorePacksPopover({ allPacks, enabledPacks, packIcons, onTogglePack, onClose }) {
  const enabledSet = new Set(enabledPacks || []);

  return (
    <div className="ds-more-packs-popover">
      <div className="ds-more-packs-header">
        <span className="ds-more-packs-title">Stencil Packs</span>
        <button className="ds-more-packs-close" onClick={onClose}>x</button>
      </div>
      <div className="ds-more-packs-subtitle">
        Click to enable or disable packs
      </div>
      <div className="ds-more-packs-list">
        {allPacks.map(pack => {
          const isEnabled = enabledSet.has(pack.id);
          return (
            <button
              key={pack.id}
              className={`ds-more-packs-item ${isEnabled ? 'enabled' : ''}`}
              onClick={() => onTogglePack(pack.id)}
              title={isEnabled ? `Disable ${pack.name}` : `Enable ${pack.name}`}
            >
              <span className="ds-more-packs-item-icon">
                {packIcons[pack.id] || <CategoryOutlined />}
              </span>
              <span className="ds-more-packs-item-name">{pack.name}</span>
              {isEnabled && (
                <span className="ds-more-packs-item-check">
                  <CheckCircleOutlined fontSize="small" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="ds-more-packs-footer">
        {enabledSet.size} of {allPacks.length} packs enabled
      </div>
      <style jsx>{`
        .ds-more-packs-popover {
          position: fixed;
          left: calc(12px + var(--ds-icon-bar-width, 52px) + 12px);
          top: 70px;
          width: 260px;
          max-height: 70vh;
          background: white;
          border-radius: 12px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          z-index: var(--ds-z-flyout, 1000);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: popoverIn 0.15s ease-out;
        }

        @keyframes popoverIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .ds-more-packs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .ds-more-packs-title {
          font-weight: 600;
          font-size: 14px;
          color: var(--text, #1f2937);
        }

        .ds-more-packs-close {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          font-size: 14px;
        }

        .ds-more-packs-close:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-more-packs-subtitle {
          padding: 8px 16px;
          font-size: 12px;
          color: var(--text-muted, #6b7280);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .ds-more-packs-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .ds-more-packs-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .ds-more-packs-item:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-more-packs-item.enabled {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.08));
        }

        .ds-more-packs-item.enabled:hover {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.12));
        }

        .ds-more-packs-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted, #6b7280);
        }

        .ds-more-packs-item.enabled .ds-more-packs-item-icon {
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-more-packs-item-icon :global(svg) {
          font-size: 20px;
        }

        .ds-more-packs-item-name {
          flex: 1;
          font-size: 13px;
          color: var(--text, #1f2937);
        }

        .ds-more-packs-item-check {
          display: flex;
          align-items: center;
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-more-packs-item-check :global(svg) {
          font-size: 18px;
        }

        .ds-more-packs-footer {
          padding: 10px 16px;
          font-size: 11px;
          color: var(--text-muted, #6b7280);
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          background: var(--bg, #f9fafb);
        }
      `}</style>
    </div>
  );
}

export default FloatingIconBar;
export { IconButton, StencilFlyout, MorePacksPopover };
